import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { analyzeLeadPhoto } from "@/lib/visionAnalysis";
import { logActivity } from "@/lib/activityLog";

/**
 * POST /api/portal/:id/upload-photo
 * Body: { image_base64, media_type, filename }
 *
 * Customer-facing version of the staff-side photo upload -- storage upload
 * happens server-side with the service role (the portal has no session to
 * satisfy the lead-media storage RLS policies), then reuses the exact same
 * real Claude Vision analysis as the dashboard.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const base64 = body?.image_base64 as string | undefined;
  const mediaType = (body?.media_type as string | undefined) ?? "image/jpeg";
  const filename = (body?.filename as string | undefined) ?? "photo.jpg";
  if (!base64) return NextResponse.json({ error: "image_base64 is required" }, { status: 400 });

  const { data: lead } = await supabaseAdmin.from("leads").select("id, client_id, name").eq("id", params.id).single();
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  const path = `${lead.client_id}/${lead.id}/${Date.now()}-${filename}`;
  const buffer = Buffer.from(base64, "base64");
  const { error: uploadError } = await supabaseAdmin.storage.from("lead-media").upload(path, buffer, { contentType: mediaType });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: mediaRow, error: insertError } = await supabaseAdmin
    .from("lead_media")
    .insert({ lead_id: lead.id, path })
    .select()
    .single();
  if (insertError || !mediaRow) return NextResponse.json({ error: insertError?.message ?? "failed to save media" }, { status: 500 });

  try {
    await analyzeLeadPhoto({ mediaId: mediaRow.id, path });
  } catch {
    // Photo is saved either way -- analysis failure shouldn't block the upload.
  }

  await logActivity({
    clientId: lead.client_id,
    leadId: lead.id,
    type: "portal_action",
    summary: `${lead.name ?? "A customer"} uploaded a site photo via the portal`,
  });

  return NextResponse.json({ ok: true });
}
