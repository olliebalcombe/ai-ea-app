"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck,
  AlertTriangle,
  PoundSterling,
  CalendarClock,
  Brain,
  ArrowRight,
  MessageSquarePlus,
  ArrowLeft,
  Layers,
  Smartphone,
  Voicemail,
  ChevronDown,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { useCurrentClient } from "@/lib/clientContext";
import { useSandbox } from "@/lib/sandboxContext";
import { resolveLeadContext, type MentionResult } from "@/lib/mentions";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import MentionAutocomplete from "@/components/MentionAutocomplete";
import ViewportFrame from "@/components/ViewportFrame";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Mode =
  | "quick_booking"
  | "multi_room"
  | "escalate"
  | "price_objection"
  | "reschedule"
  | "missed_call_mobile"
  | "missed_call_landline"
  | "custom";

interface ExtractedAnswer {
  question: string;
  answer: string;
  confidence: number;
}

interface ThoughtStep {
  customerMessage: string;
  aiReply: string;
  extractedAnswers: ExtractedAnswer[];
  escalation: string | null;
}

interface Scenario {
  mode: Mode;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  successTitle: string;
  successDescription: string;
}

const PRIMARY_SCENARIOS: Scenario[] = [
  {
    mode: "quick_booking",
    icon: CalendarCheck,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    title: "Quick Site Visit Booking",
    description: "Short — a single message requesting an immediate quote and a site visit slot.",
    successTitle: "Lead booked!",
    successDescription: "A test lead was captured, qualified, and booked.",
  },
  {
    mode: "multi_room",
    icon: Layers,
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-400",
    title: "Multi-Room Renovation Inquiry",
    description: "Long — a 5-turn conversation covering material options, sq/m rates, and a sample request.",
    successTitle: "Lead booked!",
    successDescription: "A detailed renovation enquiry was qualified and booked.",
  },
  {
    mode: "escalate",
    icon: AlertTriangle,
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-400",
    title: "Customer Complaint / Escalation",
    description: "Urgent — an angry customer demands a refund or a manager callback. Tests the AI Pause & Escalation rule.",
    successTitle: "Escalated to team",
    successDescription: "A test lead was captured and flagged high-priority for manual takeover.",
  },
  {
    mode: "missed_call_mobile",
    icon: Smartphone,
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    title: "Missed Call Handoff",
    description: "A missed call from a mobile number — tests the automatic text-message recovery.",
    successTitle: "Recovery text sent",
    successDescription: "A missed mobile call was recovered with an instant text.",
  },
  {
    mode: "missed_call_landline",
    icon: Voicemail,
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-400",
    title: "Landline Missed Call",
    description: "A missed call from a landline — tests the automated outbound voice callback.",
    successTitle: "Voice callback placed",
    successDescription: "A missed landline call triggered an outbound AI voice callback.",
  },
];

