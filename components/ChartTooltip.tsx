/** Glassmorphic tooltip shared by every chart in the app -- shows the exact label and value(s) on hover. Originally built for the Reports page. */
export interface ChartTooltipProps {
  active?: boolean;
  payload?: { name?: string; value?: number | string }[];
  label?: string;
  unit?: string;
  formatter?: (value: number | string) => string;
}

export default function ChartTooltip({ active, payload, label, unit, formatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0D1817]/90 p-3 shadow-2xl backdrop-blur-xl">
      <div className="mb-1 text-xs font-medium text-slate-100">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-xs text-slate-400">
          {p.name ?? "Value"}:{" "}
          <span className="font-semibold text-slate-100">
            {formatter && p.value != null ? formatter(p.value) : p.value}
            {unit ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}
