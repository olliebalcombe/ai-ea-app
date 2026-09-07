import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiItem {
  label: string;
  value: string;
  icon?: LucideIcon;
  colorVar?: string;
}

/** Three compact metric cards with a muted icon wrapper each -- same surface tokens as every other card, so Design Studio's live branding still reaches them. */
export default function KpiCluster({ items, className }: { items: KpiItem[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2.5", className)}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3"
            style={{ backgroundColor: "rgba(13, 24, 23, 0.6)" }}
          >
            {Icon && (
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{ background: item.colorVar ? `rgba(var(${item.colorVar}), 0.12)` : "rgba(255,255,255,0.06)" }}
              >
                <Icon
                  className="h-4 w-4"
                  style={{ color: item.colorVar ? `rgb(var(${item.colorVar}))` : undefined }}
                  aria-hidden="true"
                />
              </span>
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
