import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAvailableSlots } from "@/lib/scheduling";
import { sendNotificationForEvent } from "@/lib/notifications";

/**
 * GET /api/leads/:id/book?staff_id=...
 * Returns the next available slots for the requested staff member —
 * call this before showing/offering a time in the qualification conversation.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const staffId = req.nextUrl.searchParams.get("staff_id");
  const { data: lead } = await supabaseAdmin.from("leads").select("client_id").eq("id", params.id).single();
  if (!lead || !staffId) return NextResponse.json({ error: "lead or staff_id missing" }, { status: 400 });

  const slots = await getAvailableSlots({ clientId: lead.client_id, staffId });
  return NextResponse.json({ slots });
}

/**
 * POST /api/leads/:id/book
 * Body: { staff_id, service_id, date, time }
 * Confirms a Tier 2 booking: re-validates the slot is still free (protects
 * against a race where two people grab the same slot), updates the lead,
 * and fires the "booked" notification to the client.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { staff_id, service_id, date, time } = await req.json();

  const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", params.id).single();
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  const stillFree = await getAvailableSlots({ clientId: lead.client_id, staffId: staff_id, daysAhead: 14, maxSlots: 999 });
  const matches = stillFree.some((s) => s.date === date && s.time === time);
  if (!matches) return NextResponse.json({ error: "that slot is no longer available" }, { status: 409 });

  const { data: service } = await supabaseAdmin.from("services").select("*").eq("id", service_id).single();

  const { error } = await supabaseAdmin
    .from("leads")
    .update({
      status: "Booked",
      assigned_staff_id: staff_id,
      service_id,
      price_pence: service?.price_pence ?? null,
      booking_date: date,
      booking_time: time,
    })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("lead_messages").insert({
    lead_id: params.id, sender: "system",
    body: `Booked for ${date} at ${time}${service ? ` — ${service.name}` : ""}.`,
  });

  await sendNotificationForEvent({ clientId: lead.client_id, leadId: params.id, event: "booked", extra: `${date} ${time}` });

  return NextResponse.json({ ok: true });
}
