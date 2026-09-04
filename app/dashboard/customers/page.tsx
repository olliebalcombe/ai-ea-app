"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, ArrowUpRight, Mail, MapPin, Phone, Sparkles, MessageSquare, PhoneCall, Bell, Globe, AlertTriangle, CalendarCheck, Star, type LucideIcon } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import QualificationScoreCard from "@/components/QualificationScoreCard";
import { Card } from "@/components/ui/card";
import type { Lead, LeadMessage, ActivityLogEntry, ActivityType } from "@/types";

interface Customer {
  key: string;
  name: string;
  phone: string | null;
  email: string | null;
  postcode: string | null;
  leads: Lead[];
  lifetimeValue: number;
  lastActivity: string;
}

type TimelineEntry =
  | { kind: "message"; id: string; created_at: string; message: LeadMessage }
  | { kind: "activity"; id: string; created_at: string; activity: ActivityLogEntry };

const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  qualified: Sparkles,
  escalated: AlertTriangle,
  booked: CalendarCheck,
  message_sent: MessageSquare,
  reminder_sent: Bell,
  review_requested: Star,
  portal_action: Globe,
  missed_call_recovery: PhoneCall,
};

function fmtGBP(pence: number) {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/** UK-style grouping for readability -- falls back to the raw string for anything that doesn't match a recognizable UK pattern. */
function formatPhone(phone: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("44")) digits = "0" + digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Groups real leads by contact (phone, falling back to email) at query time -- no separate customers table exists, so this is an honest computed view over real lead history, not a new entity. */
function groupIntoCustomers(leads: Lead[]): Customer[] {
  const groups = new Map<string, Lead[]>();
  for (const lead of leads) {
    const key = lead.phone?.trim() || lead.email?.trim().toLowerCase() || `lead:${lead.id}`;
    const existing = groups.get(key);
    if (existing) existing.push(lead);
    else groups.set(key, [lead]);
  }
  return Array.from(groups.entries())
    .map(([key, groupLeads]) => {
      const sorted = [...groupLeads].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latest = sorted[0];
      const lifetimeValue = groupLeads
        .filter((l) => l.status === "Won" || l.status === "Booked")
        .reduce((sum, l) => sum + (l.price_pence ?? 0), 0);
      return {
        key,
        name: latest.name ?? "Unknown",
        phone: latest.phone,
        email: latest.email,
        postcode: sorted.find((l) => l.postcode)?.postcode ?? null,
        leads: sorted,
        lifetimeValue,
        lastActivity: latest.created_at,
      };
    })
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
}

export default function CustomersPage() {
  const { currentClientId, currentClient } = useCurrentClient();
  const assistantName = currentClient?.assistant_name ?? "your assistant";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [photoCount, setPhotoCount] = useState(0);

  useEffect(() => {
    if (!currentClientId) return;
    setLoading(true);
    supabaseBrowser
      .from("leads")
      .select("*")
      .eq("client_id", currentClientId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLeads((data as Lead[]) ?? []);
        setLoading(false);
      });
  }, [currentClientId]);

  const customers = useMemo(() => groupIntoCustomers(leads), [leads]);
  const selected = customers.find((c) => c.key === selectedKey) ?? customers[0] ?? null;
  const latestLead = selected?.leads[0] ?? null;
  const latestLeadMessages = useMemo(
    () =>
      timeline
        .filter((e): e is Extract<TimelineEntry, { kind: "message" }> => e.kind === "message" && e.message.lead_id === latestLead?.id)
        .map((e) => e.message),
    [timeline, latestLead]
  );

  const loadTimeline = useCallback(async (customer: Customer) => {
    const leadIds = customer.leads.map((l) => l.id);
    const [{ data: msgs }, { data: acts }, { count }] = await Promise.all([
      supabaseBrowser.from("lead_messages").select("*").in("lead_id", leadIds).order("created_at", { ascending: false }),
      supabaseBrowser.from("activity_log").select("*").in("lead_id", leadIds).order("created_at", { ascending: false }),
      supabaseBrowser.from("lead_media").select("id", { count: "exact", head: true }).eq("lead_id", customer.leads[0].id),
    ]);
    const merged: TimelineEntry[] = [
      ...((msgs as LeadMessage[]) ?? []).map((m) => ({ kind: "message" as const, id: `m-${m.id}`, created_at: m.created_at, message: m })),
      ...((acts as ActivityLogEntry[]) ?? []).map((a) => ({ kind: "activity" as const, id: `a-${a.id}`, created_at: a.created_at, activity: a })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setTimeline(merged);
    setPhotoCount(count ?? 0);
  }, []);

  useEffect(() => {
    if (selected) loadTimeline(selected);
  }, [selected, loadTimeline]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Customers</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Every contact's full relationship — grouped by phone or email across all their enquiries, quotes, and bookings.
      </p>

      {customers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No customers yet.</p>
      ) : (
        <div className="flex overflow-hidden rounded-2xl border border-white/10" style={{ height: "calc(100vh - 16rem)" }}>
          <div className="no-scrollbar w-80 shrink-0 space-y-1.5 overflow-y-auto border-r border-white/10 p-3">
            {customers.map((c) => {
              const isActive = (selected?.key ?? customers[0]?.key) === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setSelectedKey(c.key)}
                  className={cn(
                    "glow-hover flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                    isActive
                      ? "border-emerald-500/30 bg-white/[0.04]"
                      : "border-white/10 bg-white/[0.02] hover:border-emerald-500/20"
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-purple-500 text-xs font-bold text-background">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-100">{c.name}</span>
                      <StatusBadge status={c.leads[0].status} />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-400">
                      {formatPhone(c.phone) ?? c.email ?? "No contact info"}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {c.leads.length} enquir{c.leads.length === 1 ? "y" : "ies"}
                      </span>
                      {c.lifetimeValue > 0 && <span className="font-medium text-primary">{fmtGBP(c.lifetimeValue)}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto p-6">
            {selected ? (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div className="space-y-5">
                  <Card className="p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-lg font-semibold text-slate-100">{selected.name}</div>
                      <StatusBadge status={selected.leads[0].status} />
                    </div>
                    <div className="space-y-1.5 text-sm text-slate-400">
                      {selected.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 shrink-0" /> {formatPhone(selected.phone)}
                        </div>
                      )}
                      {selected.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 shrink-0" /> {selected.email}
                        </div>
                      )}
                      {selected.postcode && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 shrink-0" /> {selected.postcode}
                        </div>
                      )}
                    </div>
                    {selected.lifetimeValue > 0 && (
                      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                        {fmtGBP(selected.lifetimeValue)} lifetime value
                      </div>
                    )}
                  </Card>

                  {latestLead && (
                    <QualificationScoreCard lead={latestLead} messages={latestLeadMessages} photoCount={photoCount} assistantName={assistantName} />
                  )}

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      History ({selected.leads.length})
                    </div>
                    <div className="space-y-1.5">
                      {selected.leads.map((l) => (
                        <Link
                          key={l.id}
                          href={`/dashboard/leads/${l.id}`}
                          className="glow-hover flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm hover:border-emerald-500/20"
                        >
                          <div className="flex items-center gap-2">
                            <StatusBadge status={l.status} />
                            <span className="text-slate-200">{new Date(l.created_at).toLocaleDateString("en-GB")}</span>
                            {l.price_pence != null && <span className="text-slate-400">{fmtGBP(l.price_pence)}</span>}
                          </div>
                          <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Relationship Timeline</div>
                  {timeline.length === 0 ? (
                    <p className="text-sm text-slate-400">No interactions recorded yet.</p>
                  ) : (
                    <div className="no-scrollbar max-h-[calc(100vh-24rem)] space-y-2 overflow-y-auto pr-1">
                      {timeline.map((entry) => {
                        if (entry.kind === "message") {
                          const m = entry.message;
                          return (
                            <div key={entry.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-xs">
                              <div className="mb-1 flex items-center justify-between text-slate-400">
                                <span className="font-medium text-slate-300">
                                  {m.sender === "lead" ? selected.name : m.sender === "ai" ? assistantName : m.sender === "staff" ? "You" : "System"}
                                </span>
                                <span>{timeAgo(m.created_at)}</span>
                              </div>
                              <p className="text-slate-200">{m.body}</p>
                            </div>
                          );
                        }
                        const a = entry.activity;
                        const Icon = ACTIVITY_ICON[a.type] ?? Sparkles;
                        return (
                          <div key={entry.id} className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.01] px-2.5 py-2 text-xs">
                            <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="flex-1 text-slate-300">{a.summary}</span>
                            <span className="shrink-0 text-slate-500">{timeAgo(a.created_at)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a customer</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
