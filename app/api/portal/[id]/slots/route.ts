import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAvailableSlots } from "@/lib/scheduling";

/**
 * GET /api/portal/:id/slots
 *
 * A customer doesn't know which staff member to pick, so this resolves one
 * server-side (the lead's already-assigned staff if there is one, otherwise
 * the client's first real staff member) rather than asking them to choose --
 * same real availability logic as the staff-side booking widget either way.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: lead } = await supabaseAdmin.from("leads").select("client_id, assigned_staff_id").eq("id", params.id).single();
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  let staffId = lead.assigned_staff_id as string | null;
  if (!staffId) {
    const { data: staff } = await supabaseAdmin.from("staff").select("id").eq("client_id", lead.client_id).limit(1).maybeSingle();
    staffId = staff?.id ?? null;
  }
  if (!staffId) return NextResponse.json({ slots: [] });

  const slots = await getAvailableSlots({ clientId: lead.client_id, staffId });
  return NextResponse.json({ slots, staff_id: staffId });
}
