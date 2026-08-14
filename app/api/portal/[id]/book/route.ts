import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAvailableSlots } from "@/lib/scheduling";
import { sendNotificationForEvent } from "@/lib/notifications";
import { logActivity } from "@/lib/activityLog";
import { syncBookingToCalendar } from "@/lib/calendarSync";

/**
 * POST /api/portal/:id/book
 * Body: { staff_id, date, time }
 *
 * Customer-initiated version of the staff-side booking route -- re-validates
 * the slot is still free with the same real lib/scheduling.ts logic so the
 * two paths can never double-book a slot.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { staff_id, date, time } = await req.json().catch(() => ({}));
  if (!staff_id || !date || !time) return NextResponse.json({ error: "staff_id, date, and time are required" }, { status: 400 });

  const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", params.id).single();
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  const stillFree = await getAvailableSlots({ clientId: lead.client_id, staffId: staff_id, daysAhead: 14, maxSlots: 999 });
  const matches = stillFree.some((s) => s.date === date && s.time === time);
  if (!matches) return NextResponse.json({ error: "that slot is no longer available" }, { status: 409 });

  const { error } = await supabaseAdmin
    .from("leads")
    .update({ status: "Booked", assigned_staff_id: staff_id, booking_date: date, booking_time: time, booking_source: "customer_portal" })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("lead_messages").insert({
    lead_id: params.id,
    sender: "system",
    body: `${lead.name ?? "Customer"} booked ${date} at ${time} via the portal.`,
  });
  await sendNotificationForEvent({ clientId: lead.client_id, leadId: params.id, event: "booked", extra: `${date} ${time}` });
  await logActivity({
    clientId: lead.client_id,
    leadId: params.id,
    type: "portal_action",
    summary: `${lead.name ?? "A customer"} booked a site visit via the portal — ${date} at ${time}`,
  });

  const { data: service } = lead.service_id
    ? await supabaseAdmin.from("services").select("name").eq("id", lead.service_id).single()
    : { data: null };
  await syncBookingToCalendar({
    clientId: lead.client_id,
    customerName: lead.name ?? "Customer",
    serviceName: service?.name ?? null,
    date,
    time,
  });

  return NextResponse.json({ ok: true });
}
