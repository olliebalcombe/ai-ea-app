import { supabaseAdmin } from "@/lib/supabase";
import type { ActivityType } from "@/types";

/**
 * Single write path for activity_log -- the shared source of truth behind
 * the Dashboard's rich activity feed, the header ticker, and the dedicated
 * /dashboard/activity page. Server-only (service role), same pattern as
 * lead_messages inserts.
 */
export async function logActivity(opts: {
  clientId: string;
  leadId?: string | null;
  type: ActivityType;
  summary: string;
}) {
  await supabaseAdmin.from("activity_log").insert({
    client_id: opts.clientId,
    lead_id: opts.leadId ?? null,
    type: opts.type,
    summary: opts.summary,
  });
}
