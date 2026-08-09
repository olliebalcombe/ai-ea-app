import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/**
 * POST /api/marketplace/playground/quote
 * Body: { client_id: string, service_id?: string }
 *
 * Marketplace Playground for "WhatsApp Ballpark Estimator" -- the same real
 * prompt-construction as the "quote" mode in /api/leads/[id]/draft-message,
 * generalized to not require a specific lead.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clientId = body?.client_id as string | undefined;
  const serviceId = body?.service_id as string | undefined;
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

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

  const { data: client } = await supabaseAdmin.from("clients").select("name").eq("id", clientId).single();

  const [{ data: service }, { data: pricingRules }] = await Promise.all([
    serviceId
      ? supabaseAdmin.from("services").select("name, price_pence").eq("id", serviceId).single()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("knowledge_base_entries")
      .select("title, content")
      .eq("client_id", clientId)
      .eq("category", "pricing_rule"),
  ]);

  if (!service && (!pricingRules || pricingRules.length === 0)) {
    return NextResponse.json(
      { error: "Pick a service, or add pricing rules to the Knowledge Base first, to ground a sample quote." },
      { status: 400 }
    );
  }

  const prompt = `You're drafting a short WhatsApp/SMS message from ${client?.name ?? "the business"} to a prospective customer, giving them a ballpark price.

${service ? `Their enquiry is for: ${service.name}, list price around £${(service.price_pence / 100).toFixed(2)}.` : ""}
${
  pricingRules && pricingRules.length > 0
    ? `Relevant pricing rules:\n${pricingRules.map((r) => `- ${r.title}: ${r.content}`).join("\n")}`
    : ""
}

Write a short, natural 2-3 sentence message giving a ballpark figure grounded only in the above -- don't invent numbers. Sound like a calm, competent human, not a salesperson. No greeting/sign-off, just the message body.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return NextResponse.json({ text });
}
