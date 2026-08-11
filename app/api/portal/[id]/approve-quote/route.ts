import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLog";

/**
 * POST /api/portal/:id/approve-quote
 *
 * The "quote" is the lead's existing real assigned service + price_pence --
 * not a separate itemized quote document. Approving just timestamps it and
 * notifies staff; no payment collection in this round (deferred to a
 * dedicated Stripe round once you're ready to set that up).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: lead } = await supabaseAdmin.from("leads").select("id, client_id, name, price_pence, quote_approved_at").eq("id", params.id).single();
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!lead.price_pence) return NextResponse.json({ error: "No quote on this lead yet" }, { status: 400 });
  if (lead.quote_approved_at) return NextResponse.json({ ok: true, alreadyApproved: true });

  const { error } = await supabaseAdmin
    .from("leads")
    .update({ quote_approved_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("lead_messages").insert({
    lead_id: params.id,
    sender: "system",
    body: `${lead.name ?? "Customer"} approved their quote via the portal.`,
  });
  await logActivity({
    clientId: lead.client_id,
    leadId: lead.id,
    type: "portal_action",
    summary: `${lead.name ?? "A customer"} approved their quote via the portal`,
  });

  return NextResponse.json({ ok: true });
}
