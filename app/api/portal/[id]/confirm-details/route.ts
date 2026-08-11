import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLog";

/** POST /api/portal/:id/confirm-details -- customer confirms postcode/flooring preference directly. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const postcode = body?.postcode as string | undefined;
  const flooringType = body?.flooring_type as string | undefined;
  const roomType = body?.room_type as string | undefined;

  const { data: lead } = await supabaseAdmin.from("leads").select("id, client_id, name").eq("id", params.id).single();
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  const update: Record<string, string> = {};
  if (postcode?.trim()) update.postcode = postcode.trim();
  if (flooringType?.trim()) update.flooring_type = flooringType.trim();
  if (roomType?.trim()) update.room_type = roomType.trim();
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const { error } = await supabaseAdmin.from("leads").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    clientId: lead.client_id,
    leadId: lead.id,
    type: "portal_action",
    summary: `${lead.name ?? "A customer"} confirmed job details via the portal`,
  });

  return NextResponse.json({ ok: true });
}
