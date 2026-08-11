"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Phone, MessageSquare, Mail, MessageCircle, ArrowRight, XCircle, UserCircle2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { staggerContainer, staggerItem, hoverLift } from "@/lib/motion";
import { waLink } from "@/lib/whatsapp";
import MarkLostDialog from "@/components/MarkLostDialog";
import LeadDetailContent from "@/components/LeadDetailContent";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Lead, LeadAnswer, LeadStatus, Category } from "@/types";

type LeadRow = Lead & {
  lead_answers: LeadAnswer[];
  staff: { name: string } | null;
  services: { name: string; price_pence: number } | null;
  categories: { name: string } | null;
};

const STATUS_FLOW: LeadStatus[] = ["New", "Contacted", "Qualified", "Booked", "Won"];

const CHANNEL_ICON = { call: Phone, sms: MessageSquare, email: Mail };

function respBadge(sec: number | null) {
  if (sec == null) return { color: "text-muted-foreground", label: "—" };
  if (sec <= 60) return { color: "text-green-400", label: `${sec}s` };
  if (sec <= 300) return { color: "text-amber-400", label: `${Math.round(sec / 60)}m ${sec % 60}s` };
  return { color: "text-rose-400", label: `${Math.round(sec / 60)}m` };
}

function formatPrice(pence: number | null) {
  if (pence == null) return null;
  return `£${(pence / 100).toFixed(2)}`;
}

export default function LeadQueuePage() {
  const { currentClientId } = useCurrentClient();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("All");
  const [lostTarget, setLostTarget] = useState<LeadRow | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const qualifiedColRef = useRef<HTMLDivElement>(null);

  async function load() {
    if (!currentClientId) return;
    setLoading(true);
    const [{ data: leadsData }, { data: catsData }] = await Promise.all([
      supabaseBrowser
        .from("leads")
        .select(
          "*, lead_answers(*), staff:assigned_staff_id(name), services:service_id(name, price_pence), categories:category_id(name)"
        )
        .eq("client_id", currentClientId)
        .neq("status", "Lost")
        .order("created_at", { ascending: false }),
      supabaseBrowser.from("categories").select("*").eq("client_id", currentClientId).order("name"),
    ]);
    setLeads((leadsData as unknown as LeadRow[]) ?? []);
    setCategories((catsData as Category[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClientId]);

  async function advance(lead: LeadRow) {
    const idx = STATUS_FLOW.indexOf(lead.status);
    const next = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    const { error } = await supabaseBrowser.from("leads").update({ status: next }).eq("id", lead.id);
    if (!error) load();
  }

  async function confirmLost(reason: string | null) {
    if (!lostTarget) return;
    await supabaseBrowser
      .from("leads")
      .update({ status: "Lost", lost_reason: reason })
      .eq("id", lostTarget.id);
    setLostTarget(null);
    load();
  }

  let filtered = leads;
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (l) => (l.name ?? "").toLowerCase().includes(q) || (l.categories?.name ?? "").toLowerCase().includes(q)
    );
  }
  if (catFilter !== "All") {
    filtered = filtered.filter((l) => l.categories?.name === catFilter);
  }

  const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
  const staleQualified = leads.filter(
    (l) => l.status === "Qualified" && new Date(l.updated_at).getTime() < thirtyMinAgo
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Lead Queue</h1>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCatFilter("All")}
            className={cn(
              "rounded-md border px-3 py-1 text-xs",
              catFilter === "All"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatFilter(c.name)}
              className={cn(
                "rounded-md border px-3 py-1 text-xs",
                catFilter === c.name
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {staleQualified.length > 0 && (
        <button
          onClick={() => qualifiedColRef.current?.scrollIntoView({ behavior: "smooth", inline: "center" })}
          className="mb-6 flex w-full items-center gap-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] p-4 text-left transition-colors hover:bg-amber-500/[0.12]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="text-sm text-foreground">
            <strong>{staleQualified.length}</strong> qualified lead{staleQualified.length > 1 ? "s" : ""} waiting on you
            for over 30 minutes — worth a look.
          </span>
          <span className="ml-auto text-xs text-amber-400">Review now →</span>
        </button>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_FLOW.map((status) => {
            const col = filtered.filter((l) => l.status === status);
            return (
              <div
                key={status}
                ref={status === "Qualified" ? qualifiedColRef : undefined}
                className="w-[260px] shrink-0"
              >
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className="text-sm font-semibold text-foreground">{status}</span>
                  <span className="text-xs text-muted-foreground">{col.length}</span>
                </div>
                <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-3">
                  {col.map((lead) => {
                    const Icon = CHANNEL_ICON[lead.channel];
                    const badge = respBadge(lead.response_seconds);
                    const isFinal = lead.status === "Won";
                    const price = formatPrice(lead.price_pence);
                    return (
                      <motion.div key={lead.id} variants={staggerItem} whileHover={hoverLift}>
                      <Card
                        onClick={() => setSelectedLeadId(lead.id)}
                        className="glow-hover cursor-pointer p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-5 w-5 items-center justify-center rounded bg-muted">
                              <Icon className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </div>
                          <span className={cn("text-xs font-semibold", badge.color)}>{badge.label}</span>
                        </div>
                        <div className="mb-1.5 truncate text-sm font-medium text-foreground">
                          {lead.name ?? "Unknown"}
                        </div>
                        <div className="mb-2 flex flex-wrap gap-1">
                          <span className="flex items-center gap-1 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-2 py-0.5 text-[10px] font-medium text-[#25D366]">
                            <MessageCircle className="h-2.5 w-2.5" /> WhatsApp
                          </span>
                          {lead.categories?.name && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {lead.categories.name}
                            </span>
                          )}
                          {price && (
                            <span className="rounded-full border border-green-500/25 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400">
                              {price}
                            </span>
                          )}
                        </div>
                        {lead.staff?.name && (
                          <div className="mb-2 flex items-center gap-1 text-[10.5px] text-green-400">
                            <UserCircle2 className="h-3 w-3" /> {lead.staff.name}
                          </div>
                        )}
                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {!isFinal && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 flex-1 text-xs"
                                onClick={() => advance(lead)}
                              >
                                Advance <ArrowRight className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setLostTarget(lead)}
                                title="Mark as lost"
                              >
                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </>
                          )}
                          {waLink(lead.phone) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => window.open(waLink(lead.phone)!, "_blank")}
                              title="Open in WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                            </Button>
                          )}
                        </div>
                      </Card>
                      </motion.div>
                    );
                  })}
                  {col.length === 0 && (
                    <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                      No leads at this stage
                    </div>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      )}

      <MarkLostDialog
        open={!!lostTarget}
        onOpenChange={(open) => !open && setLostTarget(null)}
        onConfirm={confirmLost}
      />

      <Sheet
        open={!!selectedLeadId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLeadId(null);
            load();
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {selectedLeadId && <LeadDetailContent leadId={selectedLeadId} compact />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
