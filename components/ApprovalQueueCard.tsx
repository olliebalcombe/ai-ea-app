"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Check, X, ArrowRight } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { SUGGESTION_META } from "@/lib/suggestions";
import { hoverShift } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import type { LeadSuggestion } from "@/types";

type SuggestionRow = LeadSuggestion & { leads: { name: string | null } | null };

/**
 * The Approval Queue -- draft, edit, approve+send, or dismiss each real
 * leakage suggestion. `compact` renders single-line rows for the clamped
 * Dashboard view; message-type suggestions (which need real drafting/review
 * before anything sends) get a "Review" button there instead of an inline
 * Approve, so a compact row can never send unreviewed AI-drafted text --
 * the full, non-compact view (Messages > Approval, or the Dashboard's "View
 * All" Sheet) is where drafting and editing actually happens.
 */
export default function ApprovalQueueCard({
  suggestions,
  onChange,
  compact = false,
  onReview,
}: {
  suggestions: SuggestionRow[];
  onChange: () => void;
  compact?: boolean;
  onReview?: () => void;
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

  if (compact) {
    return (
      <div className="space-y-1.5">
        {error && <p className="text-xs text-destructive">{error}</p>}
        {suggestions.map((s) => {
          const meta = SUGGESTION_META[s.type];
          const Icon = meta.icon;
          return (
            <motion.div
              key={s.id}
              whileHover={hoverShift}
              className="glow-hover flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2"
            >
              <span
                className="flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                style={{ background: `rgba(var(${meta.colorVar}), 0.12)`, color: `rgb(var(${meta.colorVar}))` }}
              >
                <Icon className="h-2.5 w-2.5" />
              </span>
              <button
                className="min-w-0 flex-1 truncate text-left text-xs text-foreground hover:underline"
                onClick={() => router.push(`/dashboard/leads/${s.lead_id}`)}
                title={`${s.leads?.name ?? "Unknown lead"} — ${s.reason}`}
              >
                <span className="font-medium">{s.leads?.name ?? "Unknown lead"}</span>
                <span className="text-muted-foreground"> — {s.reason}</span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {meta.hasMessage ? (
                  <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={onReview}>
                    Review <ArrowRight className="h-2.5 w-2.5" />
                  </Button>
                ) : (
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => approve(s)} disabled={acting === s.id} title="Approve">
                    <Check className="h-3 w-3 text-primary" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => dismiss(s)} disabled={acting === s.id} title="Dismiss">
                  <X className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
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
