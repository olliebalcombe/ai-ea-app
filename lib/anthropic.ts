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

export interface StructuredToolDef {
  name: string;
  description: string;
  input_schema: Anthropic.Tool["input_schema"];
}

/**
 * Runs one turn of the qualification conversation.
 * Returns the assistant's next message, plus every structured field it
 * managed to extract from this exchange (via a single tool call covering
 * all of them at once -- someone can answer more than one outstanding
 * question in a single message, or go on a tangent and come back), each
 * with Claude's own confidence in that extraction, so the caller can
 * persist them to `lead_answers` without re-parsing free text.
 *
 * An optional `structuredTool` (e.g. flooring's record_flooring_profile)
 * lets a vertical capture dedicated structured columns on `leads` in the
 * same real Claude call, rather than a second round-trip.
 */
export async function runQualificationTurn(opts: {
  systemPrompt: string;
  history: ConversationTurn[];
  questionsRemaining: string[];
  structuredTool?: StructuredToolDef;
}) {
  const { systemPrompt, history, questionsRemaining, structuredTool } = opts;

  const tools: Anthropic.Tool[] = [
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
  ];
  if (structuredTool) tools.push(structuredTool as Anthropic.Tool);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 600,
    system: systemPrompt,
    messages: history,
    tools,
  });

  let reply = "";
  let extractedAnswers: ExtractedAnswer[] = [];
  let escalation: string | null = null;
  let structuredFields: Record<string, unknown> | null = null;

  for (const block of response.content) {
    if (block.type === "text") reply += block.text;
    if (block.type === "tool_use" && block.name === "record_answers") {
      const input = block.input as { answers: ExtractedAnswer[] };
      extractedAnswers = extractedAnswers.concat(input.answers ?? []);
    }
    if (block.type === "tool_use" && block.name === "flag_escalation") {
      escalation = (block.input as { reason: string }).reason;
    }
    if (block.type === "tool_use" && structuredTool && block.name === structuredTool.name) {
      structuredFields = block.input as Record<string, unknown>;
    }
  }

  return { reply, extractedAnswers, escalation, structuredFields };
}

export interface ConversationSummaryFields {
  stated_needs?: string;
  budget_signal?: string;
  urgency_signal?: string;
  quote_given?: string;
  objections_raised?: string;
  next_action?: string;
}

/**
 * Distills the latest exchange into the structured conversation_summaries
 * fields, forced via tool_choice so it's a single cheap call with no wasted
 * text generation -- given the existing summary (if any) so it can carry
 * forward what's still true and only report what's changed. NOT wired into
 * any live webhook yet; see lib/conversationSummary.ts for the orchestration
 * layer (fetch existing, call this, merge, upsert) that will call it.
 */
export async function updateConversationSummary(opts: {
  existingSummary: ConversationSummaryFields | null;
  latestExchange: ConversationTurn[];
}): Promise<ConversationSummaryFields> {
  const { existingSummary, latestExchange } = opts;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    system:
      "You maintain a compact, structured running summary of a sales conversation that may span multiple channels (phone, text, email). You're given the current summary (if any) and the latest exchange. Call update_summary with the fields that should change -- carry forward anything from the existing summary that's still accurate, and update whatever the new exchange changed. Only include a field if you have something concrete to say; omit fields you have no real signal on rather than guessing or repeating a generic placeholder.",
    messages: [
      {
        role: "user",
        content: `Current summary:\n${existingSummary ? JSON.stringify(existingSummary, null, 2) : "(none yet)"}\n\nLatest exchange:\n${latestExchange.map((t) => `${t.role}: ${t.content}`).join("\n")}`,
      },
    ],
    tools: [
      {
        name: "update_summary",
        description: "Update the structured conversation summary with what's changed or newly known.",
        input_schema: {
          type: "object",
          properties: {
            stated_needs: { type: "string", description: "What the customer says they need/want, in a short phrase" },
            budget_signal: { type: "string", description: "Anything indicating budget or price sensitivity, including a stated figure" },
            urgency_signal: { type: "string", description: "How urgent/time-sensitive this is, and why" },
            quote_given: { type: "string", description: "Any price or quote already given to this customer, and roughly when" },
            objections_raised: { type: "string", description: "Any concerns or objections raised (price, timing, trust, etc.)" },
            next_action: { type: "string", description: "What should happen next in this conversation" },
          },
        },
      },
    ],
    tool_choice: { type: "tool", name: "update_summary" },
  });

  const block = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  return (block?.input as ConversationSummaryFields) ?? {};
}
