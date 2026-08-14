import { supabaseAdmin } from "./supabase";
import { sendSms } from "./twilio";
import { sendEmail } from "./email";

export type NotificationEvent = "newLead" | "booked" | "lost" | "digest";

const EVENT_COPY: Record<NotificationEvent, (leadName: string, extra?: string) => string> = {
  newLead: (name) => `New lead captured: ${name}. Check your dashboard for details.`,
  booked: (name, extra) => `Booking confirmed for ${name}${extra ? " — " + extra : ""}.`,
  lost: (name) => `Lead marked as lost: ${name}.`,
  digest: () => `Your daily summary is ready — check the dashboard for today's activity.`,
};

/**
 * Sends a notification for one event on one lead, through every channel the
 * client has enabled for that event type, respecting quiet hours for
 * non-urgent events. Call this after any lead status change (new capture,
 * booked, marked lost) or from a scheduled job for the daily digest.
 */
export async function sendNotificationForEvent(opts: {
  clientId: string;
  leadId?: string;
  event: NotificationEvent;
  extra?: string;
  isUrgent?: boolean; // bypasses quiet hours, e.g. an escalation
}) {
  const { clientId, leadId, event, extra, isUrgent } = opts;

  const { data: client } = await supabaseAdmin.from("clients").select("*").eq("id", clientId).single();
  const { data: prefs } = await supabaseAdmin.from("notification_prefs").select("*").eq("client_id", clientId).single();
  if (!client || !prefs) return { sent: false, reason: "missing client or prefs" };

  const eventEnabledKey = { newLead: "notify_new_lead", booked: "notify_booked", lost: "notify_lost", digest: "notify_daily_digest" }[event];
  if (!prefs[eventEnabledKey]) return { sent: false, reason: "event disabled for this client" };

  if (!isUrgent && isWithinQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)) {
    return { sent: false, reason: "quiet hours — deferred" };
  }

  let leadName = "a customer";
  if (leadId) {
    const { data: lead } = await supabaseAdmin.from("leads").select("name, phone").eq("id", leadId).single();
    leadName = lead?.name || lead?.phone || leadName;
  }
  const message = EVENT_COPY[event](leadName, extra);

  const sentTo: string[] = [];
  if (prefs.sms_enabled && client.contact_phone) { await sendSms(client.contact_phone, message); sentTo.push("sms"); }
  if (prefs.email_enabled && client.contact_email) { await sendEmail(client.contact_email, `${client.assistant_name} — ${event}`, message, client.assistant_name); sentTo.push("email"); }
  if (prefs.whatsapp_enabled) { /* TODO: WhatsApp Business API integration — not yet wired, see product roadmap Horizon 2 */ }
  if (prefs.push_enabled) { /* TODO: push requires a registered device token per client — not yet wired */ }

  return { sent: sentTo.length > 0, channels: sentTo };
}

function isWithinQuietHours(start: string, end: string): boolean {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const s = toMin(start), e = toMin(end);
  if (s < e) return nowMin >= s && nowMin < e;
  return nowMin >= s || nowMin < e; // overnight range, e.g. 20:00 -> 08:00
}
