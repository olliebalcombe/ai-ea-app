import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { analyzeLeadPhoto } from "@/lib/visionAnalysis";

/**
 * POST /api/leads/:id/analyze-photo
 * Body: { media_id: string, path: string }
 *
 * Staff-side trigger for the real Claude Vision analysis (see
 * lib/visionAnalysis.ts) -- verifies the caller is a member of the lead's
 * client before running it. The public portal upload route reuses the same
 * underlying analysis with a different auth check.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const leadId = params.id;
  const body = await req.json().catch(() => null);
  const mediaId = body?.media_id as string | undefined;
  const path = body?.path as string | undefined;
  if (!mediaId || !path) return NextResponse.json({ error: "media_id and path are required" }, { status: 400 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => req.cookies.get(name)?.value } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: lead } = await supabaseAdmin.from("leads").select("id, client_id").eq("id", leadId).single();
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  const { data: membership } = await supabaseAdmin
    .from("client_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("client_id", lead.client_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "not a member of this client" }, { status: 403 });

  try {
    const summary = await analyzeLeadPhoto({ mediaId, path });
    return NextResponse.json({ summary });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "analysis failed" }, { status: 500 });
  }
}
