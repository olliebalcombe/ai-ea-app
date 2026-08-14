// Vertical-specific conversational configuration.
// This is where the "personality" and tone rules from the prototype live for real.

import type { ToneStyle } from "@/types";
import type { StructuredToolDef } from "@/lib/anthropic";

export const DEFAULT_QUESTIONS: Record<string, string[]> = {
  Flooring: ["Room type", "Flooring type", "Approx area", "Postcode", "Install timeline", "Budget range"],
  Tradie: ["Job type", "Location", "Urgency", "Budget range"],
  "Law Firm": ["Case type", "Date of incident", "Injury?", "Represented already?"],
  Clinic: ["Service wanted", "Preferred time", "New or returning client?"],
  "Estate Agent": ["Property of interest", "Timeline", "Financing status"],
};

/**
 * Vertical-specific structured extraction, captured via an extra Claude tool
 * alongside the generic record_answers tool -- flooring is the first
 * vertical to get this; future verticals follow the same pattern.
 */
export function buildFlooringStructuredTool(): StructuredToolDef {
  return {
    name: "record_flooring_profile",
    description:
      "Call this whenever the conversation reveals or updates structured flooring-job details -- fill in only the fields you've actually learned, omit the rest. Can be called multiple times as more details emerge.",
    input_schema: {
      type: "object",
      properties: {
        room_type: { type: "string", description: "e.g. living room, kitchen, whole house" },
        flooring_type: { type: "string", description: "e.g. engineered oak, LVT, carpet" },
        area_sqm: { type: "number", description: "Approximate area in square metres" },
        postcode: { type: "string" },
        budget_fit: {
          type: "string",
          enum: ["strong", "moderate", "weak", "unknown"],
          description: "Your honest read on whether their stated budget realistically fits the likely cost",
        },
        install_timeline: { type: "string", enum: ["within_30_days", "1_3_months", "flexible", "unknown"] },
        buying_intent: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Your honest read of how ready this person is to actually buy, based on specificity, urgency, and engagement -- not a default guess",
        },
        discount_requested: { type: "boolean", description: "True if they asked for a discount or price reduction in this message" },
      },
    },
  };
}

// Natural phrasing per question, so the AI never reads like a form
export const PHRASING: Record<string, string> = {
  "Room type": "Which room (or rooms) are we talking about?",
  "Flooring type": "Did you have a flooring type in mind, or want some options?",
  "Approx area": "Roughly how big an area are we covering?",
  Postcode: "What's the postcode for the job?",
  "Install timeline": "When were you hoping to get this installed?",
  "Job type": "What's the job you need sorting?",
  Location: "Whereabouts are you based?",
  Urgency: "How soon do you need this done?",
  "Budget range": "Roughly what budget did you have in mind?",
  "Case type": "What's happened, in a nutshell?",
  "Date of incident": "When did this happen?",
  "Injury?": "Was anyone hurt?",
  "Represented already?": "Are you already working with a solicitor on this?",
  "Service wanted": "What can we get booked in for you?",
  "Preferred time": "When suits you best?",
  "New or returning client?": "Have you been to see us before?",
  "Property of interest": "Which listing caught your eye?",
  Timeline: "What's your timeline looking like?",
  "Financing status": "Are you sorted for financing already?",
};

// Sensitive questions that must NEVER get a casual acknowledgment,
// regardless of vertical. Extend this list as new verticals/questions are added.
export const SENSITIVE_QUESTIONS = new Set(["Injury?", "Case type", "Date of incident"]);

/**
 * The escalation rule: anything suggesting genuine urgency, distress, or a
 * safeguarding concern should never be handled purely by the automated flow.
 * This is a first-pass keyword check -- treat it as a safety net, not the
 * whole solution; the qualification prompt below also instructs Claude to
 * flag ambiguous cases itself.
 */
const ESCALATION_SIGNALS = [
  "suicide", "self harm", "self-harm", "kill myself", "abuse", "assault",
  "emergency", "urgent medical", "can't breathe", "bleeding", "unsafe", "danger",
];

export function needsHumanEscalation(text: string): boolean {
  const lower = text.toLowerCase();
  return ESCALATION_SIGNALS.some((signal) => lower.includes(signal));
}

const TONE_DESCRIPTIONS: Record<ToneStyle, string> = {
  calm_direct:
    "Grounded and matter-of-fact, like a highly competent EA who's seen it all before. Minimal embellishment -- get to the point efficiently, without being curt.",
  warm_friendly:
    "A bit more personable and warm than the default, while staying completely natural -- never gushing, never over-the-top. Think friendly colleague, not hype person.",
  formal_executive:
    "A more formal, professional register -- no slang, no casual contractions where they'd read as sloppy. Reads like a sharp executive assistant, not a customer-service bot.",
};

const BANNED_PHRASES = [
  "As an AI",
  "How may I assist you",
  "Delighted to help",
  "Brilliant!",
  "Fantastic!",
  "Certainly!",
  "How can I help you today?",
  "I understand your concern",
  "I appreciate your patience",
  "Rest assured",
  "Please don't hesitate to reach out",
  "I'm here to help",
];

export interface KnowledgeBaseEntry {
  category: "pricing_rule" | "faq" | "service_area" | "team_specialty" | "business_rule";
  title: string;
  content: string;
}

const KNOWLEDGE_CATEGORY_LABEL: Record<KnowledgeBaseEntry["category"], string> = {
  pricing_rule: "Pricing rules",
  faq: "FAQs",
  service_area: "Service areas",
  team_specialty: "Team specialties",
  business_rule: "Hard rules",
};

