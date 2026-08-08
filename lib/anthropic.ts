import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Runs one turn of the qualification conversation.
 * Returns the assistant's next message, plus any structured field it
 * managed to extract from the exchange so far (via a tool call), so the
 * caller can persist it to `lead_answers` without re-parsing free text.
 */
export async function runQualificationTurn(opts: {
  systemPrompt: string;
  history: ConversationTurn[];
  questionsRemaining: string[];
}) {
  const { systemPrompt, history, questionsRemaining } = opts;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    system: systemPrompt,
    messages: history,
    tools: [
      {
        name: "record_answer",
        description: "Call this whenever the person's last message answers one of the outstanding questions, so it can be saved to their record.",
        input_schema: {
          type: "object",
          properties: {
            question: { type: "string", enum: questionsRemaining },
            answer: { type: "string" },
          },
          required: ["question", "answer"],
        },
      },
      {
        name: "flag_escalation",
        description: "Call this if the conversation reveals an emergency, safeguarding concern, or anything requiring immediate human attention instead of the standard flow.",
        input_schema: {
          type: "object",
          properties: { reason: { type: "string" } },
          required: ["reason"],
        },
      },
    ],
  });

  let reply = "";
  let extractedAnswer: { question: string; answer: string } | null = null;
  let escalation: string | null = null;

  for (const block of response.content) {
    if (block.type === "text") reply += block.text;
    if (block.type === "tool_use" && block.name === "record_answer") {
      extractedAnswer = block.input as { question: string; answer: string };
    }
    if (block.type === "tool_use" && block.name === "flag_escalation") {
      escalation = (block.input as { reason: string }).reason;
    }
  }

  return { reply, extractedAnswer, escalation };
}
