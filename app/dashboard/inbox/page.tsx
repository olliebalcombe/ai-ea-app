"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Phone, MessageSquare, Mail, Sparkles, ArrowRight, Send } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { cn } from "@/lib/utils";
import { staggerContainer, staggerItem, hoverShift } from "@/lib/motion";
import ApprovalQueueCard from "@/components/ApprovalQueueCard";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Lead, LeadMessage, LeadSuggestion } from "@/types";

const CHANNEL_META = {
  call: { icon: Phone, label: "Voice" },
  sms: { icon: MessageSquare, label: "Text" },
  email: { icon: Mail, label: "Email" },
};

type SuggestionRow = LeadSuggestion & { leads: { name: string | null } | null };

const TAB_TRIGGER_CLASS =
  "rounded-md px-3 py-1.5 font-medium text-zinc-400 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-none hover:text-zinc-200";

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

function ConversationList({
  leads,
  activeId,
  onSelect,
  suggestionsByLead,
}: {
  leads: Lead[];
  activeId: string | null;
  onSelect: (id: string) => void;
  suggestionsByLead: Map<string, SuggestionRow>;
}) {
  const [messages, setMessages] = useState<LeadMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const active = leads.find((l) => l.id === activeId) ?? null;

  const loadMessages = useCallback(async (id: string) => {
    const { data } = await supabaseBrowser
      .from("lead_messages")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: true });
    setMessages((data as LeadMessage[]) ?? []);
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    loadMessages(activeId);
  }, [activeId, loadMessages]);

  async function sendReply() {
    if (!activeId || !replyText.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/leads/${activeId}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setReplyText("");
      loadMessages(activeId);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex overflow-hidden rounded-lg border border-border" style={{ height: "calc(100vh - 14rem)" }}>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="no-scrollbar w-80 shrink-0 overflow-y-auto border-r border-border p-2"
      >
        {leads.length === 0 && <p className="p-4 text-sm text-muted-foreground">No conversations here.</p>}
        {leads.map((l) => {
          const Icon = CHANNEL_META[l.channel].icon;
          const isActive = l.id === activeId;
          const suggestion = suggestionsByLead.get(l.id);
          const aiHandled = !suggestion && l.status !== "Qualified" && !l.ai_paused;
          return (
            <motion.div
              key={l.id}
              variants={staggerItem}
              whileHover={hoverShift}
              onClick={() => onSelect(l.id)}
              className={cn(
                "flex min-h-[64px] cursor-pointer items-start gap-2.5 border-b border-zinc-800/80 px-4 py-3 hover:bg-accent",
                isActive ? "border-l-2 border-l-emerald-500 bg-zinc-800/60" : "border-l-2 border-l-transparent"
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
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                    <Icon className="h-2.5 w-2.5" /> {CHANNEL_META[l.channel].label}
                  </span>
                  <StatusBadge status={l.status} />
                </div>
                {suggestion ? (
                  <div className="mt-1 flex items-center gap-1 truncate text-[11px]" style={{ color: "rgb(var(--color-attention))" }}>
                    <ArrowRight className="h-2.5 w-2.5 shrink-0" /> {suggestion.reason}
                  </div>
                ) : aiHandled ? (
                  <div className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: "rgb(var(--color-handled, var(--primary-rgb)))" }}>
                    <Sparkles className="h-2.5 w-2.5 shrink-0" /> AI handled
                  </div>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

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
                messages.map((m) =>
                  m.sender === "lead" || m.sender === "ai" || m.sender === "staff" ? (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[70%] rounded-lg px-3 py-2 text-sm",
                        m.sender === "lead" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      )}
                    >
                      {m.body}
                    </div>
                  ) : (
                    <div
                      key={m.id}
                      className="mx-auto w-fit rounded-full bg-zinc-800/70 px-3 py-1 text-xs text-zinc-400"
                    >
                      {m.body}
                    </div>
                  )
                )
              )}
            </div>
            <div className="sticky bottom-0 border-t border-zinc-800 bg-zinc-900 p-3">
              {sendError && <p className="mb-2 text-xs text-destructive">{sendError}</p>}
              <div className="flex items-end gap-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply…"
                  rows={1}
                  className="min-h-0 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                />
                <Button size="icon" onClick={sendReply} disabled={sending || !replyText.trim()} aria-label="Send reply">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select a conversation</div>
        )}
      </div>
    </div>
  );
}

export default function InboxPage() {
  const { currentClientId } = useCurrentClient();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const [{ data: leadsData }, { data: suggestionsData }] = await Promise.all([
      supabaseBrowser.from("leads").select("*").eq("client_id", currentClientId).order("created_at", { ascending: false }),
      supabaseBrowser
        .from("lead_suggestions")
        .select("*, leads(name)")
        .eq("client_id", currentClientId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);
    const rows = (leadsData as Lead[]) ?? [];
    setLeads(rows);
    setActiveId((prev) => prev ?? rows[0]?.id ?? null);
    setSuggestions((suggestionsData as unknown as SuggestionRow[]) ?? []);
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const needsMe = leads.filter((l) => l.status === "Qualified" || l.ai_paused);
  const handled = leads.filter((l) => l.status !== "Qualified" && !l.ai_paused);
  const suggestionsByLead = new Map(suggestions.map((s) => [s.lead_id, s]));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">Inbox</h1>
      <Tabs defaultValue={searchParams.get("tab") === "approval" ? "approval" : "handled"}>
        <TabsList className="mb-4">
          <TabsTrigger value="handled" className={TAB_TRIGGER_CLASS}>
            Handled ({handled.length})
          </TabsTrigger>
          <TabsTrigger value="approval" className={TAB_TRIGGER_CLASS}>
            Approval ({suggestions.length})
          </TabsTrigger>
          <TabsTrigger value="needsme" className={TAB_TRIGGER_CLASS}>
            Needs you ({needsMe.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="handled" className="mt-0">
          <ConversationList leads={handled} activeId={activeId} onSelect={setActiveId} suggestionsByLead={suggestionsByLead} />
        </TabsContent>

        <TabsContent value="approval" className="mt-0">
          <ApprovalQueueCard suggestions={suggestions} onChange={load} />
        </TabsContent>

        <TabsContent value="needsme" className="mt-0">
          <ConversationList leads={needsMe} activeId={activeId} onSelect={setActiveId} suggestionsByLead={suggestionsByLead} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
