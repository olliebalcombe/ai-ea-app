"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  CalendarCheck,
  AlertTriangle,
  Palette,
  Wifi,
  ArrowRight,
  Bot,
  ClipboardCheck,
  Clock3,
  PoundSterling,
  Info,
  MessageSquare,
  Bell,
  Star,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { staggerContainer, staggerItem } from "@/lib/motion";
import StatCard from "@/components/StatCard";
import LeakageCard from "@/components/LeakageCard";
import InteractiveChart from "@/components/InteractiveChart";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Lead, Staff, ActivityLogEntry, ActivityType, LeadSuggestion } from "@/types";

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
};

const ASSUMED_MINUTES_PER_CONVERSATION = 8;

function formatPrice(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

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

export default function DashboardOverviewPage() {
  const { currentClient, currentClientId, userEmail } = useCurrentClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [suggestions, setSuggestions] = useState<(LeadSuggestion & { leads: { name: string | null } | null })[]>([]);
  const [handledLeadIds, setHandledLeadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [whiteLabel, setWhiteLabel] = useState(false);

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [leadsRes, staffRes, activityRes, suggestionsRes, aiMsgsRes] = await Promise.all([
      supabaseBrowser.from("leads").select("*").eq("client_id", currentClientId).order("created_at", { ascending: false }),
      supabaseBrowser.from("staff").select("id").eq("client_id", currentClientId),
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
    ]);

    setLeads((leadsRes.data as Lead[]) ?? []);
    setStaffCount(staffRes.data?.length ?? 0);
    setActivity((activityRes.data as ActivityLogEntry[]) ?? []);
    setSuggestions((suggestionsRes.data as unknown as (LeadSuggestion & { leads: { name: string | null } | null })[]) ?? []);
    setHandledLeadIds(new Set(((aiMsgsRes.data as { lead_id: string }[]) ?? []).map((m) => m.lead_id)));
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
  const influencedPipeline = leads
    .filter((l) => handledLeadIds.has(l.id) && ["Qualified", "Booked", "Won"].includes(l.status))
    .reduce((sum, l) => sum + (l.price_pence ?? 0), 0);

  const wonCount = leads.filter((l) => l.status === "Won").length;
  const bookedCount = leads.filter((l) => l.status === "Booked").length;
  const revenue = leads.filter((l) => l.status === "Booked" || l.status === "Won").reduce((sum, l) => sum + (l.price_pence ?? 0), 0);

  const stageCounts = STATUS_FLOW.map((s) => ({ stage: s, count: leads.filter((l) => l.status === s).length }));
  const displayName = deriveDisplayName(userEmail);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem} className="mb-6">
        <h1 className="font-serifDisplay text-3xl font-normal tracking-tight text-foreground">
          Good morning, {displayName}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your assistant handled{" "}
          <strong className="text-foreground">
            {conversationsHandled} conversation{conversationsHandled === 1 ? "" : "s"}
          </strong>{" "}
          while you were away.
        </p>
      </motion.div>

      <motion.div variants={staggerContainer} className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <motion.div variants={staggerItem}>
          <Card className="h-full p-5">
            <div className="mb-2 flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold text-foreground">Handled Automatically</div>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">{qualifiedToday}</strong> enquir{qualifiedToday === 1 ? "y" : "ies"} qualified
              </li>
              <li>
                <strong className="text-foreground">{bookedToday}</strong> appointment{bookedToday === 1 ? "" : "s"} booked
              </li>
              <li>
                <strong className="text-foreground">{remindersToday}</strong> quote reminder{remindersToday === 1 ? "" : "s"} sent
              </li>
            </ul>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card
            className="glow-ring h-full p-5"
            style={{ borderColor: "rgba(var(--color-attention), 0.25)", background: "rgba(var(--color-attention), 0.05)" }}
          >
            <div className="mb-2 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" style={{ color: "rgb(var(--color-attention))" }} />
              <div className="text-sm font-semibold text-foreground">Needs Your Decision</div>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              <strong className="text-foreground">{suggestions.length}</strong> item{suggestions.length === 1 ? "" : "s"} waiting —
              discount requests, high-value quotes, and weekend slots.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/messages?tab=approval">
                Review Approval Queue <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="h-full p-5">
            <div className="mb-2 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold text-foreground">Time Saved &amp; Value</div>
              <span title={`Estimated: ${conversationsHandled} conversations × ~${ASSUMED_MINUTES_PER_CONVERSATION} min average manual handling time`}>
                <Info className="h-3 w-3 text-muted-foreground" />
              </span>
            </div>
            <div className="text-2xl font-semibold text-foreground">{formatMinutes(timeSavedMins)} saved</div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              estimated — {conversationsHandled} conversations × ~{ASSUMED_MINUTES_PER_CONVERSATION} min typical manual handling
            </p>
            <div className="flex items-center gap-1.5 text-sm">
              <PoundSterling className="h-3.5 w-3.5 text-primary" />
              <strong className="text-foreground">{fmtGBP(influencedPipeline)}</strong>
              <span className="text-muted-foreground">influenced pipeline</span>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={staggerItem}>
        <LeakageCard suggestions={suggestions} />
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card className="mb-6 p-5">
          <InteractiveChart leads={leads} />
        </Card>
      </motion.div>

      <motion.div variants={staggerContainer} className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <motion.div variants={staggerItem}>
          <StatCard label="Booked" value={bookedCount} icon={CalendarCheck} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard label="Won" value={wonCount} icon={Sparkles} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard label="Revenue protected" value={formatPrice(revenue)} icon={PoundSterling} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard label="Team members" value={staffCount} />
        </motion.div>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card className="mb-6 p-5">
          <div className="mb-4 text-sm font-semibold text-foreground">Where things stand right now</div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {stageCounts.map((s, i) => (
              <div key={s.stage} className="flex items-center gap-2">
                <div className="text-center">
                  <div className="text-xl font-semibold" style={{ color: `rgb(var(${STATUS_COLOR_VAR[s.stage]}))` }}>
                    {s.count}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground">{s.stage}</div>
                </div>
                {i < stageCounts.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card className="mb-6 p-5">
          <div className="mb-3 text-sm font-semibold text-foreground">Assistant activity</div>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {activity.slice(0, 8).map((a) => {
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
          {activity.length > 8 && (
            <div className="mt-3">
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/activity">View all activity</Link>
              </Button>
            </div>
          )}
        </Card>
      </motion.div>

      {currentClient && (
        <motion.div variants={staggerItem}>
          <Card
            className="flex flex-wrap items-center gap-4 border-border p-5"
            style={
              whiteLabel && currentClient.brand_color
                ? {
                    background: `linear-gradient(120deg, ${currentClient.brand_color}25, ${darken(currentClient.brand_color, 40)}20)`,
                    borderColor: currentClient.brand_color + "40",
                  }
                : undefined
            }
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-background"
              style={{
                background:
                  whiteLabel && currentClient.brand_color
                    ? `linear-gradient(135deg, ${currentClient.brand_color}, ${darken(currentClient.brand_color, 40)})`
                    : "linear-gradient(135deg, #fbbf24, #a855f7)",
              }}
            >
              {currentClient.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="flex-1">
              <div className="text-lg font-semibold text-foreground">
                {whiteLabel ? currentClient.name : `AI EA for ${currentClient.name}`}
              </div>
              <div className="text-xs text-muted-foreground">
                AI Assistant: {currentClient.assistant_name} · {staffCount} team members · {currentClient.vertical}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setWhiteLabel((v) => !v)}>
              <Palette className="h-3.5 w-3.5" />
              {whiteLabel ? `Viewing as ${currentClient.name}'s brand` : "Preview white-label"}
            </Button>
            <span className="flex items-center gap-1.5 rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1 text-xs text-green-400">
              <Wifi className="h-3.5 w-3.5" /> Live
            </span>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
