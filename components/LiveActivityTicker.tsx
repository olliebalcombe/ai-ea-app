"use client";

import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, CalendarCheck, MessageSquare, Bell, Star, Globe, PhoneCall, type LucideIcon } from "lucide-react";
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

const COLOR_FOR: Record<ActivityType, string> = {
  qualified: "text-primary",
  escalated: "text-amber-400",
  booked: "text-primary",
  message_sent: "text-sky-400",
  reminder_sent: "text-sky-400",
  review_requested: "text-amber-400",
  portal_action: "text-sky-400",
  missed_call_recovery: "text-purple-400",
};

export default function LiveActivityTicker() {
  const { currentClientId } = useCurrentClient();
  const [items, setItems] = useState<ActivityLogEntry[]>([]);

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

  if (items.length === 0) return null;

  const loopItems = [...items, ...items];

  return (
    <div className="overflow-hidden border-t border-white/5 bg-background/40 py-1.5">
      <div className="animate-ticker flex w-max gap-8 whitespace-nowrap px-8">
        {loopItems.map((item, i) => {
          const Icon = ICON_FOR[item.type] ?? Sparkles;
          return (
            <span key={`${item.id}-${i}`} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className={`h-3 w-3 ${COLOR_FOR[item.type] ?? "text-muted-foreground"}`} />
              {item.summary}
            </span>
          );
        })}
      </div>
    </div>
  );
}
