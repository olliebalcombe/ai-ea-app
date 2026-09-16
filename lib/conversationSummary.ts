import { supabaseAdmin } from "@/lib/supabase";
import { updateConversationSummary as generateUpdatedFields, type ConversationTurn } from "@/lib/anthropic";
import type { ConversationSummary } from "@/types";

export async function getConversationSummary(leadId: string): Promise<ConversationSummary | null> {
  const { data } = await supabaseAdmin.from("conversation_summaries").select("*").eq("lead_id", leadId).maybeSingle();
  return (data as ConversationSummary) ?? null;
}

/**
 * Not wired into any webhook yet -- see the Batch 2 write-up. Once called
 * (intended: after each inbound/outbound exchange on a lead), fetches the
 * existing summary, asks Claude to distill just the latest exchange against
 * it, merges the result over the existing row (a field Claude didn't mention
 * this turn is left as-is, never cleared), and upserts the single row for
 * this lead -- lead_id is the primary key, so this is always exactly one row.
 */
export async function recordConversationTurn(leadId: string, latestExchange: ConversationTurn[]): Promise<ConversationSummary> {
  const existing = await getConversationSummary(leadId);

  const updates = await generateUpdatedFields({
    existingSummary: existing
      ? {
          stated_needs: existing.stated_needs ?? undefined,
          budget_signal: existing.budget_signal ?? undefined,
          urgency_signal: existing.urgency_signal ?? undefined,
          quote_given: existing.quote_given ?? undefined,
          objections_raised: existing.objections_raised ?? undefined,
          next_action: existing.next_action ?? undefined,
        }
      : null,
    latestExchange,
  });

  const merged = {
    lead_id: leadId,
    stated_needs: updates.stated_needs ?? existing?.stated_needs ?? null,
    budget_signal: updates.budget_signal ?? existing?.budget_signal ?? null,
    urgency_signal: updates.urgency_signal ?? existing?.urgency_signal ?? null,
    quote_given: updates.quote_given ?? existing?.quote_given ?? null,
    objections_raised: updates.objections_raised ?? existing?.objections_raised ?? null,
    next_action: updates.next_action ?? existing?.next_action ?? null,
  };

  const { data } = await supabaseAdmin.from("conversation_summaries").upsert(merged).select().single();
  return data as ConversationSummary;
}