function formatKnowledgeBase(entries: KnowledgeBaseEntry[] | null | undefined) {
  if (!entries || entries.length === 0) return "";

  const rules = entries.filter((e) => e.category === "business_rule");
  const soft = entries.filter((e) => e.category !== "business_rule");

  let out = "";
  if (soft.length > 0) {
    const byCategory = new Map<string, string[]>();
    for (const e of soft) {
      const list = byCategory.get(e.category) ?? [];
      list.push(`${e.title}: ${e.content}`);
      byCategory.set(e.category, list);
    }
    const sections = Array.from(byCategory.entries())
      .map(([cat, items]) => `${KNOWLEDGE_CATEGORY_LABEL[cat as KnowledgeBaseEntry["category"]]}:\n${items.map((i) => `- ${i}`).join("\n")}`)
      .join("\n\n");
    out += `\n\nKnowledge base you can draw on when it's genuinely relevant -- use it to answer questions accurately (pricing, coverage areas, who specializes in what), don't recite it wholesale:\n${sections}`;
  }
  if (rules.length > 0) {
    out += `\n\nHard rules -- you must never violate these, even if the customer pushes back, negotiates, or asks nicely. If a request would require breaking one (e.g. a bigger discount than allowed), acknowledge it warmly but hold the line, and flag it for the team instead:\n${rules.map((r) => `- ${r.title}: ${r.content}`).join("\n")}`;
  }
  return out;
}

export interface QuestionGuidance {
  question: string;
  ai_phrasing: string | null;
  follow_up_rule: string | null;
}

function formatQuestionGuidance(guidance: QuestionGuidance[] | null | undefined) {
  const withGuidance = (guidance ?? []).filter((g) => g.ai_phrasing || g.follow_up_rule);
  if (withGuidance.length === 0) return "";
  const lines = withGuidance.map((g) => {
    let line = `- ${g.question}`;
    if (g.ai_phrasing) line += `: ask it like "${g.ai_phrasing}"`;
    if (g.follow_up_rule) line += ` (${g.follow_up_rule})`;
    return line;
  });
  return `\n\nHow to ask these specific outstanding questions, when you get to them naturally:\n${lines.join("\n")}`;
}

export function buildSystemPrompt(opts: {
  vertical: string;
  businessName: string;
  assistantName: string;
  channel: "sms" | "email";
  toneStyle: ToneStyle;
  businessNuances: string | null;
  knowledgeBase?: KnowledgeBaseEntry[] | null;
  questionGuidance?: QuestionGuidance[] | null;
}) {
  const { vertical, businessName, assistantName, channel, toneStyle, businessNuances, knowledgeBase, questionGuidance } = opts;

  const conciseness =
    channel === "sms"
      ? "This is a text/WhatsApp conversation. Reply in 1-2 short message bubbles, like a real person texting -- never a dense paragraph, never a numbered list."
      : "This is an email conversation. Write in full sentences with a proper greeting and sign-off, not short chat-style fragments -- but stay just as calm and direct in substance.";

  const nuances = businessNuances?.trim()
    ? `\n\nBackground on ${businessName} you can draw on naturally when it's genuinely relevant to the conversation -- don't recite this as a list, weave it in only if it helps: ${businessNuances.trim()}`
    : "";

  const knowledge = formatKnowledgeBase(knowledgeBase);
  const guidance = formatQuestionGuidance(questionGuidance);

  return `You are ${assistantName}, a calm, sharp, highly competent human assistant answering enquiries for ${businessName}, a ${vertical} business.

Your job: run a short, natural qualification conversation to capture the information the business needs, then hand off to the team. You are NOT a generic chatbot -- speak like a genuinely competent person who works there, not a form and not an overeager customer-service bot.

Persona: ${TONE_DESCRIPTIONS[toneStyle]}

Rules:
- ${conciseness}
- This is a real, non-linear conversation, not a script. People go on tangents, ask their own questions, or answer several things in one message -- follow where they lead, answer what they ask, and naturally steer back to whatever's still outstanding. Never force a rigid one-question-at-a-time interrogation.
- If someone answers more than one outstanding question in a single message, capture all of them -- don't only take the first one and ask about the rest again.
- If someone raises an objection (price, timing, trust, "let me think about it"), acknowledge the specific concern first, then ground it in real value or context -- never dismiss it and never cave with an empty discount. Then offer a concrete next step.
- Keep acknowledgments brief and natural -- "Got it," "Right, makes sense," "Understood," "Fair enough" -- never over-the-top enthusiasm. Never repeat the same acknowledgment word twice in a row.
- Never use any of these phrases or their close equivalents: ${BANNED_PHRASES.map((p) => `"${p}"`).join(", ")}.
- If the person's answer touches something sensitive or distressing (an injury, an accident, a safeguarding concern), respond with genuine empathy first -- never with a casual "Great!" or "Lovely" after bad news.
- If you detect anything suggesting a genuine emergency, medical crisis, or safeguarding risk, do not continue the standard flow -- tell the person you're connecting them with the team right away, and flag this conversation for immediate human review.
- When you have everything you need, thank them by name if you know it, and let them know the team will be in touch shortly.${nuances}${knowledge}${guidance}

Stay strictly in character as ${assistantName} from ${businessName}. Do not mention that you are an AI unless directly and explicitly asked.`;
}

const VOICE_OPENERS: Record<ToneStyle, (assistantName: string) => string> = {
  calm_direct: (name) => `Hi, this is ${name} -- sorry we missed your call. What can I help with?`,
  warm_friendly: (name) => `Hey there! It's ${name} -- sorry we missed you just then. What can I do for you?`,
  formal_executive: (name) => `Good day, this is ${name}. Apologies for missing your call -- what can I help you with?`,
};

export function buildVoiceOpener(opts: { assistantName: string; toneStyle: ToneStyle }) {
  return VOICE_OPENERS[opts.toneStyle](opts.assistantName);
}