const SECONDARY_SCENARIOS: Scenario[] = [
  {
    mode: "price_objection",
    icon: PoundSterling,
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    title: "Price Objection / Range Inquiry",
    description: "AI handles a pricing question, grounds the value, and still gets the booking.",
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
  const { currentClientId, currentClient } = useCurrentClient();
  const assistantName = currentClient?.assistant_name ?? "your assistant";
  const { sandbox } = useSandbox();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [thoughtStream, setThoughtStream] = useState<ThoughtStep[] | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [draft, setDraft] = useState<unknown>(null);
  const [merging, setMerging] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [realisticDelay, setRealisticDelay] = useState(false);

  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");
  const [mentionFragment, setMentionFragment] = useState<string | null>(null);
  const [resolvedMentions, setResolvedMentions] = useState<{ label: string; context: string }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function reset() {
    setThoughtStream(null);
    setRevealedCount(0);
    setLeadId(null);
    setDraft(null);
    setCustomMode(false);
    setCustomText("");
    setMentionFragment(null);
    setResolvedMentions([]);
    setMoreOpen(false);
  }

  function onCustomTextChange(value: string) {
    setCustomText(value);
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const upToCaret = value.slice(0, caret);
    const match = upToCaret.match(/@(\S*)$/);
    setMentionFragment(match ? match[1] : null);
  }

  async function selectMention(result: MentionResult) {
    const caret = textareaRef.current?.selectionStart ?? customText.length;
    const upToCaret = customText.slice(0, caret);
    const replaced = upToCaret.replace(/@\S*$/, `@${result.label} `);
    const next = replaced + customText.slice(caret);
    setCustomText(next);
    setMentionFragment(null);

    let context = result.context ?? "";
    if (result.type === "lead") context = await resolveLeadContext(result.id);
    if (context) setResolvedMentions((m) => [...m, { label: result.label, context }]);
  }

  async function runScenario(scenario: Scenario) {
    if (!currentClientId || running) return;
    setRunning(true);
    setThoughtStream(null);
    setRevealedCount(0);
    setDraft(null);
    const toastId = "simulate-lead";

    try {
      toast.loading("Running scenario against Claude…", { id: toastId });

      const res = await fetch("/api/leads/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: currentClientId, mode: scenario.mode, sandbox }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Simulation failed");

      if (realisticDelay) {
        toast.loading(`${assistantName} is processing…`, { id: toastId });
        await sleep(5000);
      }

      if (sandbox) {
        toast.success("Ran in Sandbox — review below before merging", { id: toastId });
        setDraft(data.draft);
      } else {
        toast.success(scenario.successTitle, {
          id: toastId,
          description: scenario.successDescription,
          action: {
            label: "View Lead",
            onClick: () => router.push(`/dashboard/leads/${data.lead_id}`),
          },
        });
        setLeadId(data.lead_id);
      }

      const steps: ThoughtStep[] = data.thoughtStream ?? [];
      if (steps.length > 0) {
        setThoughtStream(steps);
        for (let i = 0; i < steps.length; i++) {
          await sleep(500);
          setRevealedCount(i + 1);
        }
      } else if (!sandbox) {
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed", { id: toastId });
    } finally {
      setRunning(false);
    }
  }

  async function runCustom() {
    if (!currentClientId || running || !customText.trim()) return;
    setRunning(true);
    setThoughtStream(null);
    setRevealedCount(0);
    setDraft(null);
    const toastId = "simulate-lead";

    const promptWithContext =
      resolvedMentions.length > 0
        ? `${customText.trim()}\n\nContext:\n${resolvedMentions.map((m) => `- ${m.label}: ${m.context}`).join("\n")}`
        : customText.trim();

    try {
      toast.loading("Running custom scenario against Claude…", { id: toastId });
      const res = await fetch("/api/leads/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: currentClientId, mode: "custom", prompt: promptWithContext, sandbox }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Simulation failed");

      if (realisticDelay) {
        toast.loading(`${assistantName} is processing…`, { id: toastId });
        await sleep(5000);
      }

      if (sandbox) {
        toast.success("Ran in Sandbox — review below before merging", { id: toastId });
        setDraft(data.draft);
      } else {
        toast.success("Custom scenario complete", {
          id: toastId,
          description: "A single real exchange was captured as a test lead.",
          action: {
            label: "View Lead",
            onClick: () => router.push(`/dashboard/leads/${data.lead_id}`),
          },
        });
        setLeadId(data.lead_id);
      }

      const steps: ThoughtStep[] = data.thoughtStream ?? [];
      setThoughtStream(steps);
      setRevealedCount(steps.length);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed", { id: toastId });
    } finally {
      setRunning(false);
    }
  }

  async function mergeToProduction() {
    if (!currentClientId || !draft) return;
    setMerging(true);
    try {
      const res = await fetch("/api/leads/simulate/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: currentClientId, draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Merge failed");
      toast.success("Merged to production", {
        action: { label: "View Lead", onClick: () => router.push(`/dashboard/leads/${data.lead_id}`) },
      });
      setLeadId(data.lead_id);
      setDraft(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Simulate Lead</SheetTitle>
          <SheetDescription>
            Runs a real test lead through the pipeline against your current business — {assistantName}'s
            replies and extracted data below are genuine Claude output, not scripted.
            {sandbox
              ? " Sandbox Mode is on: nothing writes to production until you merge it."
              : " Test leads are clearly labelled in the queue."}
          </SheetDescription>
        </SheetHeader>

        {!thoughtStream && !customMode && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-secondary/20 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <div className="text-xs font-medium text-foreground">Processing Delay</div>
                  <div className="text-[10px] text-muted-foreground">
                    {realisticDelay ? "Realistic — ~5s before results appear" : "Instant — results appear as soon as they're ready"}
                  </div>
                </div>
              </div>
              <Switch checked={realisticDelay} onCheckedChange={setRealisticDelay} />
            </div>

            {PRIMARY_SCENARIOS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.mode}
                  onClick={() => runScenario(s)}
                  disabled={running}
                  className="flex w-full items-start gap-3 rounded-lg border border-white/10 bg-secondary/30 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
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

            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              More scenarios
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} />
            </button>

            {moreOpen &&
              SECONDARY_SCENARIOS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.mode}
                    onClick={() => runScenario(s)}
                    disabled={running}
                    className="flex w-full items-start gap-3 rounded-lg border border-white/10 bg-secondary/30 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
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

            <button
              onClick={() => setCustomMode(true)}
              disabled={running}
              className="flex w-full items-start gap-3 rounded-lg border border-dashed border-white/15 bg-secondary/10 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <MessageSquarePlus className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">Custom Scenario</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Write your own opening customer message — mention @lead or @kb to ground it in real data.
                </div>
              </div>
            </button>
          </div>
        )}

        {!thoughtStream && customMode && (
          <div className="mt-6 space-y-3">
            <button
              onClick={() => setCustomMode(false)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back to scenarios
            </button>

            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={customText}
                onChange={(e) => onCustomTextChange(e.target.value)}
                placeholder="e.g. Hi, I saw @lead Karen Wills mentioned pricing before — can you give me something similar for a bigger job?"
                rows={5}
              />
              {mentionFragment !== null && currentClientId && (
                <MentionAutocomplete
                  fragment={mentionFragment}
                  clientId={currentClientId}
                  onSelect={selectMention}
                />
              )}
            </div>

            {resolvedMentions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {resolvedMentions.map((m, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                  >
                    @{m.label}
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Custom scenarios run as a single real exchange — there's no scripted follow-up message the
              way the fixed scenarios have.
            </p>

            <Button size="sm" onClick={runCustom} disabled={running || !customText.trim()}>
              {running ? "Running…" : "Run Custom Scenario"}
            </Button>
          </div>
        )}

        {running && !thoughtStream && (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Brain className="h-4 w-4 animate-pulse text-primary" />
            Calling Claude turn-by-turn — this takes a few seconds…
          </div>
        )}

        {thoughtStream && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Brain className="h-4 w-4 text-primary" />
              AI Thought Stream
            </div>

            <ViewportFrame title="AI Thought Stream — live">
              <div className="space-y-2 p-3">
                {thoughtStream.slice(0, revealedCount).map((step, i) => (
                  <div key={i} className="space-y-2 rounded-lg border border-white/10 bg-secondary/20 p-3">
                    <div className="rounded-lg bg-black/20 px-3 py-2 text-sm text-foreground">
                      &ldquo;{step.customerMessage}&rdquo;
                    </div>

                    {step.extractedAnswers.length > 0 && (
                      <div className="space-y-1.5">
                        {step.extractedAnswers.map((a, j) => (
                          <div key={j} className="flex items-center gap-2 text-xs">
                            <span className="w-28 shrink-0 truncate text-muted-foreground">{a.question}</span>
                            <span className="flex-1 truncate text-foreground">{a.answer}</span>
                            <div className="flex h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.round(a.confidence * 100)}%` }}
                              />
                            </div>
                            <span className="w-8 shrink-0 text-right text-[10px] text-muted-foreground">
                              {Math.round(a.confidence * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {step.escalation && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> Escalation flagged: {step.escalation}
                      </div>
                    )}

                    <div className="flex items-start gap-1.5 text-sm">
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-foreground">{step.aiReply}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ViewportFrame>

            {revealedCount >= thoughtStream.length && draft && (
              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" onClick={mergeToProduction} disabled={merging}>
                  {merging ? "Merging…" : "Merge to production"}
                </Button>
                <Button size="sm" variant="outline" onClick={reset}>
                  Discard
                </Button>
              </div>
            )}

            {revealedCount >= thoughtStream.length && !draft && leadId && (
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => router.push(`/dashboard/leads/${leadId}`)}>
                  View Lead
                </Button>
                <Button size="sm" variant="outline" onClick={reset}>
                  Run another
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
