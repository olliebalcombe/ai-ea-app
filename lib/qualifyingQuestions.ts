import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_QUESTIONS } from "@/lib/prompts";

export interface QuestionConfig {
  question: string;
  ai_phrasing: string | null;
  mandatory: boolean;
  follow_up_rule: string | null;
}

/**
 * Real per-client qualifying questions, falling back to the vertical-default
 * list only when a client hasn't configured any of their own yet (all four
 * seeded demo clients already have real rows here, so this fallback is only
 * for a brand-new, not-yet-configured client).
 */
export async function loadQuestionConfig(clientId: string, vertical: string): Promise<QuestionConfig[]> {
  const { data } = await supabaseAdmin
    .from("qualifying_questions")
    .select("question, ai_phrasing, mandatory, follow_up_rule")
    .eq("client_id", clientId)
    .order("display_order");
  if (data && data.length > 0) return data as QuestionConfig[];
  return (DEFAULT_QUESTIONS[vertical] || []).map((q) => ({
    question: q,
    ai_phrasing: null,
    mandatory: true,
    follow_up_rule: null,
  }));
}
