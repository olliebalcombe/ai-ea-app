import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSms } from "@/lib/twilio";
import { sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/activityLog";

/**
 * POST /api/suggestions/:id/approve
 * Body: { message?: string } -- lets staff edit the drafted text before it sends.
 *
 * For message-type suggestions (follow_up_reminder/site_visit_offer), this
 * is the actual "Approve + Send" action -- sends via Twilio/Resend, logs a
 * real staff-sent message, same pattern as the existing send-message route.
 * For decision-only types (discount_approval/high_value_review/
 * weekend_slot_review) there's nothing to send -- approving just resolves it.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const editedMessage = body?.message as string | undefined;

  const { data: suggestion } = await supabaseAdmin.from("lead_suggestions").select("*").eq("id", params.id).single();
  if (!suggestion) return NextResponse.json({ error: "suggestion not found" }, { status: 404 });
  if (suggestion.status !== "pending") return NextResponse.json({ error: "already resolved" }, { status: 400 });

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
    .eq("client_id", suggestion.client_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "not a member of this client" }, { status: 403 });

  const messageToSend = editedMessage?.trim() || suggestion.suggested_message;

  if (messageToSend) {
    const { data: lead } = await supabaseAdmin.from("leads").select("phone, email, channel, name").eq("id", suggestion.lead_id).single();
    if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

    try {
      if (lead.channel === "email" && lead.email) {
        await sendEmail(lead.email, "Following up", messageToSend, "Team");
      } else if (lead.phone) {
        await sendSms(lead.phone, messageToSend);
      } else {
        return NextResponse.json({ error: "This lead has no phone or email to send to." }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? `Send failed: ${e.message}` : "Send failed" }, { status: 502 });
    }

    await supabaseAdmin.from("lead_messages").insert({ lead_id: suggestion.lead_id, sender: "staff", body: messageToSend });
    await logActivity({
      clientId: suggestion.client_id,
      leadId: suggestion.lead_id,
      type: "reminder_sent",
      summary: `Follow-up sent to ${lead.name ?? "a lead"}`,
    });
  }

  await supabaseAdmin
    .from("lead_suggestions")
    .update({ status: "approved", resolved_at: new Date().toISOString() })
    .eq("id", params.id);

  return NextResponse.json({ ok: true, sent: Boolean(messageToSend) });
}
