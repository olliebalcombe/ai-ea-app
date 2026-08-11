"use client";

import { useEffect, useState } from "react";
import { PoundSterling, TrendingUp, Award } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { Card } from "@/components/ui/card";
import StatCard from "@/components/StatCard";
import type { Lead, ManualBooking, Staff, Category } from "@/types";

type LeadRow = Lead & { categories: { name: string } | null };

const HOUR_BUCKETS = [
  { label: "6-9am", from: 6, to: 9 },
  { label: "9-12pm", from: 9, to: 12 },
  { label: "12-3pm", from: 12, to: 15 },
  { label: "3-6pm", from: 15, to: 18 },
  { label: "6-9pm", from: 18, to: 21 },
  { label: "9pm+", from: 21, to: 24 },
];

// Derived from the client's own --primary-rgb (set by Design Studio) at
// varying opacity, rather than hardcoded hues, so this actually follows
// whatever theme/preset the business has picked instead of ignoring it.
const BAR_OPACITIES = [1, 0.75, 0.55, 0.4, 0.28];
function barColor(i: number) {
  return `rgba(var(--primary-rgb, 18, 226, 138), ${BAR_OPACITIES[i % BAR_OPACITIES.length]})`;
}

function fmtGBP(pence: number) {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

function respLabel(sec: number) {
  if (sec <= 60) return `${sec}s`;
  if (sec <= 300) return `${Math.round(sec / 60)}m ${sec % 60}s`;
  return `${Math.round(sec / 60)}m`;
}

const chartTooltip = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  },
};

export default function ReportsPage() {
  const { currentClientId } = useCurrentClient();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [manual, setManual] = useState<ManualBooking[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentClientId) return;
    setLoading(true);
    Promise.all([
      supabaseBrowser
        .from("leads")
        .select("*, categories:category_id(name)")
        .eq("client_id", currentClientId),
      supabaseBrowser.from("manual_bookings").select("*").eq("client_id", currentClientId),
      supabaseBrowser.from("staff").select("*").eq("client_id", currentClientId),
      supabaseBrowser.from("categories").select("*").eq("client_id", currentClientId),
    ]).then(([leadsRes, manualRes, staffRes, catsRes]) => {
      setLeads((leadsRes.data as unknown as LeadRow[]) ?? []);
      setManual((manualRes.data as ManualBooking[]) ?? []);
      setStaffList((staffRes.data as Staff[]) ?? []);
      setCategories((catsRes.data as Category[]) ?? []);
      setLoading(false);
    });
  }, [currentClientId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const now = new Date();
  const thisMonthLeads = leads.filter((l) => {
    const d = new Date(l.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const revenue = leads
    .filter((l) => l.status === "Booked" || l.status === "Won")
    .reduce((sum, l) => sum + (l.price_pence ?? 0), 0);
  const won = leads.filter((l) => l.status === "Won").length;
  const lostCount = leads.filter((l) => l.status === "Lost").length;
  const winRate = won + lostCount > 0 ? Math.round((won / (won + lostCount)) * 100) : 0;
  const responded = leads.filter((l) => l.response_seconds != null);
  const avgResp =
    responded.length > 0
      ? Math.round(responded.reduce((a, l) => a + (l.response_seconds ?? 0), 0) / responded.length)
      : 0;

  const byCategory = categories.map((c) => ({
    category: c.name,
    count: leads.filter((l) => l.category_id === c.id).length,
  }));

  const byStaff = staffList.map((s) => ({
    staff: s.name.split(" ")[0],
    count:
      leads.filter((l) => l.assigned_staff_id === s.id).length +
      manual.filter((m) => m.staff_id === s.id).length,
  }));

  const hourData = HOUR_BUCKETS.map((b) => ({
    hour: b.label,
    count: leads.filter((l) => {
      const h = new Date(l.created_at).getHours();
      return h >= b.from && h < b.to;
    }).length,
  }));

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const respTrend = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayLeads = leads.filter((l) => {
      const ld = new Date(l.created_at);
      return ld.toDateString() === d.toDateString() && l.response_seconds != null;
    });
    const avg =
      dayLeads.length > 0
        ? Math.round(dayLeads.reduce((a, l) => a + (l.response_seconds ?? 0), 0) / dayLeads.length)
        : 0;
    return { day: d.toLocaleDateString("en-GB", { weekday: "short" }), secs: avg };
  });

  const topCategory = byCategory.length
    ? byCategory.reduce((a, b) => (b.count > a.count ? b : a), byCategory[0])
    : null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">Reports</h1>

      <Card className="glow-ring mb-6 flex items-center gap-4 border-amber-500/20 bg-gradient-to-br from-amber-500/[0.08] to-purple-500/[0.05] p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-purple-500">
          <PoundSterling className="h-5 w-5 text-background" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Revenue protected this month</div>
          <div className="text-2xl font-semibold text-amber-400">{fmtGBP(revenue)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            from bookings the AI EA captured that would otherwise likely have been missed
          </div>
        </div>
      </Card>

      <Card className="mb-6 flex flex-wrap items-center gap-6 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-green-500/25 bg-green-500/10">
          <TrendingUp className="h-5 w-5 text-green-400" />
        </div>
        <div className="min-w-[200px] flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Performance fee preview</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            an optional pricing model — a share of revenue protected, on top of the base retainer
          </div>
        </div>
        <div className="flex gap-6">
          {[5, 10, 15].map((pct) => (
            <div key={pct} className="text-center">
              <div className="text-lg font-semibold text-green-400">{fmtGBP(revenue * (pct / 100))}</div>
              <div className="text-[10px] text-muted-foreground">at {pct}%</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Leads this month" value={thisMonthLeads.length} />
        <StatCard label="Win rate" value={`${winRate}%`} />
        <StatCard label="Lost" value={lostCount} />
        <StatCard label="Avg. response" value={responded.length > 0 ? respLabel(avgResp) : "—"} />
      </div>

      {topCategory && topCategory.count > 0 && (
        <Card className="mb-6 flex items-center gap-3 p-4">
          <Award className="h-4 w-4 text-purple-400" />
          <div className="text-sm text-foreground">
            <strong>{topCategory.category}</strong> is your best-performing job type this month, with{" "}
            <strong>{topCategory.count}</strong> enquiries.
          </div>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glow-hover p-5">
          <div className="mb-4 text-sm font-semibold text-foreground">Leads by job type</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10.5 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...chartTooltip} cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {byCategory.map((c, i) => (
                  <Cell key={c.category} fill={barColor(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="glow-hover p-5">
          <div className="mb-4 text-sm font-semibold text-foreground">Bookings by team member</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byStaff}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="staff" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...chartTooltip} cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar dataKey="count" fill="rgb(var(--primary-rgb, 18, 226, 138))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glow-hover p-5">
          <div className="mb-4 text-sm font-semibold text-foreground">When enquiries actually come in</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...chartTooltip} cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar dataKey="count" fill="rgba(var(--color-ai), 0.8)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="glow-hover p-5">
          <div className="mb-1 text-sm font-semibold text-foreground">Response time trend</div>
          <div className="mb-3 text-xs text-muted-foreground">average seconds to first response, last 7 days</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={respTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip {...chartTooltip} />
              <Line
                type="monotone"
                dataKey="secs"
                stroke="rgb(var(--primary-rgb, 18, 226, 138))"
                strokeWidth={2.5}
                dot={{ fill: "rgb(var(--primary-rgb, 18, 226, 138))", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
