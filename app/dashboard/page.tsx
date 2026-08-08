"use client";

import { useEffect, useState } from "react";
import {
  Database,
  Sparkles,
  CalendarCheck,
  Trophy,
  PoundSterling,
  ArrowRight,
  AlertTriangle,
  Palette,
  Wifi,
  Activity,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import StatCard from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Lead, Staff } from "@/types";

const STATUS_FLOW = ["New", "Contacted", "Qualified", "Booked", "Won"] as const;
const STATUS_COLOR: Record<string, string> = {
  New: "#60a5fa",
  Contacted: "#fbbf24",
  Qualified: "#c084fc",
  Booked: "#818cf8",
  Won: "#4ade80",
};

function formatPrice(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function respLabel(sec: number | null) {
  if (sec == null) return "—";
  if (sec <= 60) return `${sec}s`;
  if (sec <= 300) return `${Math.round(sec / 60)}m ${sec % 60}s`;
  return `${Math.round(sec / 60)}m`;
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
  const { currentClient, currentClientId } = useCurrentClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [whiteLabel, setWhiteLabel] = useState(false);

  useEffect(() => {
    if (!currentClientId) return;
    setLoading(true);
    Promise.all([
      supabaseBrowser
        .from("leads")
        .select("*")
        .eq("client_id", currentClientId)
        .order("created_at", { ascending: false }),
      supabaseBrowser.from("staff").select("id").eq("client_id", currentClientId),
    ]).then(([leadsRes, staffRes]) => {
      setLeads((leadsRes.data as Lead[]) ?? []);
      setStaffCount(staffRes.data?.length ?? 0);
      setLoading(false);
    });
  }, [currentClientId]);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newCount = leads.filter((l) => l.status === "New").length;
  const qualifiedCount = leads.filter((l) => l.status === "Qualified").length;
  const bookedCount = leads.filter((l) => l.status === "Booked").length;
  const wonCount = leads.filter((l) => l.status === "Won").length;
  const newThisWeek = leads.filter((l) => new Date(l.created_at).getTime() >= sevenDaysAgo).length;
  const revenue = leads
    .filter((l) => l.status === "Booked" || l.status === "Won")
    .reduce((sum, l) => sum + (l.price_pence ?? 0), 0);

  const stageCounts = STATUS_FLOW.map((s) => ({ stage: s, count: leads.filter((l) => l.status === s).length }));

  const monthBuckets = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-GB", { month: "short" }) };
  });
  const trend = monthBuckets.map((b) => ({
    month: b.label,
    leads: leads.filter((l) => {
      const d = new Date(l.created_at);
      return `${d.getFullYear()}-${d.getMonth()}` === b.key;
    }).length,
  }));

  const activity = [...leads]
    .filter((l) => l.response_seconds != null)
    .sort((a, b) => (a.response_seconds ?? 0) - (b.response_seconds ?? 0))
    .slice(0, 6);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div>
      <Card className="mb-6 border-amber-500/20 bg-gradient-to-br from-amber-500/[0.07] to-purple-500/[0.05] p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20">
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground">Good morning.</div>
            <div className="text-xs text-muted-foreground">here&apos;s everything that needs your eyes right now</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <div className="text-2xl font-semibold text-amber-400">{newCount}</div>
            <div className="text-[10.5px] text-muted-foreground">new enquiries waiting</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-rose-400">{qualifiedCount}</div>
            <div className="text-[10.5px] text-muted-foreground">need your decision</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-green-400">{bookedCount}</div>
            <div className="text-[10.5px] text-muted-foreground">booked and confirmed</div>
          </div>
        </div>
        {qualifiedCount > 0 && (
          <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {qualifiedCount} lead{qualifiedCount > 1 ? "s" : ""} qualified and waiting on you — check Lead Queue
          </div>
        )}
      </Card>

      {currentClient && (
        <Card
          className="mb-6 flex flex-wrap items-center gap-4 border-border p-5"
          style={
            whiteLabel && currentClient.brand_color
              ? {
                  background: `linear-gradient(120deg, ${currentClient.brand_color}25, ${darken(
                    currentClient.brand_color,
                    40
                  )}20)`,
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
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Total leads" value={leads.length} icon={Database} />
        <StatCard label="New (7 days)" value={newThisWeek} icon={Sparkles} />
        <StatCard label="Booked" value={bookedCount} icon={CalendarCheck} />
        <StatCard label="Won" value={wonCount} icon={Trophy} />
        <StatCard label="Revenue protected" value={formatPrice(revenue)} icon={PoundSterling} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 text-sm font-semibold text-foreground">New enquiries over time</div>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="leads" stroke="#fbbf24" strokeWidth={2.5} dot={{ fill: "#fbbf24", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <div className="mb-4 text-sm font-semibold text-foreground">Where things stand right now</div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {stageCounts.map((s, i) => (
              <div key={s.stage} className="flex items-center gap-2">
                <div className="text-center">
                  <div className="text-xl font-semibold" style={{ color: STATUS_COLOR[s.stage] }}>
                    {s.count}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground">{s.stage}</div>
                </div>
                {i < stageCounts.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-amber-400" />
          <div className="text-sm font-semibold text-foreground">Recent activity</div>
        </div>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {activity.map((l) => (
              <div key={l.id} className="flex items-center gap-3 py-2 text-xs">
                <span className="flex-1 text-foreground">
                  <strong>{l.name ?? "Unknown"}</strong> — responded in {respLabel(l.response_seconds)}
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ color: STATUS_COLOR[l.status], background: `${STATUS_COLOR[l.status]}20` }}>
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
