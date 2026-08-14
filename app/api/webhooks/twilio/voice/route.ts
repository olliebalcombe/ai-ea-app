import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSms } from "@/lib/twilio";
import { buildVoiceOpener } from "@/lib/prompts";

function escapeXml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Twilio calls this webhook for every inbound call to a client's tracking
 * number. If Voice AI Receptionist is enabled and the client has a real
 * contact_phone on file, this now genuinely rings them (<Dial>, 20s) --
 * real call forwarding that didn't exist before. Only if that dial goes
 * unanswered does /api/webhooks/twilio/voice-status (the `action` callback)
 * run the missed-call recovery flow. No contact_phone configured keeps the
 * original always-instant-text behavior.
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

  const skills: string[] = client.enabled_skills ?? [];
  if (!skills.includes("voice_ai_receptionist")) {
    // Voice AI Receptionist is disabled -- still capture the call as a lead (real CRM
    // record), but skip the AI-authored text-back and don't claim one was sent.
    const twiml = `<Response><Say voice="${client.voice_style}">Thanks for calling ${escapeXml(client.name)}. We can't take your call right now, but we've got your number and will get back to you shortly.</Say></Response>`;
    return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  if (client.contact_phone && process.env.APP_BASE_URL) {
    // Real forwarding to the business's own phone. Only the recovery route
    // (reached if this genuinely goes unanswered) creates the text-back.
    const actionUrl = `${process.env.APP_BASE_URL}/api/webhooks/twilio/voice-status?lead_id=${lead!.id}&client_id=${client.id}`;
    const twiml = `<Response><Dial timeout="20" action="${escapeXml(actionUrl)}">${escapeXml(client.contact_phone)}</Dial></Response>`;
    return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  // No contact phone configured -- every call is treated as missed, same as before.
  const openingMessage = buildVoiceOpener({ assistantName: client.assistant_name, toneStyle: client.tone_style });
  await supabaseAdmin.from("lead_messages").insert({ lead_id: lead!.id, sender: "ai", body: openingMessage });
  await sendSms(from, openingMessage);

  const twiml = `<Response><Say voice="${client.voice_style}">Thanks for calling ${escapeXml(client.name)}. We've just sent you a text so we can help right away.</Say></Response>`;
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}
