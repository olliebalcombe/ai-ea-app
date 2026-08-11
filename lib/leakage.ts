import { supabaseAdmin } from "@/lib/supabase";
import type { SuggestionType } from "@/types";

interface RuleResult {
  leadId: string;
  type: SuggestionType;
  reason: string;
}

/**
 * Deterministic, explainable rules over real lead data -- evaluated
 * on-demand (not a background job) whenever Messages/Dashboard load, same
 * "compute live" approach as the Health Audit. Upserts into lead_suggestions
 * so repeated evaluation doesn't spam duplicates. Deciding *whether*
 * something needs attention doesn't need an LLM call -- only drafting the
 * actual follow-up message text does, done separately when a staff member
 * reviews the suggestion.
 */
export async function evaluateLeakage(clientId: string): Promise<void> {
  const now = Date.now();
  const threeDaysAgoMs = now - 3 * 24 * 60 * 60 * 1000;
  const oneHourAgoMs = now - 60 * 60 * 1000;

  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("*, lead_messages(sender, created_at)")
    .eq("client_id", clientId)
    .not("status", "in", "(Won,Lost)");

  if (!leads || leads.length === 0) return;

  // High-value threshold: this client's own real 80th percentile price
  // among their leads with a price -- not a fabricated/hardcoded number.
  const prices = leads
    .map((l) => l.price_pence as number | null)
    .filter((p): p is number => p != null)
    .sort((a, b) => a - b);
  const highValueThreshold = prices.length > 0 ? prices[Math.floor(prices.length * 0.8)] : null;

  const results: RuleResult[] = [];

  for (const lead of leads as any[]) {
    const messages = (lead.lead_messages ?? []) as { sender: string; created_at: string }[];
    const lastMessage = messages.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    const lastMessageMs = lastMessage ? new Date(lastMessage.created_at).getTime() : null;
    const messagedRecently = lastMessageMs != null && lastMessageMs > oneHourAgoMs;

    if (!messagedRecently && lead.price_pence != null && lastMessageMs != null && lastMessageMs < threeDaysAgoMs) {
      const days = Math.floor((now - lastMessageMs) / (24 * 60 * 60 * 1000));
      results.push({
        leadId: lead.id,
        type: "follow_up_reminder",
        reason: `Quote sent, no reply in ${days} day${days === 1 ? "" : "s"}`,
      });
    }

    if (
      !messagedRecently &&
      lead.flooring_type != null &&
      lead.area_sqm == null &&
      lead.install_timeline === "within_30_days"
    ) {
      results.push({
        leadId: lead.id,
        type: "site_visit_offer",
        reason: "Measurements not confirmed yet, and install wanted within 30 days",
      });
    }

    if (
      highValueThreshold != null &&
      lead.price_pence != null &&
      lead.price_pence >= highValueThreshold &&
      ["Qualified", "Booked"].includes(lead.status)
    ) {
      results.push({
        leadId: lead.id,
        type: "high_value_review",
        reason: `High-value quote (£${(lead.price_pence / 100).toFixed(0)}) — worth a personal check`,
      });
    }

    if (lead.booking_date) {
      const dow = new Date(lead.booking_date).getDay();
      if ((dow === 0 || dow === 6) && ["Qualified", "Booked"].includes(lead.status)) {
        results.push({ leadId: lead.id, type: "weekend_slot_review", reason: "Requested a weekend slot" });
      }
    }

    if (lead.discount_requested) {
      results.push({ leadId: lead.id, type: "discount_approval", reason: "Customer asked about a discount" });
    }
  }

  for (const r of results) {
    const { data: existing } = await supabaseAdmin
      .from("lead_suggestions")
      .select("id")
      .eq("lead_id", r.leadId)
      .eq("type", r.type)
      .eq("status", "pending")
      .maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("lead_suggestions").insert({
        client_id: clientId,
        lead_id: r.leadId,
        type: r.type,
        reason: r.reason,
      });
    }
  }
}
