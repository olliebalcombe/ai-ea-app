import { Clock, Ruler, PoundSterling, CalendarDays, Percent, type LucideIcon } from "lucide-react";
import type { SuggestionType } from "@/types";

export const SUGGESTION_META: Record<SuggestionType, { label: string; icon: LucideIcon; colorVar: string; hasMessage: boolean }> = {
  follow_up_reminder: { label: "Follow-up overdue", icon: Clock, colorVar: "--color-risk", hasMessage: true },
  site_visit_offer: { label: "Site visit needed", icon: Ruler, colorVar: "--color-attention", hasMessage: true },
  high_value_review: { label: "High-value review", icon: PoundSterling, colorVar: "--color-attention", hasMessage: false },
  weekend_slot_review: { label: "Weekend slot", icon: CalendarDays, colorVar: "--color-info", hasMessage: false },
  discount_approval: { label: "Discount request", icon: Percent, colorVar: "--color-attention", hasMessage: false },
};
