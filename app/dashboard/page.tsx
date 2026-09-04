"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  CalendarCheck,
  AlertTriangle,
  Palette,
  Wifi,
  ArrowRight,
  ClipboardCheck,
  PoundSterling,
  MessageSquare,
  Bell,
  Star,
  Globe,
  PhoneCall,
  Phone,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { staggerContainer, staggerItem, hoverShift } from "@/lib/motion";
import ApprovalQueueCard from "@/components/ApprovalQueueCard";
import LeakageCard from "@/components/LeakageCard";
import InteractiveChart from "@/components/InteractiveChart";
import TodaySchedule, { type ScheduleItem } from "@/components/TodaySchedule";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Lead, ActivityLogEntry, ActivityType, LeadSuggestion, Channel } from "@/types";

const CHANNEL_ICON: Record<Channel, LucideIcon> = { call: Phone, sms: MessageSquare, email: Mail };

interface ActiveConversation {
  leadId: string;
  name: string;
  channel: Channel;
  lastMessage: string;
  lastAt: string;
}

const STATUS_FLOW = ["New", "Contacted", "Qualified", "Booked", "Won"] as const;
const STATUS_COLOR_VAR: Record<string, string> = {
  New: "--color-info",
  Contacted: "--color-ai",
  Qualified: "--color-attention",
  Booked: "--primary-rgb",
  Won: "--primary-rgb",
};

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

const ASSUMED_MINUTES_PER_CONVERSATION = 8;

