"use client";

import { useEffect, useState } from "react";
import { Phone, MessageSquare, Mail } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { cn } from "@/lib/utils";
import type { Lead, LeadMessage } from "@/types";

const CHANNEL_META = {
  call: { icon: Phone, label: "Missed Call" },
  sms: { icon: MessageSquare, label: "Text" },
  email: { icon: Mail, label: "Email" },
};

function initial(lead: Lead) {
  return (lead.name ?? "?")[0]?.toUpperCase() ?? "?";
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function MessagesPage() {
  const { currentClientId } = useCurrentClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LeadMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentClientId) return;
    setLoading(true);
    supabaseBrowser
      .from("leads")
      .select("*")
      .eq("client_id", currentClientId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data as Lead[]) ?? [];
        setLeads(rows);
        setActiveId(rows[0]?.id ?? null);
        setLoading(false);
      });
  }, [currentClientId]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    supabaseBrowser
      .from("lead_messages")
      .select("*")
      .eq("lead_id", activeId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages((data as LeadMessage[]) ?? []));
  }, [activeId]);

  const active = leads.find((l) => l.id === activeId) ?? null;

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="flex overflow-hidden rounded-lg border border-border" style={{ height: "calc(100vh - 8rem)" }}>
      <div className="w-72 shrink-0 overflow-y-auto border-r border-border p-2">
        {leads.length === 0 && <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>}
        {leads.map((l) => {
          const Icon = CHANNEL_META[l.channel].icon;
          const isActive = l.id === activeId;
          return (
            <div
              key={l.id}
              onClick={() => setActiveId(l.id)}
              className={cn(
                "mb-1 flex cursor-pointer items-center gap-2.5 rounded-lg p-2.5 hover:bg-accent",
                isActive && "bg-primary/10"
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-purple-500 text-xs font-bold text-background">
                {initial(l)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{l.name ?? "Unknown"}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(l.created_at)}</span>
                </div>
                <div className="truncate text-xs text-muted-foreground">{CHANNEL_META[l.channel].label}</div>
              </div>
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted">
                <Icon className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {active ? (
          <>
            <div className="flex items-center gap-3 border-b border-border p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-purple-500 text-sm font-bold text-background">
                {initial(active)}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{active.name ?? "Unknown"}</div>
                <div className="text-xs text-muted-foreground">via {CHANNEL_META[active.channel].label}</div>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-5">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages logged for this lead yet.</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[70%] rounded-lg px-3 py-2 text-sm",
                      m.sender === "lead"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : m.sender === "ai"
                        ? "bg-muted text-foreground"
                        : "mx-auto bg-amber-500/10 text-center text-xs italic text-amber-300"
                    )}
                  >
                    {m.body}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}
