import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared empty-state pattern -- icon + title + optional description, used consistently instead of ad-hoc "No X yet" text per card. */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-8 text-center", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04]">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-[28ch] text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
