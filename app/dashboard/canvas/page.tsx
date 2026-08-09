"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Zap, XCircle, CheckCheck, TrendingUp, PoundSterling, Clock } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { useSandbox } from "@/lib/sandboxContext";
import { fadeInUp } from "@/lib/motion";
import ViewportFrame from "@/components/ViewportFrame";
import AnimatedNumber from "@/components/AnimatedNumber";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Lead, LeadMessage, LeadStatus, Staff } from "@/types";

interface AfterPanel {
  status: LeadStatus;
  pricePence: number | null;
  staffName: string | null;
  aiReply: string;
}

function fmtGBP(pence: number) {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

function respLabel(sec: number) {
  if (sec <= 60) return `${sec}s`;
  if (sec <= 300) return `${Math.round(sec / 60)}m ${sec % 60}s`;
  return `${Math.round(sec / 60)}m`;
}

export default function CanvasPage() {
  const { currentClientId, currentClient } = useCurrentClient();
  const { sandbox } = useSandbox();

  const [loading, setLoading] = useState(true);
  const [allLeads, setAllLeads] = useState<Pick<Lead, "status" | "price_pence" | "response_seconds">[]>([]);
  const [wonLeads, setWonLeads] = useState<Lead[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [beforeMessage, setBeforeMessage] = useState<string | null>(null);
  const [after, setAfter] = useState<AfterPanel | null>(null);

  const [running, setRunning] = useState(false);

  const staffName = useCallback((id: string | null) => staffList.find((s) => s.id === id)?.name ?? null, [staffList]);

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const [{ data: leads }, { data: won }, { data: staff }] = await Promise.all([
      supabaseBrowser.from("leads").select("status, price_pence, response_seconds").eq("client_id", currentClientId),
      supabaseBrowser
        .from("leads")
        .select("*")
        .eq("client_id", currentClientId)
        .eq("status", "Won")
        .order("price_pence", { ascending: false })
        .limit(3),
      supabaseBrowser.from("staff").select("*").eq("client_id", currentClientId),
    ]);
    setAllLeads(leads ?? []);
    setWonLeads((won as Lead[]) ?? []);
    setStaffList((staff as Staff[]) ?? []);
    setSelectedLeadId(won && won.length > 0 ? won[0].id : null);
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedLeadId) {
      setBeforeMessage(null);
      setAfter(null);
      return;
    }
    const lead = wonLeads.find((l) => l.id === selectedLeadId);
    if (!lead) return;
    supabaseBrowser
      .from("lead_messages")
      .select("*")
      .eq("lead_id", selectedLeadId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const messages = (data as LeadMessage[]) ?? [];
        const firstLeadMsg = messages.find((m) => m.sender === "lead");
        const lastAiMsg = [...messages].reverse().find((m) => m.sender === "ai");
        setBeforeMessage(firstLeadMsg?.body ?? "(no incoming message recorded for this lead)");
        setAfter({
          status: lead.status,
          pricePence: lead.price_pence,
          staffName: staffName(lead.assigned_staff_id),
          aiReply: lastAiMsg?.body ?? "(no AI reply recorded for this lead)",
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeadId, wonLeads, staffList]);

  async function runLiveExample() {
    if (!currentClientId || running) return;
    setRunning(true);
    const toastId = "canvas-live-example";
    try {
      toast.loading("Running a live example against Claude…", { id: toastId });
      const res = await fetch("/api/leads/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: currentClientId, mode: "book", sandbox }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Simulation failed");

      setSelectedLeadId(null); // detach from the historical-lead effect above

      if (sandbox) {
        const draftMessages: { sender: string; body: string }[] = data.draft.messages ?? [];
        const firstLeadMsg = draftMessages.find((m) => m.sender === "lead");
        const lastAiMsg = [...draftMessages].reverse().find((m) => m.sender === "ai");
        setBeforeMessage(firstLeadMsg?.body ?? null);
        setAfter({
          status: data.draft.lead.status,
          pricePence: data.draft.lead.price_pence,
          staffName: staffName(data.draft.lead.assigned_staff_id),
          aiReply: lastAiMsg?.body ?? "",
        });
        toast.success("Live example ready (Sandbox — not saved)", { id: toastId });
      } else {
        const { data: lead } = await supabaseBrowser.from("leads").select("*").eq("id", data.lead_id).single();
        const { data: messages } = await supabaseBrowser
          .from("lead_messages")
          .select("*")
          .eq("lead_id", data.lead_id)
          .order("created_at", { ascending: true });
        const msgs = (messages as LeadMessage[]) ?? [];
        const firstLeadMsg = msgs.find((m) => m.sender === "lead");
        const lastAiMsg = [...msgs].reverse().find((m) => m.sender === "ai");
        setBeforeMessage(firstLeadMsg?.body ?? null);
        setAfter({
          status: lead.status,
          pricePence: lead.price_pence,
          staffName: staffName(lead.assigned_staff_id),
          aiReply: lastAiMsg?.body ?? "",
        });
        toast.success("Live example ready — saved as a real test lead", { id: toastId });
        load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed", { id: toastId });
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const revenue = allLeads
    .filter((l) => l.status === "Booked" || l.status === "Won")
    .reduce((sum, l) => sum + (l.price_pence ?? 0), 0);
  const won = allLeads.filter((l) => l.status === "Won").length;
  const lost = allLeads.filter((l) => l.status === "Lost").length;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const responded = allLeads.filter((l) => l.response_seconds != null);
  const avgResp =
    responded.length > 0
      ? Math.round(responded.reduce((a, l) => a + (l.response_seconds ?? 0), 0) / responded.length)
      : 0;

  return (
    <motion.div initial="initial" animate="animate" variants={fadeInUp}>
      <div className="mb-2">
        <h1 className="font-serifDisplay text-4xl font-normal tracking-tight text-foreground">
          Live Interactive Demo Canvas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {wonLeads.length > 0
            ? "A real enquiry from your own history, before and after the AI EA."
            : "No won jobs yet — run a live example to see the AI EA in action."}
        </p>
      </div>

      {wonLeads.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {wonLeads.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedLeadId(l.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                selectedLeadId === l.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {l.name ?? "Unknown"} · {l.price_pence ? fmtGBP(l.price_pence) : "—"}
            </button>
          ))}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <XCircle className="h-3.5 w-3.5 text-rose-400" /> Without AI EA
          </div>
          <ViewportFrame title="Missed call / unanswered text">
            <div className="space-y-3 p-4">
              {beforeMessage ? (
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2 text-sm text-foreground">
                  {beforeMessage}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No incoming message on record.</p>
              )}
              <div className="flex items-center gap-1.5 text-xs text-rose-400">
                <XCircle className="h-3.5 w-3.5" /> No reply sent — enquiry goes cold
              </div>
            </div>
          </ViewportFrame>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
            <CheckCheck className="h-3.5 w-3.5" /> With AI EA
          </div>
          <ViewportFrame title="Instant AI response" className="glow-ring">
            <div className="space-y-3 p-4">
              {after ? (
                <>
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                    {after.aiReply}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <StatusBadge status={after.status} />
                    {after.pricePence != null && (
                      <span className="rounded-full border border-green-500/25 bg-green-500/10 px-2 py-0.5 text-[11px] text-green-400">
                        {fmtGBP(after.pricePence)}
                      </span>
                    )}
                    {after.staffName && (
                      <span className="text-[11px] text-muted-foreground">assigned to {after.staffName}</span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Run a live example to see this in action.</p>
              )}
            </div>
          </ViewportFrame>
        </div>
      </div>

      <div className="mb-6 flex justify-center">
        <Button onClick={runLiveExample} disabled={running}>
          <Zap className="h-4 w-4" />
          {running ? "Running…" : "Run a live example"}
        </Button>
      </div>

      <Card className="p-5">
        <div className="mb-4 text-sm font-semibold text-foreground">
          {currentClient?.name ?? "Your business"}&apos;s real numbers
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-green-500/25 bg-green-500/10">
              <PoundSterling className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <AnimatedNumber value={Math.round(revenue / 100)} format={(n) => `£${n.toLocaleString("en-GB")}`} className="text-xl font-semibold text-foreground" />
              <div className="text-[11px] text-muted-foreground">revenue protected</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-500/25 bg-purple-500/10">
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <AnimatedNumber value={winRate} format={(n) => `${n}%`} className="text-xl font-semibold text-foreground" />
              <div className="text-[11px] text-muted-foreground">win rate</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10">
              <Clock className="h-4 w-4 text-sky-400" />
            </div>
            <div>
              <div className="text-xl font-semibold text-foreground">{responded.length > 0 ? respLabel(avgResp) : "—"}</div>
              <div className="text-[11px] text-muted-foreground">avg. response time</div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
