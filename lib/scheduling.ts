import { supabaseAdmin } from "./supabase";
import { getGoogleFreeBusy } from "./calendar/google";
import { getOutlookFreeBusy } from "./calendar/outlook";

export interface Slot {
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM
}

const SLOT_LENGTH_MIN = 30; // granularity to check/offer slots at

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function toTimeStr(mins: number) {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * If the client has a connected Google/Outlook calendar, fetches real busy
 * windows for the given range -- inert (returns []) until real OAuth
 * credentials exist and a connection has actually been made; never throws,
 * since a calendar hiccup shouldn't take down slot-fetching entirely.
 */
async function getExternalBusyWindows(clientId: string, timeMin: string, timeMax: string): Promise<{ start: string; end: string }[]> {
  const { data: connection } = await supabaseAdmin
    .from("calendar_connections")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!connection) return [];

  try {
    if (connection.provider === "google") {
      return await getGoogleFreeBusy({
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token,
        timeMin,
        timeMax,
      });
    }
    if (connection.provider === "outlook" && connection.connected_email) {
      return await getOutlookFreeBusy({
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token,
        email: connection.connected_email,
        timeMin,
        timeMax,
      });
    }
  } catch (e) {
    console.error("calendar free/busy lookup failed", e);
  }
  return [];
}

/**
 * Returns the next available slots for a given client/staff member over the
 * next `daysAhead` days, respecting:
 *  - the client's business hours
 *  - the client's buffer_minutes between bookings
 *  - any soft-constraint scheduling_rules (e.g. "no bookings Tuesday mornings")
 *  - existing bookings already on that staff member's day
 *  - a connected external calendar's real busy windows, if one exists
 */
export async function getAvailableSlots(opts: {
  clientId: string;
  staffId: string;
  daysAhead?: number;
  maxSlots?: number;
}): Promise<Slot[]> {
  const { clientId, staffId, daysAhead = 7, maxSlots = 5 } = opts;

  const { data: client } = await supabaseAdmin.from("clients").select("*").eq("id", clientId).single();
  if (!client) return [];

  const { data: rules } = await supabaseAdmin.from("scheduling_rules").select("*").eq("client_id", clientId);

  const results: Slot[] = [];
  const today = new Date();
  const rangeEnd = new Date(today);
  rangeEnd.setDate(rangeEnd.getDate() + daysAhead);
  const externalBusy = await getExternalBusyWindows(clientId, today.toISOString(), rangeEnd.toISOString());

  for (let d = 0; d < daysAhead && results.length < maxSlots; d++) {
    const day = new Date(today);
    day.setDate(day.getDate() + d);
    const dateStr = day.toISOString().slice(0, 10);
    const dow = day.getDay();

    const { data: dayBookings } = await supabaseAdmin
      .from("leads")
      .select("booking_time")
      .eq("client_id", clientId)
      .eq("assigned_staff_id", staffId)
      .eq("booking_date", dateStr)
      .in("status", ["Booked", "Won"]);

    const bookedMinutes = (dayBookings || []).map((b) => toMinutes(b.booking_time as string));
    const dayRules = (rules || []).filter((r) => r.day_of_week === null || r.day_of_week === dow);

    let cursor = toMinutes(client.business_hours_start);
    const end = toMinutes(client.business_hours_end);

    while (cursor + SLOT_LENGTH_MIN <= end && results.length < maxSlots) {
      const slotEnd = cursor + SLOT_LENGTH_MIN;

      const blockedByRule = dayRules.some((r) => {
        const rs = toMinutes(r.blocked_start_time), re = toMinutes(r.blocked_end_time);
        return cursor < re && slotEnd > rs;
      });

      const blockedByBooking = bookedMinutes.some((bm) => {
        // buffer applies on both sides of an existing booking
        return cursor < bm + client.buffer_minutes && slotEnd > bm - client.buffer_minutes;
      });

      const slotStartDate = new Date(`${dateStr}T00:00:00`);
      slotStartDate.setMinutes(cursor);
      const slotEndDate = new Date(`${dateStr}T00:00:00`);
      slotEndDate.setMinutes(slotEnd);
      const blockedByExternalCalendar = externalBusy.some((w) => {
        const ws = new Date(w.start).getTime();
        const we = new Date(w.end).getTime();
        return slotStartDate.getTime() < we && slotEndDate.getTime() > ws;
      });

      const isPast = d === 0 && cursor <= today.getHours() * 60 + today.getMinutes();

      if (!blockedByRule && !blockedByBooking && !blockedByExternalCalendar && !isPast) {
        results.push({ date: dateStr, time: toTimeStr(cursor) });
      }
      cursor += SLOT_LENGTH_MIN;
    }
  }

  return results;
}
