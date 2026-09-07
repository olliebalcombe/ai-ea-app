import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiItem {
  label: string;
  value: string;
  icon?: LucideIcon;
  colorVar?: string;
}

/** Compact metric cluster with subtle dividers -- deliberately not 3 separate large cards, per the "elegant, not decorative" brief. */
export default function KpiCluster({ items, className }: { items: KpiItem[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-white/5 bg-white/[0.015] px-5 py-3", className)}>
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className={cn("flex items-center gap-2", i > 0 && "border-l border-white/10 pl-6")}>
            {Icon && (
              <Icon
                className="h-4 w-4 shrink-0"
                style={{ color: item.colorVar ? `rgb(var(${item.colorVar}))` : undefined }}
                aria-hidden="true"
              />
            )}
            <div>
              <div className="text-base font-semibold tabular-nums leading-tight text-foreground">{item.value}</div>
              <div className="text-[11px] leading-tight text-muted-foreground">{item.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
