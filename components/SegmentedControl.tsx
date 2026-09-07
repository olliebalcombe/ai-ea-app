"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/** Generic accessible pill-group control -- modeled on the Bookings page's Grid/Table switcher, made reusable (chart metric/period tabs, etc). */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "default",
  className,
  label,
}: {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "default" | "sm";
  className?: string;
  label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex items-center gap-0.5 rounded-md border border-border p-0.5", className)}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              size === "sm" && "px-2 py-0.5 text-[11px]",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
