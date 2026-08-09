import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { commitDraft } from "@/app/api/leads/simulate/route";

/**
 * POST /api/leads/simulate/commit
 * Body: { client_id: string, draft: DraftPayload }
 *
 * Performs the real inserts for a Sandbox-mode simulation the user has
 * reviewed and chosen to "Merge to production" -- membership is re-checked
 * here rather than trusted from the earlier preview call.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clientId = body?.client_id as string | undefined;
  const draft = body?.draft;

  if (!clientId || !draft) {
    return NextResponse.json({ error: "client_id and draft are required" }, { status: 400 });
  }

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

  try {
    const leadId = await commitDraft(draft);
    return NextResponse.json({ lead_id: leadId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "commit failed" }, { status: 500 });
  }
}
