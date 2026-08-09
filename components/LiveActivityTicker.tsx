"use client";

import { useEffect, useState } from "react";
import { MessageSquare, CalendarCheck, AlertTriangle } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";

interface ActivityItem {
  id: string;
  type: "message" | "booked" | "qualified";
  label: string;
  at: string;
}

const POLL_MS = 20000;

export default function LiveActivityTicker() {
  const { currentClientId } = useCurrentClient();
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!currentClientId) return;

    let cancelled = false;

    async function load() {
      const [{ data: messages }, { data: leads }] = await Promise.all([
        supabaseBrowser
          .from("lead_messages")
          .select("id, sender, body, created_at, leads!inner(name, client_id)")
          .eq("leads.client_id", currentClientId)
          .order("created_at", { ascending: false })
          .limit(8),
        supabaseBrowser
          .from("leads")
          .select("id, name, status, updated_at")
          .eq("client_id", currentClientId)
          .in("status", ["Booked", "Qualified"])
          .order("updated_at", { ascending: false })
          .limit(6),
      ]);

      if (cancelled) return;

      type MessageRow = {
        id: string;
        sender: "ai" | "lead" | "system";
        created_at: string;
        leads: { name: string | null } | null;
      };
      const messageItems: ActivityItem[] = ((messages as unknown as MessageRow[]) ?? []).map((m) => ({
        id: `msg-${m.id}`,
        type: "message",
        label:
          m.sender === "lead"
            ? `${m.leads?.name ?? "A lead"} sent a message`
            : m.sender === "ai"
            ? `AI replied to ${m.leads?.name ?? "a lead"}`
            : `System note on ${m.leads?.name ?? "a lead"}`,
        at: m.created_at,
      }));

      const leadItems: ActivityItem[] = (leads ?? []).map((l) => ({
        id: `lead-${l.id}`,
        type: l.status === "Booked" ? "booked" : "qualified",
        label: l.status === "Booked" ? `Booking confirmed: ${l.name ?? "Unknown"}` : `Escalated to team: ${l.name ?? "Unknown"}`,
        at: l.updated_at,
      }));

      const merged = [...messageItems, ...leadItems]
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 12);

      setItems(merged);
    }

    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentClientId]);

  if (items.length === 0) return null;

  const iconFor = (type: ActivityItem["type"]) =>
    type === "message" ? MessageSquare : type === "booked" ? CalendarCheck : AlertTriangle;
  const colorFor = (type: ActivityItem["type"]) =>
    type === "message" ? "text-sky-400" : type === "booked" ? "text-green-400" : "text-amber-400";

  const loopItems = [...items, ...items];

  return (
    <div className="overflow-hidden border-t border-white/5 bg-background/40 py-1.5">
      <div className="animate-ticker flex w-max gap-8 whitespace-nowrap px-8">
        {loopItems.map((item, i) => {
          const Icon = iconFor(item.type);
          return (
            <span key={`${item.id}-${i}`} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className={`h-3 w-3 ${colorFor(item.type)}`} />
              {item.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
