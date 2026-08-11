import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/portal/:id
 *
 * Public, no-login lead portal. The lead's own id (already an unguessable
 * random UUID) is the capability token -- every portal route looks the lead
 * up by this id server-side with the service role and returns only a safe
 * subset of fields, rather than granting any new anon RLS access to `leads`
 * (which would risk enabling enumeration). There is deliberately no way to
 * list or search leads from this surface, only fetch one you already have
 * the id/link for.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, name, status, service_id, price_pence, room_type, flooring_type, area_sqm, postcode, booking_date, booking_time, quote_approved_at, assigned_staff_id, client_id, services:service_id(name, price_pence), staff:assigned_staff_id(name)")
    .eq("id", params.id)
    .single();
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: client } = await supabaseAdmin.from("clients").select("name, assistant_name").eq("id", lead.client_id).single();

  return NextResponse.json({
    lead: {
      id: lead.id,
      name: lead.name,
      status: lead.status,
      service: lead.services,
      staffName: (lead.staff as unknown as { name: string } | null)?.name ?? null,
      price_pence: lead.price_pence,
      room_type: lead.room_type,
      flooring_type: lead.flooring_type,
      area_sqm: lead.area_sqm,
      postcode: lead.postcode,
      booking_date: lead.booking_date,
      booking_time: lead.booking_time,
      quote_approved_at: lead.quote_approved_at,
    },
    business: client ? { name: client.name, assistantName: client.assistant_name } : null,
  });
}
