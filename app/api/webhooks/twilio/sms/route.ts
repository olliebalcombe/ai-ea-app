import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSms } from "@/lib/twilio";
import { runQualificationTurn, ConversationTurn } from "@/lib/anthropic";
import { buildSystemPrompt, DEFAULT_QUESTIONS } from "@/lib/prompts";
import { sendNotificationForEvent } from "@/lib/notifications";

/**
 * Twilio calls this webhook for every inbound SMS -- both a lead's first
 * text and every reply during the qualification conversation.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const from = form.get("From") as string;
  const to = form.get("To") as string;
  const body = (form.get("Body") as string) || "";

  const { data: client } = await supabaseAdmin.from("clients").select("*").eq("twilio_number", to).single();
  if (!client) return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });

  // Find the most recent open lead for this phone number, or start a new one
  // (covers the case where someone texts in directly, without a missed call first).
  let { data: lead } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("client_id", client.id)
    .eq("phone", from)
    .neq("status", "Won")
    .neq("status", "Lost")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  let isNewLead = false;
  if (!lead) {
    const { data: newLead } = await supabaseAdmin
      .from("leads")
      .insert({ client_id: client.id, phone: from, channel: "sms", status: "New" })
      .select()
      .single();
    lead = newLead!;
    isNewLead = true;
  }

  await supabaseAdmin.from("lead_messages").insert({ lead_id: lead.id, sender: "lead", body });

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
    channel: "sms",
    toneStyle: client.tone_style,
    businessNuances: client.business_nuances,
    knowledgeBase,
  });
  const { reply, extractedAnswers, escalation } = await runQualificationTurn({
    systemPrompt,
    history,
    questionsRemaining,
  });

  if (isNewLead) {
    await sendNotificationForEvent({ clientId: client.id, leadId: lead.id, event: "newLead" });
  }
  if (extractedAnswers.length > 0) {
    await supabaseAdmin
      .from("lead_answers")
      .insert(extractedAnswers.map((a) => ({ lead_id: lead.id, question: a.question, answer: a.answer })));
  }
  if (escalation) {
    // Flag for immediate human attention rather than letting the automated flow continue unchecked.
    await supabaseAdmin.from("leads").update({ status: "Qualified", lost_reason: null }).eq("id", lead.id);
    await sendNotificationForEvent({ clientId: client.id, leadId: lead.id, event: "newLead", extra: `URGENT — ${escalation}`, isUrgent: true });
  }
  const stillRemaining = questionsRemaining.filter((q) => !extractedAnswers.some((a) => a.question === q));
  if (stillRemaining.length === 0 && extractedAnswers.length > 0) {
    await supabaseAdmin.from("leads").update({ status: "Qualified" }).eq("id", lead.id);
  }

  await supabaseAdmin.from("lead_messages").insert({ lead_id: lead.id, sender: "ai", body: reply });
  await sendSms(from, reply);

  return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
}
