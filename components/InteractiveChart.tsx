"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, LineChart as LineChartIcon } from "lucide-react";
import SegmentedControl from "@/components/SegmentedControl";
import ChartTooltip from "@/components/ChartTooltip";
import EmptyState from "@/components/EmptyState";
import { AXIS_TICK, CHART_MARGIN } from "@/lib/chartTheme";
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

  const formatValue = (v: number | string) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return metric === "Revenue" ? `£${n.toLocaleString("en-GB")}` : metric === "Conversion Rate" ? `${n}%` : `${n}`;
  };

  if (leads.length === 0) {
    return (
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Enquiry &amp; revenue trends</h2>
        <EmptyState
          icon={LineChartIcon}
          title="Not enough data yet"
          description="Once leads start coming in, this chart will track enquiries, bookings, revenue, and conversion rate over time."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<Metric> label="Metric" options={METRICS.map((m) => ({ value: m, label: m }))} value={metric} onChange={setMetric} />
        <SegmentedControl<Period> label="Time range" size="sm" options={PERIODS.map((p) => ({ value: p, label: p }))} value={period} onChange={setPeriod} />
      </div>

      <div className="mb-3 flex items-center gap-1.5 text-sm">
        {changePct >= 0 ? (
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
        ) : (
          <TrendingDown className="h-4 w-4" style={{ color: "rgb(var(--color-risk))" }} aria-hidden="true" />
        )}
        <span className="text-foreground">
          {metric} are {changePct >= 0 ? "up" : "down"} <strong className="tabular-nums">{Math.abs(changePct)}%</strong> vs the prior period
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id="interactiveChartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--primary-rgb))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="rgb(var(--primary-rgb))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            interval={period === "30d" ? 4 : "preserveStartEnd"}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis tick={AXIS_TICK} tickFormatter={formatValue} width={metric === "Revenue" ? 55 : 35} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip formatter={formatValue} />} cursor={{ stroke: "rgb(var(--primary-rgb))", strokeOpacity: 0.3 }} />
          <Area
            type="monotone"
            dataKey="value"
            name={metric}
            stroke="rgb(var(--primary-rgb))"
            strokeWidth={2.5}
            fill="url(#interactiveChartGradient)"
            dot={{ fill: "rgb(var(--primary-rgb))", r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
