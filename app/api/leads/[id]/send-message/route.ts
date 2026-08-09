import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSms } from "@/lib/twilio";
import { sendEmail } from "@/lib/email";

/**
 * POST /api/leads/:id/send-message
 * Body: { body: string }
 *
 * Sends a real manual reply from a staff member to the lead (SMS via Twilio
 * if they have a phone number, otherwise email via Resend) and records it as
 * a genuine "staff" message -- distinct from AI-generated replies -- in
 * lead_messages. lead_messages has no client-side insert RLS policy by
 * design, so this runs server-side with the service role after verifying
 * the caller is a member of the lead's client (same pattern as every other
 * write route in this app).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const leadId = params.id;
  const body = await req.json().catch(() => null);
  const messageBody = body?.body as string | undefined;
  if (!messageBody?.trim()) return NextResponse.json({ error: "body is required" }, { status: 400 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => req.cookies.get(name)?.value } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, client_id, phone, email, channel")
    .eq("id", leadId)
    .single();
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  const { data: membership } = await supabaseAdmin
    .from("client_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("client_id", lead.client_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "not a member of this client" }, { status: 403 });

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("assistant_name, name")
    .eq("id", lead.client_id)
    .single();

  try {
    if (lead.channel === "email" && lead.email) {
      await sendEmail(lead.email, `Re: your enquiry`, messageBody, client?.name ?? client?.assistant_name ?? "Team");
    } else if (lead.phone) {
      await sendSms(lead.phone, messageBody);
    } else {
      return NextResponse.json({ error: "This lead has no phone or email to send to." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `Send failed: ${e.message}` : "Send failed" },
      { status: 502 }
    );
  }

  const { error: insertError } = await supabaseAdmin
    .from("lead_messages")
    .insert({ lead_id: leadId, sender: "staff", body: messageBody });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
