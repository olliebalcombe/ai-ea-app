"use client";

import { Workflow, Inbox, Sparkles, Clock, CalendarCheck, AlertTriangle, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCurrentClient } from "@/lib/clientContext";

interface Playbook {
  label: string;
  icon: LucideIcon;
  trigger: string;
  steps: string[];
  implementation: string;
}

/**
 * Read-only window into workflows the AI already runs -- not a new automation
 * engine, a transparent explanation of logic that lives in lib/leakage.ts,
 * lib/anthropic.ts, lib/prompts.ts, and the sms/email/voice webhooks today.
 */
function buildPlaybooks(assistantName: string): Playbook[] {
  return [
    {
      label: "New enquiry handling",
      icon: Inbox,
      trigger: "A call, text, or email comes in from a new or existing lead.",
      steps: [
        "The webhook creates or finds the lead and logs the inbound message.",
        `${assistantName} replies grounded in Business Memory — pricing rules, FAQs, service areas, and the hard rules it must never break.`,
        "Voice calls that go unanswered route to SMS (mobile callers) or an automated voice callback (landline callers).",
      ],
      implementation: "app/api/webhooks/twilio/sms, .../email, .../voice · lib/prompts.ts buildSystemPrompt()",
    },
    {
      label: "Lead qualification",
      icon: Sparkles,
      trigger: "Every inbound message from a lead in the flooring vertical.",
      steps: [
        "Claude extracts room type, flooring material, area, postcode, budget fit, install timeline, and buying intent from the conversation.",
        "A discount-requested flag is set the moment a customer asks about one.",
        "Results appear live on the lead's Qualification Scorecard — no separate data entry.",
      ],
      implementation: "lib/anthropic.ts runQualificationTurn() · lib/prompts.ts buildFlooringStructuredTool() · components/QualificationScoreCard.tsx",
    },
    {
      label: "Quote follow-up",
      icon: Clock,
      trigger: "A lead with a priced quote hasn't replied in 3+ days.",
      steps: [
        "Flagged automatically as a Follow-up — no manual tracking required.",
        `${assistantName} drafts a nudge message for review, never sent without approval.`,
        "Once approved, it sends and logs a reminder against the lead's timeline.",
      ],
      implementation: "lib/leakage.ts follow_up_reminder rule · app/dashboard/follow-ups · app/api/suggestions/[id]/approve",
    },
    {
      label: "Appointment reminders",
      icon: CalendarCheck,
      trigger: "A lead wants to install within 30 days but hasn't confirmed measurements or a site visit slot.",
      steps: [
        "Flagged as a site-visit follow-up alongside quote follow-ups.",
        `${assistantName} drafts the nudge to confirm details and get a visit booked.`,
        "Approving it sends the message and logs the reminder to Assistant Activity.",
      ],
      implementation: "lib/leakage.ts site_visit_offer rule · same approval flow as Quote follow-up",
    },
    {
      label: "Complaint escalation",
      icon: AlertTriangle,
      trigger: `${assistantName} detects frustration, an objection it shouldn't handle alone, or a request to speak to a person.`,
      steps: [
        `${assistantName} immediately pauses itself on that conversation — no further automated replies.`,
        "An urgent notification goes to the business owner right away.",
        "The escalation is logged to Assistant Activity so nothing gets missed.",
      ],
      implementation: "lib/anthropic.ts escalation signal · app/api/webhooks/twilio/sms, .../email · lib/notifications.ts",
    },
  ];
}

export default function PlaybooksPage() {
  const { currentClient } = useCurrentClient();
  const assistantName = currentClient?.assistant_name ?? "your assistant";
  const PLAYBOOKS = buildPlaybooks(assistantName);
  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Workflow className="h-5 w-5" style={{ color: "rgb(var(--color-ai))" }} />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Playbooks</h1>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        The repeatable processes the AI runs on your behalf — what triggers each one, what it actually does, and where that
        logic lives. Nothing here is a simulation; every playbook maps to real code already running.
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {PLAYBOOKS.map((pb) => {
          const Icon = pb.icon;
          return (
            <Card key={pb.label} className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "rgba(var(--color-ai), 0.12)" }}
                >
                  <Icon className="h-4 w-4" style={{ color: "rgb(var(--color-ai))" }} />
                </span>
                <div className="text-sm font-semibold text-foreground">{pb.label}</div>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Trigger — </span>
                {pb.trigger}
              </p>
              <ul className="mb-3 space-y-1.5">
                {pb.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                    {step}
                  </li>
                ))}
              </ul>
              <p className="rounded-md bg-secondary/30 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
                {pb.implementation}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
