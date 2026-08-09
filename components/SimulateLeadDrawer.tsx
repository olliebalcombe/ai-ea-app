"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, UserPlus } from "lucide-react";
import { useCurrentClient } from "@/lib/clientContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function SimulateLeadDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { currentClientId } = useCurrentClient();
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function run(mode: "book" | "escalate") {
    if (!currentClientId || running) return;
    setRunning(true);
    const toastId = "simulate-lead";

    try {
      toast.loading("Capturing lead…", { id: toastId });
      await sleep(600);
      toast.loading("Qualifying…", { id: toastId });
      await sleep(600);
      toast.loading(mode === "book" ? "Booking slot…" : "Escalating to team…", { id: toastId });

      const res = await fetch("/api/leads/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: currentClientId, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Simulation failed");

      toast.success(mode === "book" ? "Lead booked!" : "Lead escalated to team", {
        id: toastId,
        description:
          mode === "book"
            ? "A test lead was captured, qualified, and booked."
            : "A test lead was captured and flagged high-priority for manual takeover.",
        action: {
          label: "View Lead",
          onClick: () => router.push(`/dashboard/leads/${data.lead_id}`),
        },
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed", { id: toastId });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>⚡ Simulate Lead</SheetTitle>
          <SheetDescription>
            Runs a real test lead through the pipeline against your current business — useful for
            demos and QA. Test leads are clearly labelled in the queue.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => run("book")}
            disabled={running}
            className="flex w-full items-start gap-3 rounded-lg border border-white/10 bg-secondary/30 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <CalendarCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Auto-Qualify &amp; Book</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Captures a lead, qualifies it, picks a real staff member and service, and books a
                slot automatically.
              </div>
            </div>
          </button>

          <button
            onClick={() => run("escalate")}
            disabled={running}
            className="flex w-full items-start gap-3 rounded-lg border border-white/10 bg-secondary/30 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
              <UserPlus className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Qualify &amp; Pass to Team</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Captures and qualifies a lead, tags it High Priority, and hands it to the team for
                manual takeover.
              </div>
            </div>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
