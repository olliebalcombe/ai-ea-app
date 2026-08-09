import { Camera, MessageSquareText, Phone, CalendarClock, Star, type LucideIcon } from "lucide-react";

export type SkillCategory = "Automation" | "Media & Vision" | "Integrations" | "Conversation Prompts" | "Voice";

export const CATEGORIES: SkillCategory[] = [
  "Automation",
  "Media & Vision",
  "Integrations",
  "Conversation Prompts",
  "Voice",
];

export interface SkillDefinition {
  key: string;
  name: string;
  subtitle: string;
  description: string;
  category: SkillCategory;
  icon: LucideIcon;
  gradient: string;
  defaultOn: boolean;
}

export const SKILLS: SkillDefinition[] = [
  {
    key: "vision_site_inspector",
    name: "Vision Site Inspector",
    subtitle: "AI photo analysis for uploaded site photos",
    description:
      "When a photo is uploaded to a lead, Claude Vision looks at it and writes a short practical read on job scope, likely materials, and anything urgent — the same real analysis used in Lead Detail's Media tab.",
    category: "Media & Vision",
    icon: Camera,
    gradient: "from-sky-500/30 via-sky-500/10 to-transparent",
    defaultOn: true,
  },
  {
    key: "whatsapp_ballpark_estimator",
    name: "WhatsApp Ballpark Estimator",
    subtitle: "AI-drafted ballpark estimate, grounded in your pricing rules",
    description:
      "Drafts a short, natural ballpark price message grounded in a lead's assigned service and your Knowledge Base pricing rules — the same real drafting used by the \"Draft Ballpark Quote\" button in Lead Detail. Always lands in the compose box for review, never sent automatically.",
    category: "Conversation Prompts",
    icon: MessageSquareText,
    gradient: "from-emerald-500/30 via-emerald-500/10 to-transparent",
    defaultOn: true,
  },
  {
    key: "voice_ai_receptionist",
    name: "Voice AI Receptionist",
    subtitle: "Instant AI text-back on missed calls",
    description:
      "When someone calls your tracking number, the AI immediately texts them back with a natural opening line and starts qualifying them over SMS — real behavior in the live Twilio voice webhook, not a demo.",
    category: "Voice",
    icon: Phone,
    gradient: "from-violet-500/30 via-violet-500/10 to-transparent",
    defaultOn: true,
  },
  {
    key: "calendar_auto_rescheduler",
    name: "Calendar Auto-Rescheduler",
    subtitle: "AI-drafted reschedule suggestions",
    description:
      "Reads a customer's reschedule request and proposes a new slot using real Claude reasoning. This is a suggestion tool for staff to review — it never moves a real booking on its own.",
    category: "Automation",
    icon: CalendarClock,
    gradient: "from-amber-500/30 via-amber-500/10 to-transparent",
    defaultOn: false,
  },
  {
    key: "google_reviews_booster",
    name: "Google Reviews Booster",
    subtitle: "Automated review request when a job is won",
    description:
      "When a lead is marked Won, automatically sends them a short message with your Google review link — a real automated send via SMS or email, using the link you configure below.",
    category: "Integrations",
    icon: Star,
    gradient: "from-rose-500/30 via-rose-500/10 to-transparent",
    defaultOn: false,
  },
];

export function skillByKey(key: string): SkillDefinition | undefined {
  return SKILLS.find((s) => s.key === key);
}
