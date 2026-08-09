"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, AlertTriangle, PoundSterling, CalendarClock, type LucideIcon } from "lucide-react";
import { useCurrentClient } from "@/lib/clientContext";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Mode = "book" | "escalate" | "price_objection" | "reschedule";

interface Scenario {
  mode: Mode;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  steps: string[];
  successTitle: string;
  successDescription: string;
}

const SCENARIOS: Scenario[] = [
  {
    mode: "book",
    icon: CalendarCheck,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    title: "Standard Booking",
    description:
      "Captures a lead, qualifies it, picks a real staff member and service, and books a slot automatically.",
    steps: ["Capturing lead…", "Qualifying…", "Booking slot…"],
    successTitle: "Lead booked!",
    successDescription: "A test lead was captured, qualified, and booked.",
  },
  {
    mode: "escalate",
    icon: AlertTriangle,
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    title: "Complex / Custom Request",
    description: "AI identifies an edge case outside the standard flow and flags it for urgent team handoff.",
    steps: ["Capturing lead…", "Assessing request…", "Escalating to team…"],
    successTitle: "Escalated to team",
    successDescription: "A test lead was captured and flagged high-priority for manual takeover.",
  },
  {
    mode: "price_objection",
    icon: PoundSterling,
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    title: "Price Objection / Range Inquiry",
    description: "AI handles a pricing question, grounds the value, and still gets the booking.",
    steps: ["Capturing lead…", "Discussing price…", "Booking slot…"],
    successTitle: "Lead booked after price discussion",
    successDescription: "A test lead queried pricing, was reassured on value, and booked.",
  },
  {
    mode: "reschedule",
    icon: CalendarClock,
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-400",
    title: "Reschedule Request",
    description: "AI updates an existing appointment to a new slot on the calendar.",
    steps: ["Capturing lead…", "Checking availability…", "Confirming new slot…"],
    successTitle: "Appointment rescheduled",
    successDescription: "An existing booking was moved to a new date and time.",
  },
];

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

  async function run(scenario: Scenario) {
    if (!currentClientId || running) return;
    setRunning(true);
    const toastId = "simulate-lead";

    try {
      for (const step of scenario.steps) {
        toast.loading(step, { id: toastId });
        await sleep(550);
      }

      const res = await fetch("/api/leads/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: currentClientId, mode: scenario.mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Simulation failed");

      toast.success(scenario.successTitle, {
        id: toastId,
        description: scenario.successDescription,
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
          {SCENARIOS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.mode}
                onClick={() => run(s)}
                disabled={running}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border border-white/10 bg-secondary/30 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                )}
              >
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", s.iconBg)}>
                  <Icon className={cn("h-4 w-4", s.iconColor)} />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{s.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{s.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
