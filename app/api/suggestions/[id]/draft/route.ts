import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MESSAGE_TYPES = new Set(["follow_up_reminder", "site_visit_offer"]);

/**
 * POST /api/suggestions/:id/draft
 *
 * Real Claude call drafting the actual follow-up text for a leakage
 * suggestion, grounded in that lead's real data -- always reviewed by staff
 * before Approve+Send actually delivers it (see the approve route).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: suggestion } = await supabaseAdmin.from("lead_suggestions").select("*").eq("id", params.id).single();
  if (!suggestion) return NextResponse.json({ error: "suggestion not found" }, { status: 404 });
  if (!MESSAGE_TYPES.has(suggestion.type)) {
    return NextResponse.json({ error: "this suggestion type doesn't need a drafted message" }, { status: 400 });
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
    .eq("client_id", suggestion.client_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "not a member of this client" }, { status: 403 });

  const [{ data: lead }, { data: client }] = await Promise.all([
    supabaseAdmin
      .from("leads")
      .select("*, services:service_id(name, price_pence)")
      .eq("id", suggestion.lead_id)
      .single(),
    supabaseAdmin.from("clients").select("name, assistant_name").eq("id", suggestion.client_id).single(),
  ]);
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  const service = lead.services as unknown as { name: string; price_pence: number } | null;

  const context = [
    `Business: ${client?.name ?? "the business"}`,
    `Customer: ${lead.name ?? "the customer"}`,
    service ? `Service/quote: ${service.name} — £${(service.price_pence / 100).toFixed(2)}` : null,
    lead.room_type ? `Room: ${lead.room_type}` : null,
    lead.flooring_type ? `Flooring type: ${lead.flooring_type}` : null,
    lead.area_sqm ? `Area: ${lead.area_sqm} sqm` : null,
    `Why this needs a nudge: ${suggestion.reason}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt =
    suggestion.type === "follow_up_reminder"
      ? `Draft a short, natural WhatsApp/SMS follow-up message to a customer who went quiet after receiving a quote. Warm but not pushy -- a gentle nudge, not a hard sell. 2-3 sentences max, no greeting/sign-off, just the message body.\n\n${context}`
      : `Draft a short, natural WhatsApp/SMS message offering a site visit to confirm measurements, since the job needs them before it can be booked in. 2-3 sentences max, no greeting/sign-off, just the message body.\n\n${context}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 250,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  await supabaseAdmin.from("lead_suggestions").update({ suggested_message: text }).eq("id", params.id);

  return NextResponse.json({ suggested_message: text });
}
