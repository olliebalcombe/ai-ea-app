"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, AlertTriangle, CalendarCheck, MessageSquare, Bell, Star, Globe, PhoneCall, type LucideIcon } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { staggerContainer, staggerItem, hoverLift } from "@/lib/motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ActivityLogEntry, ActivityType } from "@/types";

const PAGE_SIZE = 30;

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

export default function AssistantActivityPage() {
  const { currentClientId, currentClient } = useCurrentClient();
  const assistantName = currentClient?.assistant_name ?? "your assistant";
  const router = useRouter();
  const [items, setItems] = useState<(ActivityLogEntry & { leads: { name: string | null } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const load = useCallback(
    async (pageNum: number) => {
      if (!currentClientId) return;
      setLoading(true);
      const { data } = await supabaseBrowser
        .from("activity_log")
        .select("*, leads(name)")
        .eq("client_id", currentClientId)
        .order("created_at", { ascending: false })
        .range(pageNum * PAGE_SIZE, pageNum * PAGE_SIZE + PAGE_SIZE - 1);
      const rows = (data as unknown as (ActivityLogEntry & { leads: { name: string | null } | null })[]) ?? [];
      setItems((prev) => (pageNum === 0 ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
      setLoading(false);
    },
    [currentClientId]
  );

  useEffect(() => {
    setPage(0);
    load(0);
  }, [load]);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">Assistant Activity</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        A chronological, real audit log of everything {assistantName} has done for this business.
      </p>

      {items.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <Card className="divide-y divide-border p-2">
          <motion.div variants={staggerContainer} initial="initial" animate="animate">
            {items.map((a) => {
              const Icon = ICON_FOR[a.type] ?? Sparkles;
              return (
                <motion.button
                  key={a.id}
                  variants={staggerItem}
                  whileHover={a.lead_id ? hoverLift : undefined}
                  onClick={() => a.lead_id && router.push(`/dashboard/leads/${a.lead_id}`)}
                  disabled={!a.lead_id}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm transition-colors enabled:hover:bg-accent disabled:cursor-default"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `rgba(var(${COLOR_VAR_FOR[a.type]}), 0.12)` }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: `rgb(var(${COLOR_VAR_FOR[a.type]}))` }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground">{a.summary}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </Card>
      )}

      {hasMore && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              load(next);
            }}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
