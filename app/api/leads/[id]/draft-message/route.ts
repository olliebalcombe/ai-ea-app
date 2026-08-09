import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

type DraftMode = "quote" | "polish";

/**
 * POST /api/leads/:id/draft-message
 * Body: { mode: "quote", } | { mode: "polish", currentText: string, tone: "Calm"|"Friendly"|"Direct" }
 *
 * Real Claude text generation, always returned for human review in the
 * compose box -- never sent automatically. "quote" grounds itself in the
 * lead's real assigned service and the client's real pricing_rule
 * knowledge-base entries; "polish" rewrites whatever's currently typed.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const leadId = params.id;
  const body = await req.json().catch(() => null);
  const mode = body?.mode as DraftMode | undefined;
  if (mode !== "quote" && mode !== "polish") {
    return NextResponse.json({ error: "mode must be 'quote' or 'polish'" }, { status: 400 });
  }
  if (mode === "polish" && !body?.currentText?.trim()) {
    return NextResponse.json({ error: "currentText is required for polish" }, { status: 400 });
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

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, client_id, name, service_id, services:service_id(name, price_pence)")
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
    .select("name, assistant_name, tone_style")
    .eq("id", lead.client_id)
    .single();

  let prompt: string;

  if (mode === "quote") {
    const { data: pricingRules } = await supabaseAdmin
      .from("knowledge_base_entries")
      .select("title, content")
      .eq("client_id", lead.client_id)
      .eq("category", "pricing_rule");

    const service = lead.services as unknown as { name: string; price_pence: number } | null;
    if (!service && (!pricingRules || pricingRules.length === 0)) {
      return NextResponse.json(
        { error: "This lead has no assigned service and there are no pricing rules in the Knowledge Base to ground a quote in." },
        { status: 400 }
      );
    }

    prompt = `You're drafting a short WhatsApp/SMS message from ${client?.name ?? "the business"} to a customer named ${lead.name ?? "the customer"}, giving them a ballpark price.

${service ? `Their enquiry is for: ${service.name}, list price around £${(service.price_pence / 100).toFixed(2)}.` : ""}
${
  pricingRules && pricingRules.length > 0
    ? `Relevant pricing rules:\n${pricingRules.map((r) => `- ${r.title}: ${r.content}`).join("\n")}`
    : ""
}

Write a short, natural 2-3 sentence message giving a ballpark figure grounded only in the above -- don't invent numbers. Sound like a calm, competent human, not a salesperson. No greeting/sign-off, just the message body.`;
  } else {
    const tone = (body?.tone as string) ?? "Calm";
    prompt = `Rewrite the following outbound message to a customer in a ${tone.toLowerCase()} tone. Keep it roughly the same length and meaning, just adjust the tone. Return only the rewritten message, nothing else.

Message:
"""
${body.currentText}
"""`;
  }

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
