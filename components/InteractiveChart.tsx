"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types";

type Metric = "Enquiries" | "Bookings" | "Revenue" | "Conversion Rate";
type Period = "7d" | "30d" | "Quarter";

const METRICS: Metric[] = ["Enquiries", "Bookings", "Revenue", "Conversion Rate"];
const PERIODS: Period[] = ["7d", "30d", "Quarter"];

/** All series bucket by lead creation date -- a cohort view of "leads created in this window," consistent across every metric. */
function bucketsFor(period: Period): { label: string; from: Date; to: Date }[] {
  const now = new Date();
  const buckets: { label: string; from: Date; to: Date }[] = [];
  if (period === "Quarter") {
    for (let i = 12; i >= 0; i--) {
      const to = new Date(now);
      to.setDate(to.getDate() - i * 7);
      const from = new Date(to);
      from.setDate(from.getDate() - 7);
      buckets.push({ label: `${13 - i}`, from, to });
    }
  } else {
    const days = period === "7d" ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const to = new Date(now);
      to.setDate(to.getDate() - i);
      to.setHours(23, 59, 59, 999);
      const from = new Date(to);
      from.setHours(0, 0, 0, 0);
      buckets.push({ label: from.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), from, to });
    }
  }
  return buckets;
}

function metricValue(metric: Metric, leadsInBucket: Lead[]): number {
  if (metric === "Enquiries") return leadsInBucket.length;
  if (metric === "Bookings") return leadsInBucket.filter((l) => l.status === "Booked" || l.status === "Won").length;
  if (metric === "Revenue") {
    return Math.round(
      leadsInBucket.filter((l) => l.status === "Booked" || l.status === "Won").reduce((s, l) => s + (l.price_pence ?? 0), 0) / 100
    );
  }
  const won = leadsInBucket.filter((l) => l.status === "Won").length;
  const lost = leadsInBucket.filter((l) => l.status === "Lost").length;
  return won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
}

/** Metric x period toggle chart, computed entirely from real leads already loaded by the caller -- no fetch of its own. */
export default function InteractiveChart({ leads }: { leads: Lead[] }) {
  const [metric, setMetric] = useState<Metric>("Enquiries");
  const [period, setPeriod] = useState<Period>("30d");

  const { data, changePct } = useMemo(() => {
    const buckets = bucketsFor(period);
    const series = buckets.map((b) => {
      const inBucket = leads.filter((l) => {
        const t = new Date(l.created_at).getTime();
        return t >= b.from.getTime() && t <= b.to.getTime();
      });
      return { label: b.label, value: metricValue(metric, inBucket) };
    });

    const half = Math.floor(series.length / 2);
    const recentSum = series.slice(half).reduce((s, p) => s + p.value, 0);
    const priorSum = series.slice(0, half).reduce((s, p) => s + p.value, 0);
    const pct = priorSum > 0 ? Math.round(((recentSum - priorSum) / priorSum) * 100) : recentSum > 0 ? 100 : 0;

    return { data: series, changePct: pct };
  }, [leads, metric, period]);

  const formatValue = (v: number) =>
    metric === "Revenue" ? `£${v.toLocaleString("en-GB")}` : metric === "Conversion Rate" ? `${v}%` : `${v}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                metric === m ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                period === p ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-1.5 text-sm">
        {changePct >= 0 ? (
          <TrendingUp className="h-4 w-4 text-primary" />
        ) : (
          <TrendingDown className="h-4 w-4" style={{ color: "rgb(var(--color-risk))" }} />
        )}
        <span className="text-foreground">
          {metric} are {changePct >= 0 ? "up" : "down"} <strong>{Math.abs(changePct)}%</strong> vs the prior period
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10.5 }}
            interval={period === "30d" ? 4 : "preserveStartEnd"}
          />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={formatValue} width={metric === "Revenue" ? 55 : 35} />
          <Tooltip
            formatter={(v: number) => [formatValue(v), metric]}
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="rgb(var(--primary-rgb, 16, 185, 129))"
            strokeWidth={2.5}
            dot={{ fill: "rgb(var(--primary-rgb, 16, 185, 129))", r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
