"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import ApprovalQueueCard from "@/components/ApprovalQueueCard";
import type { LeadSuggestion } from "@/types";

type SuggestionRow = LeadSuggestion & { leads: { name: string | null } | null };

/** The dedicated Approvals workspace -- every pending human-in-the-loop decision, full detail, no clamp. */
export default function ApprovalsPage() {
  const { currentClientId, currentClient } = useCurrentClient();
  const assistantName = currentClient?.assistant_name ?? "your assistant";
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
    setSuggestions((data as unknown as SuggestionRow[]) ?? []);
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Approvals</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Everything {assistantName} wants your decision on before it acts — what it wants to do, why, and the exact message it
        would send.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ApprovalQueueCard suggestions={suggestions} onChange={load} />
      )}
    </div>
  );
}
