"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { SUGGESTION_META } from "@/lib/suggestions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LeadSuggestion } from "@/types";

/** Dashboard teaser for real leakage-detection results -- read-only, links into the Approval Queue for action. */
export default function LeakageCard({ suggestions }: { suggestions: (LeadSuggestion & { leads: { name: string | null } | null })[] }) {
  if (suggestions.length === 0) return null;

  const byType = new Map<string, number>();
  suggestions.forEach((s) => byType.set(s.type, (byType.get(s.type) ?? 0) + 1));

  return (
    <Card
      className="mb-6 p-5"
      style={{ borderColor: "rgba(var(--color-risk), 0.25)", background: "rgba(var(--color-risk), 0.05)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" style={{ color: "rgb(var(--color-risk))" }} />
        <div className="text-sm font-semibold text-foreground">Opportunities at risk</div>
      </div>
      <div className="mb-3 space-y-1.5">
        {Array.from(byType.entries()).map(([type, count]) => {
          const meta = SUGGESTION_META[type as keyof typeof SUGGESTION_META];
          const Icon = meta.icon;
          return (
            <div key={type} className="flex items-center gap-2 text-sm text-foreground">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <strong>{count}</strong> {meta.label.toLowerCase()}
            </div>
          );
        })}
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href="/dashboard/messages?tab=approval">
          Review Approval Queue <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </Card>
  );
}
