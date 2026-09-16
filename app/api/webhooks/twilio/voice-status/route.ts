import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSms, makeCall, lookupLineType } from "@/lib/twilio";
import { generateGroundedVoiceOpener } from "@/lib/voiceOpener";
import { logActivity } from "@/lib/activityLog";

function escapeXml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Twilio's `action` callback for the <Dial> in /api/webhooks/twilio/voice --
 * fires when the forwarded call to the business finishes, still as part of
 * the SAME live call from the original caller. If it was answered, there's
 * nothing to recover. If it wasn't (no-answer/busy/failed), this runs the
 * real intelligent recovery -- a Twilio Lookup to tell mobile from landline
 * -- then speaks a closing line to the caller. The recovery work is awaited
 * before responding (not fire-and-forget), since a serverless function can
 * be frozen the moment its response is sent, and no artificial delay is
 * added before the outbound landline callback -- blocking a live call for
 * an arbitrary pause isn't good practice, so it's placed promptly instead.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const dialStatus = form.get("DialCallStatus") as string | null;
  const from = form.get("From") as string;
  const leadId = req.nextUrl.searchParams.get("lead_id");
  const clientId = req.nextUrl.searchParams.get("client_id");

  if (dialStatus === "completed" || !clientId) {
    return new NextResponse("<Response><Hangup/></Response>", { headers: { "Content-Type": "text/xml" } });
  }

  const { data: client } = await supabaseAdmin.from("clients").select("*").eq("id", clientId).single();
  if (!client) {
    return new NextResponse("<Response><Hangup/></Response>", { headers: { "Content-Type": "text/xml" } });
  }

  const lineType = await lookupLineType(from);
  const isLandline = lineType === "landline";

  try {
    if (isLandline) {
      const greeting = await generateGroundedVoiceOpener(client);
      const twiml = `<Response><Say voice="${client.voice_style}">${escapeXml(greeting)}</Say></Response>`;
      await makeCall({ to: from, twiml });
      if (leadId) {
        await supabaseAdmin.from("lead_messages").insert({
          lead_id: leadId,
          sender: "system",
          body: "Outbound AI voice callback placed after a missed call.",
        });
      }
      await logActivity({
        clientId: client.id,
        leadId,
        type: "missed_call_recovery",
        summary: `Missed call from a landline; placed an outbound AI voice callback`,
      });
    } else {
      // Mobile (or unknown -- treated as mobile, the safer default): instant
      // real SMS. Styled as a WhatsApp-style handoff, but this is a real SMS,
      // not the WhatsApp Business API -- consistent with this app's standing caveat.
      const message = await generateGroundedVoiceOpener(client);
      await sendSms(from, message);
      if (leadId) {
        await supabaseAdmin.from("lead_messages").insert({ lead_id: leadId, sender: "ai", body: message });
      }
      await logActivity({
        clientId: client.id,
        leadId,
        type: "missed_call_recovery",
        summary: `Missed call${lineType === "mobile" ? " from mobile" : ""}; sent an instant text`,
      });
    }
  } catch (e) {
    console.error("missed call recovery failed", e);
  }

  const closing = isLandline
    ? "Sorry we can't get to the phone right now — we'll call you straight back."
    : "Sorry we can't get to the phone right now — we've just sent you a text.";
  const twiml = `<Response><Say voice="${client.voice_style}">${escapeXml(closing)}</Say><Hangup/></Response>`;
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}
