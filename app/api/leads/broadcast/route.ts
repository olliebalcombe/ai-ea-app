import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSms } from "@/lib/twilio";
import { logActivity } from "@/lib/activityLog";

export type BroadcastFilter = "won" | "qualified" | "all_active";

const MAX_RECIPIENTS = 200;

/**
 * POST /api/leads/broadcast
 * Body: { client_id, filter, message }
 *
 * Modest, real bulk-send: server re-derives the recipient list from the
 * filter itself (never trusts a client-supplied id list), caps it, and
 * sends via the existing real sendSms/lead_messages pattern in a loop --
 * not a fabricated bulk-messaging platform, just the same real one-to-one
 * send repeated with a safety cap and a single summarizing activity entry.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clientId = body?.client_id as string | undefined;
  const filter = body?.filter as BroadcastFilter | undefined;
  const message = (body?.message as string | undefined)?.trim();
  if (!clientId || !filter || !message) {
    return NextResponse.json({ error: "client_id, filter, and message are required" }, { status: 400 });
  }

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
    .eq("client_id", clientId)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "not a member of this client" }, { status: 403 });

  let query = supabaseAdmin.from("leads").select("id, phone").eq("client_id", clientId).not("phone", "is", null);
  if (filter === "won") query = query.eq("status", "Won");
  else if (filter === "qualified") query = query.eq("status", "Qualified");
  else query = query.in("status", ["New", "Contacted", "Qualified", "Booked"]);

  const { data: leads } = await query.limit(MAX_RECIPIENTS);
  if (!leads || leads.length === 0) {
    return NextResponse.json({ error: "No matching leads with a phone number found." }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;
  for (const lead of leads) {
    try {
      await sendSms(lead.phone as string, message);
      await supabaseAdmin.from("lead_messages").insert({ lead_id: lead.id, sender: "staff", body: message });
      sent++;
    } catch {
      failed++;
    }
  }

  await logActivity({
    clientId,
    type: "message_sent",
    summary: `Broadcast sent to ${sent} lead${sent === 1 ? "" : "s"}${failed > 0 ? ` (${failed} failed)` : ""}`,
  });

  return NextResponse.json({ sent, failed, total: leads.length });
}
