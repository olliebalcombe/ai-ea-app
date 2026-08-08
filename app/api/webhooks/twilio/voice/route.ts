import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSms } from "@/lib/twilio";

/**
 * Twilio calls this webhook when someone calls a client's tracking number.
 * For the MVP, every inbound call is treated as "missed" -- the number isn't
 * forwarded to a real phone yet, so this always triggers the instant
 * text-back. Once you're ready to actually forward calls, swap the TwiML
 * response below for a <Dial> with a timeout, and only trigger the
 * text-back if the dial goes unanswered.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const from = form.get("From") as string;
  const to = form.get("To") as string; // the client's Twilio number

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("twilio_number", to)
    .single();

  if (!client) {
    return new NextResponse("<Response><Say>Sorry, this number is not configured.</Say></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .insert({ client_id: client.id, phone: from, channel: "call", status: "New" })
    .select()
    .single();

  const openingMessage = `Hi! I'm ${client.assistant_name}, sorry we missed you -- what can I help with?`;
  await supabaseAdmin.from("lead_messages").insert({ lead_id: lead!.id, sender: "ai", body: openingMessage });
  await sendSms(from, openingMessage);

  // Let the caller know a text is on its way, then end the call gracefully.
  const twiml = `<Response><Say voice="Polly.Amy">Thanks for calling ${client.name}. We've just sent you a text so we can help right away.</Say></Response>`;
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}
