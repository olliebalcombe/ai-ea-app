import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSms } from "@/lib/twilio";
import { sendEmail } from "@/lib/email";

/**
 * POST /api/leads/:id/request-review
 *
 * The real automated action behind the "Google Reviews Booster" skill --
 * called when a lead is marked Won. Only actually sends if the skill is
 * enabled and a review link is configured; the caller (LeadDetailContent)
 * checks `enabled_skills` before calling this, and this route re-checks
 * both server-side so it can't fire from a stale client state.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const leadId = params.id;

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
    .select("id, client_id, name, phone, email, channel")
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
    .select("name, enabled_skills, google_review_link")
    .eq("id", lead.client_id)
    .single();
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

  if (!client.enabled_skills?.includes("google_reviews_booster")) {
    return NextResponse.json({ skipped: true, reason: "Google Reviews Booster is not enabled" });
  }
  if (!client.google_review_link) {
    return NextResponse.json({ skipped: true, reason: "No Google review link configured" });
  }

  const messageBody = `Thanks for choosing ${client.name}! If you have a moment, we'd really appreciate a quick review: ${client.google_review_link}`;

  try {
    if (lead.channel === "email" && lead.email) {
      await sendEmail(lead.email, `Thanks for choosing ${client.name}`, messageBody, client.name);
    } else if (lead.phone) {
      await sendSms(lead.phone, messageBody);
    } else {
      return NextResponse.json({ skipped: true, reason: "Lead has no phone or email" });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `Send failed: ${e.message}` : "Send failed" },
      { status: 502 }
    );
  }

  await supabaseAdmin.from("lead_messages").insert({
    lead_id: leadId,
    sender: "system",
    body: "Review request sent automatically (Google Reviews Booster).",
  });

  return NextResponse.json({ ok: true });
}
