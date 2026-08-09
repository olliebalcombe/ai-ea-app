import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ExtractedAnswer {
  question: string;
  answer: string;
  confidence: number;
}

/**
 * Runs one turn of the qualification conversation.
 * Returns the assistant's next message, plus every structured field it
 * managed to extract from this exchange (via a single tool call covering
 * all of them at once -- someone can answer more than one outstanding
 * question in a single message, or go on a tangent and come back), each
 * with Claude's own confidence in that extraction, so the caller can
 * persist them to `lead_answers` without re-parsing free text.
 */
export async function runQualificationTurn(opts: {
  systemPrompt: string;
  history: ConversationTurn[];
  questionsRemaining: string[];
}) {
  const { systemPrompt, history, questionsRemaining } = opts;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 500,
    system: systemPrompt,
    messages: history,
    tools: [
      {
        name: "record_answers",
        description:
          "Call this whenever the person's last message answers one or more of the outstanding questions, even if they answered several things at once or went on a tangent first. Include every newly-answered question from that message in a single call.",
        input_schema: {
          type: "object",
          properties: {
            answers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string", enum: questionsRemaining },
                  answer: { type: "string" },
                  confidence: {
                    type: "number",
                    description: "Your confidence (0-1) that this answer is correct and complete.",
                  },
                },
                required: ["question", "answer", "confidence"],
              },
            },
          },
          required: ["answers"],
        },
      },
      {
        name: "flag_escalation",
        description:
          "Call this if the conversation reveals an emergency, safeguarding concern, or anything requiring immediate human attention instead of the standard flow.",
        input_schema: {
          type: "object",
          properties: { reason: { type: "string" } },
          required: ["reason"],
        },
      },
    ],
  });

  let reply = "";
  let extractedAnswers: ExtractedAnswer[] = [];
  let escalation: string | null = null;

  for (const block of response.content) {
    if (block.type === "text") reply += block.text;
    if (block.type === "tool_use" && block.name === "record_answers") {
      const input = block.input as { answers: ExtractedAnswer[] };
      extractedAnswers = extractedAnswers.concat(input.answers ?? []);
    }
    if (block.type === "tool_use" && block.name === "flag_escalation") {
      escalation = (block.input as { reason: string }).reason;
    }
  }

  return { reply, extractedAnswers, escalation };
}
