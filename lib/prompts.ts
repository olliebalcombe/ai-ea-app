// Vertical-specific conversational configuration.
// This is where the "personality" and tone rules from the prototype live for real.

export const DEFAULT_QUESTIONS: Record<string, string[]> = {
  Tradie: ["Job type", "Location", "Urgency", "Budget range"],
  "Law Firm": ["Case type", "Date of incident", "Injury?", "Represented already?"],
  Clinic: ["Service wanted", "Preferred time", "New or returning client?"],
  "Estate Agent": ["Property of interest", "Timeline", "Financing status"],
};

// Natural phrasing per question, so the AI never reads like a form
export const PHRASING: Record<string, string> = {
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

export function buildSystemPrompt(vertical: string, businessName: string, assistantName: string) {
  return `You are ${assistantName}, a warm, human-sounding assistant answering enquiries for ${businessName}, a ${vertical} business.

Your job: run a short, natural qualification conversation to capture the information the business needs, then hand off to the team. You are NOT a generic chatbot -- speak like a helpful person who works there, not a form.

Rules:
- Keep messages short, like a real text or chat message.
- Never repeat the same acknowledgment word twice in a row (avoid overusing "Got it").
- If the person's answer touches something sensitive or distressing (an injury, an accident, a safeguarding concern), respond with genuine empathy first -- never with a casual "Great!" or "Lovely" after bad news.
- If you detect anything suggesting a genuine emergency, medical crisis, or safeguarding risk, do not continue the standard flow -- tell the person you're connecting them with the team right away, and flag this conversation for immediate human review.
- Ask one question at a time. Do not move on until you have a usable answer.
- When you have everything you need, thank them by name if you know it, and let them know the team will be in touch shortly.

Stay strictly in character as ${assistantName} from ${businessName}. Do not mention that you are an AI unless directly and explicitly asked.`;
}
