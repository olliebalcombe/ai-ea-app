"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import ApprovalQueueCard from "@/components/ApprovalQueueCard";
import type { LeadSuggestion } from "@/types";

type SuggestionRow = LeadSuggestion & { leads: { name: string | null } | null };

/** At-risk revenue: quotes with no reply, and site visits not yet offered -- filtered from the same real leakage data as Approvals. */
const FOLLOW_UP_TYPES = new Set(["follow_up_reminder", "site_visit_offer"]);

export default function FollowUpsPage() {
  const { currentClientId } = useCurrentClient();
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const { data } = await supabaseBrowser
      .from("lead_suggestions")
      .select("*, leads(name)")
      .eq("client_id", currentClientId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const rows = ((data as unknown as SuggestionRow[]) ?? []).filter((s) => FOLLOW_UP_TYPES.has(s.type));
    setSuggestions(rows);
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Clock className="h-5 w-5" style={{ color: "rgb(var(--color-risk))" }} />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Follow-ups</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        What could quietly cost this business money or trust if nobody acts — quotes sent with no reply, and site visits that
        haven't been offered yet. One click executes the follow-up.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing at risk right now.</p>
      ) : (
        <ApprovalQueueCard suggestions={suggestions} onChange={load} />
      )}
    </div>
  );
}
