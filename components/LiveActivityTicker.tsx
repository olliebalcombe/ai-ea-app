"use client";

import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, CalendarCheck, MessageSquare, Bell, Star, Globe, PhoneCall, X, type LucideIcon } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import type { ActivityLogEntry, ActivityType } from "@/types";

const POLL_MS = 20000;

const ICON_FOR: Record<ActivityType, LucideIcon> = {
  qualified: Sparkles,
  escalated: AlertTriangle,
  booked: CalendarCheck,
  message_sent: MessageSquare,
  reminder_sent: Bell,
  review_requested: Star,
  portal_action: Globe,
  missed_call_recovery: PhoneCall,
};

/** Same semantic tokens ApprovalQueueCard/SUGGESTION_META use, so a given
 * meaning (attention/informational/AI-driven) always reads the same color
 * across the dashboard, not just within this one component. */
const COLOR_VAR_FOR: Record<ActivityType, string> = {
  qualified: "--primary-rgb",
  escalated: "--color-attention",
  booked: "--primary-rgb",
  message_sent: "--color-info",
  reminder_sent: "--color-info",
  review_requested: "--color-attention",
  portal_action: "--color-info",
  missed_call_recovery: "--color-ai",
};

/** Discrete, individually-dismissible notification strip -- deduplicated by
 * message text (identical events collapse to one), no auto-scrolling
 * marquee (the previous version), so nothing moves unless the visitor
 * scrolls it themselves. */
export default function LiveActivityTicker() {
  const { currentClientId } = useCurrentClient();
  const [items, setItems] = useState<ActivityLogEntry[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentClientId) return;
    let cancelled = false;

    async function load() {
      const { data } = await supabaseBrowser
        .from("activity_log")
        .select("*")
        .eq("client_id", currentClientId)
        .order("created_at", { ascending: false })
        .limit(12);
      if (!cancelled) setItems((data as ActivityLogEntry[]) ?? []);
    }

    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentClientId]);

  const seenSummaries = new Set<string>();
  const visibleItems = items.filter((item) => {
    if (dismissedIds.has(item.id)) return false;
    if (seenSummaries.has(item.summary)) return false;
    seenSummaries.add(item.summary);
    return true;
  });

  if (visibleItems.length === 0) return null;

  return (
    <div className="border-b border-zinc-800 bg-zinc-900/60 py-2" role="status" aria-live="polite">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
        {visibleItems.map((item) => {
          const Icon = ICON_FOR[item.type] ?? Sparkles;
          const colorVar = COLOR_VAR_FOR[item.type];
          return (
            <span
              key={item.id}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/5 bg-white/[0.02] py-1 pl-2.5 pr-1.5 text-xs text-muted-foreground"
            >
              <Icon className="h-3 w-3 shrink-0" style={colorVar ? { color: `rgb(var(${colorVar}))` } : undefined} aria-hidden="true" />
              {item.summary}
              <button
                onClick={() => setDismissedIds((prev) => new Set(prev).add(item.id))}
                className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 hover:bg-white/10 hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