function fmtGBP(pence: number) {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

function formatMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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

function deriveDisplayName(email: string) {
  const local = email.split("@")[0] ?? "there";
  const name = local.split(/[._+0-9]/)[0] || local;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function darken(hex: string, amount: number) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Mission Control: a single-screen 60/40 command center. Every number here already had a real query behind it before this round -- this is a layout reorganization, not a new data source. */
export default function DashboardOverviewPage() {
  const router = useRouter();
  const { currentClient, currentClientId, userEmail } = useCurrentClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [suggestions, setSuggestions] = useState<(LeadSuggestion & { leads: { name: string | null } | null })[]>([]);
  const [handledLeadIds, setHandledLeadIds] = useState<Set<string>>(new Set());
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [activeConversations, setActiveConversations] = useState<ActiveConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [whiteLabel, setWhiteLabel] = useState(false);

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const todayStr = new Date().toISOString().slice(0, 10);

    const [leadsRes, activityRes, suggestionsRes, aiMsgsRes, todayLeadsRes, todayManualRes, recentMsgsRes] = await Promise.all([
      supabaseBrowser.from("leads").select("*").eq("client_id", currentClientId).order("created_at", { ascending: false }),
      supabaseBrowser
        .from("activity_log")
        .select("*")
        .eq("client_id", currentClientId)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseBrowser
        .from("lead_suggestions")
        .select("*, leads(name)")
        .eq("client_id", currentClientId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabaseBrowser
        .from("lead_messages")
        .select("lead_id, leads!inner(client_id)")
        .eq("leads.client_id", currentClientId)
        .eq("sender", "ai")
        .gte("created_at", since24h),
      supabaseBrowser
        .from("leads")
        .select("id, name, phone, postcode, booking_date, booking_time, services:service_id(name)")
        .eq("client_id", currentClientId)
        .eq("booking_date", todayStr)
        .in("status", ["Booked", "Won"]),
      supabaseBrowser
        .from("manual_bookings")
        .select("id, customer_name, booking_date, booking_time, services:service_id(name)")
        .eq("client_id", currentClientId)
        .eq("booking_date", todayStr),
      supabaseBrowser
        .from("lead_messages")
        .select("lead_id, body, created_at, leads!inner(id, name, channel, status, client_id)")
        .eq("leads.client_id", currentClientId)
        .not("leads.status", "in", "(Won,Lost)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    setLeads((leadsRes.data as Lead[]) ?? []);
    setActivity((activityRes.data as ActivityLogEntry[]) ?? []);
    setSuggestions((suggestionsRes.data as unknown as (LeadSuggestion & { leads: { name: string | null } | null })[]) ?? []);
    setHandledLeadIds(new Set(((aiMsgsRes.data as { lead_id: string }[]) ?? []).map((m) => m.lead_id)));

    const todayLeads = (todayLeadsRes.data as unknown as
      | { id: string; name: string | null; phone: string | null; postcode: string | null; booking_date: string; booking_time: string; services: { name: string } | null }[]
      | null) ?? [];
    const todayManual = (todayManualRes.data as unknown as
      | { id: string; customer_name: string; booking_date: string; booking_time: string; services: { name: string } | null }[]
      | null) ?? [];
    setScheduleItems([
      ...todayLeads.map((l) => ({
        id: l.id,
        customer: l.name ?? "Unknown",
        service: l.services?.name ?? null,
        time: l.booking_time,
        date: l.booking_date,
        phone: l.phone,
        postcode: l.postcode,
      })),
      ...todayManual.map((m) => ({
        id: m.id,
        customer: m.customer_name,
        service: m.services?.name ?? null,
        time: m.booking_time,
        date: m.booking_date,
        phone: null,
        postcode: null,
      })),
    ]);

    const recentMsgs = (recentMsgsRes.data as unknown as
      | { lead_id: string; body: string; created_at: string; leads: { id: string; name: string | null; channel: Channel; status: string } | null }[]
      | null) ?? [];
    const seenLeadIds = new Set<string>();
    const conversations: ActiveConversation[] = [];
    for (const m of recentMsgs) {
      if (!m.leads || seenLeadIds.has(m.lead_id)) continue;
      seenLeadIds.add(m.lead_id);
      conversations.push({
        leadId: m.lead_id,
        name: m.leads.name ?? "Unknown",
        channel: m.leads.channel,
        lastMessage: m.body,
        lastAt: m.created_at,
      });
      if (conversations.length >= 4) break;
    }
    setActiveConversations(conversations);
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    if (!currentClientId) return;
    fetch("/api/leakage/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: currentClientId }),
    })
      .catch(() => {})
      .finally(() => load());
  }, [currentClientId, load]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const activity24h = activity.filter((a) => new Date(a.created_at).getTime() >= since24h);
  const conversationsHandled = handledLeadIds.size;
  const qualifiedToday = activity24h.filter((a) => a.type === "qualified").length;
  const bookedToday = activity24h.filter((a) => a.type === "booked").length;
  const remindersToday = activity24h.filter((a) => a.type === "reminder_sent").length;

  const timeSavedMins = conversationsHandled * ASSUMED_MINUTES_PER_CONVERSATION;
  const isTestLead = (l: Lead) => l.name?.startsWith("Test Lead — ") ?? false;
  // Real open pipeline: priced, still-active quotes (Qualified/Booked, not yet Won or Lost) --
  // not gated to the last 24h of AI activity, which read £0 against anything older.
  const pipelineProtected = leads
    .filter((l) => !isTestLead(l) && l.price_pence != null && ["Qualified", "Booked"].includes(l.status))
    .reduce((sum, l) => sum + (l.price_pence ?? 0), 0);
  const realSuggestions = suggestions.filter((s) => !s.leads?.name?.startsWith("Test Lead — "));

  const wonCount = leads.filter((l) => l.status === "Won").length;
  const bookedCount = leads.filter((l) => l.status === "Booked").length;
  const revenue = leads.filter((l) => l.status === "Booked" || l.status === "Won").reduce((sum, l) => sum + (l.price_pence ?? 0), 0);

  const stageCounts = STATUS_FLOW.map((s) => ({ stage: s, count: leads.filter((l) => l.status === s).length }));
  const displayName = deriveDisplayName(userEmail);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem} className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serifDisplay text-2xl font-normal tracking-tight text-foreground">Good morning, {displayName}.</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span>
            <strong className="text-foreground">{realSuggestions.length}</strong> <span className="text-muted-foreground">actions pending</span>
          </span>
          <span>
            <strong className="text-foreground">{scheduleItems.length}</strong> <span className="text-muted-foreground">site visits today</span>
          </span>
          <span className="flex items-center gap-1">
            <PoundSterling className="h-3.5 w-3.5 text-primary" />
            <strong className="text-foreground">{fmtGBP(pipelineProtected)}</strong>
            <span className="text-muted-foreground">pipeline protected</span>
          </span>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left column — 60% — core operational work */}
        <div className="space-y-6 lg:col-span-3">
          <Card
            className="glow-ring p-5"
            style={{ borderColor: "rgba(var(--color-attention), 0.25)", background: "rgba(var(--color-attention), 0.04)" }}
          >
            <div className="mb-3 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" style={{ color: "rgb(var(--color-attention))" }} />
              <div className="text-sm font-semibold text-foreground">Urgent Approval Queue</div>
            </div>
            <ApprovalQueueCard
              suggestions={suggestions.slice(0, 3)}
              onChange={load}
              compact
              onReview={() => router.push("/dashboard/approvals")}
            />
            {suggestions.length > 0 && (
              <button
                className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => router.push("/dashboard/approvals")}
              >
                View All Pending Actions ({suggestions.length}) <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 text-sm font-semibold text-foreground">Today's Schedule &amp; Site Visits</div>
            <TodaySchedule items={scheduleItems} />
          </Card>

          <Card className="p-5">
            <div className="mb-3 text-sm font-semibold text-foreground">Active Conversations</div>
            {activeConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open conversations right now.</p>
            ) : (
              <div className="space-y-1.5">
                {activeConversations.map((c) => {
                  const Icon = CHANNEL_ICON[c.channel];
                  return (
                    <motion.button
                      key={c.leadId}
                      whileHover={hoverShift}
                      onClick={() => router.push("/dashboard/inbox")}
                      className="glow-hover flex w-full items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2 text-left"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="shrink-0 text-xs font-medium text-foreground">{c.name}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{c.lastMessage}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(c.lastAt)}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <InteractiveChart leads={leads} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              {stageCounts.map((s, i) => (
                <div key={s.stage} className="flex items-center gap-2">
                  <div className="text-center">
                    <div className="text-lg font-semibold" style={{ color: `rgb(var(${STATUS_COLOR_VAR[s.stage]}))` }}>
                      {s.count}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{s.stage}</div>
                  </div>
                  {i < stageCounts.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Today: {qualifiedToday} qualified · {bookedToday} booked · {remindersToday} reminders sent — {formatMinutes(timeSavedMins)} saved
              this week (estimated, {conversationsHandled} conversations × ~{ASSUMED_MINUTES_PER_CONVERSATION} min typical handling) · {fmtGBP(revenue)} revenue ({wonCount} won, {bookedCount} booked)
            </p>
          </Card>
        </div>

        {/* Right column — 40% — live AI intelligence & feed */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-3 text-sm font-semibold text-foreground">Live Assistant Activity</div>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="thin-scroll max-h-[400px] divide-y divide-border overflow-y-auto pr-1">
                {activity.map((a) => {
                  const Icon = ACTIVITY_ICON[a.type] ?? Sparkles;
                  return (
                    <div key={a.id} className="flex items-center gap-3 py-2 text-xs">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-foreground">{a.summary}</span>
                      <span className="shrink-0 text-muted-foreground">{timeAgo(a.created_at)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <LeakageCard suggestions={suggestions} />
        </div>
      </motion.div>

      {currentClient && (
        <motion.div variants={staggerItem}>
          <Card className="mt-6 flex flex-wrap items-center gap-3 p-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-background"
              style={{
                background:
                  whiteLabel && currentClient.brand_color
                    ? `linear-gradient(135deg, ${currentClient.brand_color}, ${darken(currentClient.brand_color, 40)})`
                    : "linear-gradient(135deg, #fbbf24, #a855f7)",
              }}
            >
              {currentClient.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">
              {whiteLabel ? currentClient.name : `AI EA for ${currentClient.name}`} · {currentClient.assistant_name} · {currentClient.vertical}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setWhiteLabel((v) => !v)}>
              <Palette className="h-3.5 w-3.5" /> White-label preview
            </Button>
            <span className="flex items-center gap-1.5 rounded-full border border-green-500/25 bg-green-500/10 px-2.5 py-1 text-[11px] text-green-400">
              <Wifi className="h-3 w-3" /> Live
            </span>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
