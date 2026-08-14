import { supabaseAdmin } from "./supabase";
import { createGoogleEvent } from "./calendar/google";
import { createOutlookEvent } from "./calendar/outlook";

/**
 * Creates a real event on the client's connected calendar for a confirmed
 * booking, if one is connected. Inert (no-op) until real OAuth credentials
 * exist and a connection has been made. Never throws -- a calendar hiccup
 * should never block the real booking confirmation it's attached to.
 */
export async function syncBookingToCalendar(opts: {
  clientId: string;
  customerName: string;
  serviceName: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMin?: number;
}) {
  try {
    const { data: connection } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("client_id", opts.clientId)
      .maybeSingle();
    if (!connection) return;

    const start = new Date(`${opts.date}T${opts.time}:00`);
    const end = new Date(start.getTime() + (opts.durationMin ?? 30) * 60000);
    const summary = `${opts.serviceName ?? "Appointment"} — ${opts.customerName}`;
    const description = `Booked via AI EA.${opts.serviceName ? ` Service: ${opts.serviceName}.` : ""}`;

    if (connection.provider === "google") {
      await createGoogleEvent({
        accessToken: connection.access_token,
        summary,
        description,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
      });
    } else if (connection.provider === "outlook") {
      await createOutlookEvent({
        accessToken: connection.access_token,
        subject: summary,
        body: description,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
      });
    }
  } catch (e) {
    console.error("calendar event sync failed", e);
  }
}
