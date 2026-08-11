"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { SUGGESTION_META } from "@/lib/suggestions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import type { LeadSuggestion } from "@/types";

type SuggestionRow = LeadSuggestion & { leads: { name: string | null } | null };

/** Full interactive Approval Queue -- draft, edit, approve+send, or dismiss each real leakage suggestion. */
export default function ApprovalQueueCard({
  suggestions,
  onChange,
}: {
  suggestions: SuggestionRow[];
  onChange: () => void;
}) {
  const router = useRouter();
  const [drafting, setDrafting] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function draft(s: SuggestionRow) {
    setDrafting(s.id);
    setError(null);
    try {
      const res = await fetch(`/api/suggestions/${s.id}/draft`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Draft failed");
      setEdits((e) => ({ ...e, [s.id]: data.suggested_message }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(null);
    }
  }

  async function approve(s: SuggestionRow) {
    setActing(s.id);
    setError(null);
    try {
      const res = await fetch(`/api/suggestions/${s.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: edits[s.id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Approve failed");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setActing(null);
    }
  }

  async function dismiss(s: SuggestionRow) {
    setActing(s.id);
    await supabaseBrowser
      .from("lead_suggestions")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", s.id);
    setActing(null);
    onChange();
  }

  if (suggestions.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing needs your decision right now.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {suggestions.map((s) => {
        const meta = SUGGESTION_META[s.type];
        const Icon = meta.icon;
        const currentText = edits[s.id] ?? s.suggested_message ?? "";
        return (
          <Card key={s.id} className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: `rgba(var(${meta.colorVar}), 0.12)`, color: `rgb(var(${meta.colorVar}))` }}
              >
                <Icon className="h-3 w-3" /> {meta.label}
              </span>
              <button
                className="text-sm font-medium text-foreground hover:underline"
                onClick={() => router.push(`/dashboard/leads/${s.lead_id}`)}
              >
                {s.leads?.name ?? "Unknown lead"}
              </button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{s.reason}</p>

            {meta.hasMessage &&
              (currentText ? (
                <Textarea
                  value={currentText}
                  onChange={(e) => setEdits((edit) => ({ ...edit, [s.id]: e.target.value }))}
                  rows={2}
                  className="mb-2 text-sm"
                />
              ) : (
                <Button size="sm" variant="outline" className="mb-2" onClick={() => draft(s)} disabled={drafting === s.id}>
                  <Sparkles className="h-3.5 w-3.5" /> {drafting === s.id ? "Drafting…" : "Draft with AI"}
                </Button>
              ))}

            <div className="flex gap-2">
              {(!meta.hasMessage || currentText) && (
                <Button size="sm" onClick={() => approve(s)} disabled={acting === s.id}>
                  <Check className="h-3.5 w-3.5" /> {meta.hasMessage ? "Approve & Send" : "Approve"}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => dismiss(s)} disabled={acting === s.id}>
                <X className="h-3.5 w-3.5" /> Dismiss
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
