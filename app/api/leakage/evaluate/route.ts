import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { evaluateLeakage } from "@/lib/leakage";

/**
 * POST /api/leakage/evaluate
 * Body: { client_id }
 *
 * Runs the deterministic leakage rules for this client and upserts any new
 * lead_suggestions -- called on-demand when Messages/Dashboard load, same
 * "compute live" approach as the Health Audit.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clientId = body?.client_id as string | undefined;
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => req.cookies.get(name)?.value } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: membership } = await supabaseAdmin
    .from("client_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "not a member of this client" }, { status: 403 });

  await evaluateLeakage(clientId);
  return NextResponse.json({ ok: true });
}
