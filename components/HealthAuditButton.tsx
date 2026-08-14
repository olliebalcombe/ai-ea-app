"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldAlert, ArrowRight } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface Finding {
  label: string;
  detail: string;
  href: string;
}

export default function HealthAuditButton() {
  const { currentClientId, currentClient } = useCurrentClient();
  const assistantName = currentClient?.assistant_name ?? "your assistant";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [findings, setFindings] = useState<Finding[]>([]);

  async function runAudit() {
    if (!currentClientId) return;
    setLoading(true);
    const found: Finding[] = [];
    const today = new Date().toISOString().slice(0, 10);

    const [{ count: unassignedCount }, { count: staleCount }, { data: kb }, { count: staffCount }, { count: serviceCount }] =
      await Promise.all([
        supabaseBrowser
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("client_id", currentClientId)
          .in("status", ["Qualified", "Booked"])
          .is("assigned_staff_id", null),
        supabaseBrowser
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("client_id", currentClientId)
          .eq("status", "Booked")
          .lt("booking_date", today),
        supabaseBrowser.from("knowledge_base_entries").select("category").eq("client_id", currentClientId),
        supabaseBrowser.from("staff").select("id", { count: "exact", head: true }).eq("client_id", currentClientId),
        supabaseBrowser.from("services").select("id", { count: "exact", head: true }).eq("client_id", currentClientId),
      ]);

    if (unassignedCount && unassignedCount > 0) {
      found.push({
        label: `${unassignedCount} unassigned lead${unassignedCount > 1 ? "s" : ""}`,
        detail: "Qualified or Booked leads with nobody assigned yet.",
        href: "/dashboard/leads",
      });
    }
    if (staleCount && staleCount > 0) {
      found.push({
        label: `${staleCount} stale booking${staleCount > 1 ? "s" : ""}`,
        detail: "Booked leads whose appointment date has already passed without a status update.",
        href: "/dashboard/bookings",
      });
    }
    const categories = new Set((kb ?? []).map((k) => k.category));
    if (!categories.has("pricing_rule")) {
      found.push({
        label: "No pricing rules in Knowledge Base",
        detail: `${assistantName} has nothing to ground pricing conversations in.`,
        href: "/dashboard/business-memory",
      });
    }
    if (!categories.has("faq")) {
      found.push({
        label: "No FAQs in Knowledge Base",
        detail: "Common customer questions have no grounded answers configured.",
        href: "/dashboard/business-memory",
      });
    }
    if (!staffCount) {
      found.push({
        label: "No staff configured",
        detail: "Bookings can't be assigned to anyone.",
        href: "/dashboard/settings/staff",
      });
    }
    if (!serviceCount) {
      found.push({
        label: "No services configured",
        detail: `${assistantName} has no services to qualify leads against.`,
        href: "/dashboard/settings/services",
      });
    }

    setFindings(found);
    setLoading(false);
  }

  useEffect(() => {
    runAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClientId]);

  const healthy = !loading && findings.length === 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          loading
            ? "border-white/10 bg-secondary/30 text-muted-foreground"
            : healthy
            ? "border-green-500/25 bg-green-500/10 text-green-400 hover:bg-green-500/15"
            : "border-amber-500/25 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15"
        )}
      >
        {healthy ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
        {loading ? "Checking…" : healthy ? "Healthy" : `${findings.length} issue${findings.length > 1 ? "s" : ""}`}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{assistantName}'s Pre-flight Health Audit</SheetTitle>
            <SheetDescription>
              Real checks against your data — unassigned work, gaps in the knowledge base, and stale
              bookings {assistantName} can't resolve on its own.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-2">
            {findings.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-sm text-green-400">
                <ShieldCheck className="h-4 w-4" /> No operational gaps found.
              </div>
            ) : (
              findings.map((f, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setOpen(false);
                    router.push(f.href);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 text-left transition-colors hover:bg-amber-500/[0.1]"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{f.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{f.detail}</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
