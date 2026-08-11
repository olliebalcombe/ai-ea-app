import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { runQualificationTurn, ConversationTurn } from "@/lib/anthropic";
import { buildSystemPrompt, buildFlooringStructuredTool, DEFAULT_QUESTIONS } from "@/lib/prompts";
import { logActivity } from "@/lib/activityLog";

/**
 * Inbound email webhook. The exact payload shape depends on your provider's
 * inbound-parsing format (e.g. Resend inbound webhooks, or Postmark's inbound
 * parse). Adjust the destructuring below to match whichever you set up --
 * this assumes a payload with { from, to, subject, text }.
 */
export async function POST(req: NextRequest) {
  const payload = await req.json();
  const from: string = payload.from;
  const to: string = payload.to;
  const text: string = payload.text || "";

  const { data: client } = await supabaseAdmin.from("clients").select("*").eq("contact_email", to).single();
  if (!client) return NextResponse.json({ ok: false, reason: "unknown client email" }, { status: 404 });

  let { data: lead } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("client_id", client.id)
    .eq("email", from)
    .neq("status", "Won")
    .neq("status", "Lost")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!lead) {
    const { data: newLead } = await supabaseAdmin
      .from("leads")
      .insert({ client_id: client.id, email: from, channel: "email", status: "New" })
      .select()
      .single();
    lead = newLead!;
  }

  await supabaseAdmin.from("lead_messages").insert({ lead_id: lead.id, sender: "lead", body: text });

  if (lead.ai_paused) {
    await logActivity({
      clientId: client.id,
      leadId: lead.id,
      type: "message_sent",
      summary: `New message from ${lead.name ?? "a lead"} — you've taken over this conversation`,
    });
    return NextResponse.json({ ok: true, paused: true });
  }

  const { data: pastMessages } = await supabaseAdmin
    .from("lead_messages")
    .select("*")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: true });

  const history: ConversationTurn[] = (pastMessages || []).map((m) => ({
    role: m.sender === "lead" ? "user" : "assistant",
    content: m.body,
  }));

  const { data: answeredRows } = await supabaseAdmin.from("lead_answers").select("question").eq("lead_id", lead.id);
  const answeredQuestions = new Set((answeredRows || []).map((r) => r.question));
  const allQuestions = DEFAULT_QUESTIONS[client.vertical] || [];
  const questionsRemaining = allQuestions.filter((q) => !answeredQuestions.has(q));

  const { data: knowledgeBase } = await supabaseAdmin
    .from("knowledge_base_entries")
    .select("category, title, content")
    .eq("client_id", client.id);

  const systemPrompt = buildSystemPrompt({
    vertical: client.vertical,
    businessName: client.name,
    assistantName: client.assistant_name,
    channel: "email",
    toneStyle: client.tone_style,
    businessNuances: client.business_nuances,
    knowledgeBase,
  });

  const { reply, extractedAnswers, escalation, structuredFields } = await runQualificationTurn({
    systemPrompt,
    history,
    questionsRemaining,
    structuredTool: client.vertical === "Flooring" ? buildFlooringStructuredTool() : undefined,
  });

  if (extractedAnswers.length > 0) {
    await supabaseAdmin
      .from("lead_answers")
      .insert(extractedAnswers.map((a) => ({ lead_id: lead.id, question: a.question, answer: a.answer })));
  }
  if (structuredFields) {
    await supabaseAdmin.from("leads").update(structuredFields).eq("id", lead.id);
  }
  if (escalation) {
    await supabaseAdmin.from("leads").update({ status: "Qualified" }).eq("id", lead.id);
    await logActivity({ clientId: client.id, leadId: lead.id, type: "escalated", summary: `Escalated ${lead.name ?? "a lead"} — ${escalation}` });
  }
  const stillRemaining = questionsRemaining.filter((q) => !extractedAnswers.some((a) => a.question === q));
  if (stillRemaining.length === 0 && extractedAnswers.length > 0) {
    await supabaseAdmin.from("leads").update({ status: "Qualified" }).eq("id", lead.id);
    await logActivity({ clientId: client.id, leadId: lead.id, type: "qualified", summary: `AI qualified ${lead.name ?? "a lead"}` });
  }

  await supabaseAdmin.from("lead_messages").insert({ lead_id: lead.id, sender: "ai", body: reply });
  await sendEmail(from, `Re: Your enquiry to ${client.name}`, reply, client.assistant_name);

  return NextResponse.json({ ok: true });
}
