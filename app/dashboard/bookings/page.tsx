"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarPlus, LayoutGrid, Table2, PoundSterling, TrendingUp, Calculator } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LeadDetailContent from "@/components/LeadDetailContent";
import BookingCard, { type BookingCardData } from "@/components/BookingCard";
import { cn } from "@/lib/utils";
import type { Lead, ManualBooking, Staff, Service } from "@/types";

function fmtGBP(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function sortAsc(a: BookingCardData, b: BookingCardData) {
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  const dateCmp = a.date.localeCompare(b.date);
  if (dateCmp !== 0) return dateCmp;
  return (a.time ?? "").localeCompare(b.time ?? "");
}

export default function BookingsPage() {
  const { currentClientId, currentClient } = useCurrentClient();
  const assistantName = currentClient?.assistant_name ?? "your assistant";
  const [leads, setLeads] = useState<(Lead & { staff: { name: string } | null; services: { name: string } | null })[]>([]);
  const [manual, setManual] = useState<(ManualBooking & { staff: { name: string } | null; services: { name: string } | null })[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "table">("grid");

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [manualTarget, setManualTarget] = useState<(ManualBooking & { staff: { name: string } | null; services: { name: string } | null }) | null>(null);
  const [manualEditDate, setManualEditDate] = useState("");
  const [manualEditTime, setManualEditTime] = useState("");
  const [manualSaving, setManualSaving] = useState(false);

  const [form, setForm] = useState({
    customer_name: "",
    service_id: "",
    staff_id: "",
    booking_date: "",
    booking_time: "",
    note: "",
  });

  async function load() {
    if (!currentClientId) return;
    setLoading(true);
    const [leadsRes, manualRes, staffRes, servicesRes] = await Promise.all([
      supabaseBrowser
        .from("leads")
        .select("*, staff:assigned_staff_id(name), services:service_id(name)")
        .eq("client_id", currentClientId)
        .in("status", ["Booked", "Won"])
        .order("booking_date", { ascending: true }),
      supabaseBrowser
        .from("manual_bookings")
        .select("*, staff:staff_id(name), services:service_id(name)")
        .eq("client_id", currentClientId)
        .order("booking_date", { ascending: true }),
      supabaseBrowser.from("staff").select("*").eq("client_id", currentClientId),
      supabaseBrowser.from("services").select("*").eq("client_id", currentClientId),
    ]);
    setLeads((leadsRes.data as unknown as typeof leads) ?? []);
    setManual((manualRes.data as unknown as typeof manual) ?? []);
    setStaffList((staffRes.data as Staff[]) ?? []);
    setServicesList((servicesRes.data as Service[]) ?? []);
    setLoading(false);
    if (manualRes.error) setError(manualRes.error.message);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClientId]);

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!currentClientId || !form.customer_name.trim() || !form.service_id) return;
    setSaving(true);
    setError(null);
    const service = servicesList.find((s) => s.id === form.service_id);
    const { error } = await supabaseBrowser.from("manual_bookings").insert({
      client_id: currentClientId,
      customer_name: form.customer_name.trim(),
      service_id: form.service_id,
      price_pence: service?.price_pence ?? 0,
      staff_id: form.staff_id || null,
      booking_date: form.booking_date || null,
      booking_time: form.booking_time || null,
      note: form.note || null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ customer_name: "", service_id: "", staff_id: "", booking_date: "", booking_time: "", note: "" });
    setFormOpen(false);
    load();
  }

  function openManualTarget(m: typeof manual[number]) {
    setManualTarget(m);
    setManualEditDate(m.booking_date ?? "");
    setManualEditTime(m.booking_time ?? "");
  }

  async function saveManualReschedule() {
    if (!manualTarget) return;
    setManualSaving(true);
    const { error } = await supabaseBrowser
      .from("manual_bookings")
      .update({ booking_date: manualEditDate || null, booking_time: manualEditTime || null })
      .eq("id", manualTarget.id);
    setManualSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setManualTarget(null);
    load();
  }

  const cards: BookingCardData[] = [
    ...leads.map((l) => ({
      id: l.id,
      customer: l.name ?? "Unknown",
      service: l.services?.name ?? "—",
      price: l.price_pence ?? 0,
      staffName: l.staff?.name ?? null,
      date: l.booking_date,
      time: l.booking_time,
      postcode: l.postcode,
      kind: "lead" as const,
      bookingSource: l.booking_source,
    })),
    ...manual.map((m) => ({
      id: m.id,
      customer: m.customer_name,
      service: m.services?.name ?? "—",
      price: m.price_pence,
      staffName: m.staff?.name ?? null,
      date: m.booking_date,
      time: m.booking_time,
      postcode: null,
      kind: "manual" as const,
      bookingSource: null,
    })),
  ];

  const total = cards.reduce((sum, c) => sum + c.price, 0);
  const now = Date.now();
  const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;
  const upcomingThisWeek = cards.filter((c) => {
    if (!c.date) return false;
    const t = new Date(`${c.date}T00:00:00`).getTime();
    return t >= now && t <= weekFromNow;
  }).length;
  const avgJobValue = cards.length > 0 ? Math.round(total / cards.length) : 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAndUpcoming = cards.filter((c) => !c.date || c.date === todayStr).sort(sortAsc);
  const thisWeek = cards.filter((c) => c.date && c.date > todayStr).sort(sortAsc);
  const pastJobs = cards
    .filter((c) => c.date && c.date < todayStr)
    .sort((a, b) => sortAsc(b, a));
  const sections: { label: string; items: BookingCardData[] }[] = [
    { label: "Today & Upcoming", items: todayAndUpcoming },
    { label: "This Week", items: thisWeek },
    { label: "Past Jobs", items: pastJobs },
  ].filter((s) => s.items.length > 0);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bookings</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "flex items-center gap-1 rounded-md px-3 py-1.5 text-xs transition-colors",
                view === "grid" ? "bg-white/10 font-medium text-white" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Visual Cards
            </button>
            <button
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1 rounded-md px-3 py-1.5 text-xs transition-colors",
                view === "table" ? "bg-white/10 font-medium text-white" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Table2 className="h-3.5 w-3.5" /> Compact Table
            </button>
          </div>
          <Button onClick={() => setFormOpen((v) => !v)}>
            <CalendarPlus className="h-4 w-4" /> Add appointment
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="glow-hover flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "rgba(var(--primary-rgb), 0.12)" }}>
            <PoundSterling className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground">{fmtGBP(total)}</div>
            <div className="text-[11px] text-muted-foreground">Confirmed revenue</div>
          </div>
        </Card>
        <Card className="glow-hover flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "rgba(var(--color-ai), 0.12)" }}>
            <TrendingUp className="h-4 w-4" style={{ color: "rgb(var(--color-ai))" }} />
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground">{upcomingThisWeek}</div>
            <div className="text-[11px] text-muted-foreground">Upcoming this week</div>
          </div>
        </Card>
        <Card className="glow-hover flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "rgba(var(--color-info), 0.12)" }}>
            <Calculator className="h-4 w-4" style={{ color: "rgb(var(--color-info))" }} />
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground">{fmtGBP(avgJobValue)}</div>
            <div className="text-[11px] text-muted-foreground">Average job value</div>
          </div>
        </Card>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {formOpen && (
        <Card className="mb-6 p-5">
          <div className="mb-3 text-sm font-semibold text-foreground">
            New appointment ({assistantName} wasn't involved — walk-in, phone, referral, etc.)
          </div>
          <form onSubmit={submitBooking} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              placeholder="Customer name"
              required
            />
            <Select value={form.service_id} onValueChange={(v) => setForm((f) => ({ ...f, service_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select service…" />
              </SelectTrigger>
              <SelectContent>
                {servicesList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {fmtGBP(s.price_pence)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.staff_id} onValueChange={(v) => setForm((f) => ({ ...f, staff_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Assign to…" />
              </SelectTrigger>
              <SelectContent>
                {staffList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={form.booking_date} onChange={(e) => setForm((f) => ({ ...f, booking_date: e.target.value }))} />
            <Input type="time" value={form.booking_time} onChange={(e) => setForm((f) => ({ ...f, booking_time: e.target.value }))} />
            <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Note (optional)" />
            <Button type="submit" disabled={saving} className="sm:col-span-2">
              {saving ? "Saving…" : "Save appointment"}
            </Button>
          </form>
        </Card>
      )}

      {cards.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No bookings yet for this business.</Card>
      ) : view === "grid" ? (
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="mb-2.5 flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.label}</h2>
                <span className="text-xs text-muted-foreground">({section.items.length})</span>
              </div>
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {section.items.map((c) => (
                  <motion.div key={c.id} variants={staggerItem}>
                    <BookingCard
                      data={c}
                      onViewDetails={() => {
                        if (c.kind === "lead") setSelectedLeadId(c.id);
                        else openManualTarget(manual.find((m) => m.id === c.id)!);
                      }}
                      onReschedule={() => {
                        if (c.kind === "lead") setSelectedLeadId(c.id);
                        else openManualTarget(manual.find((m) => m.id === c.id)!);
                      }}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="mb-2.5 flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.label}</h2>
                <span className="text-xs text-muted-foreground">({section.items.length})</span>
              </div>
              <Card className="p-5">
                <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
                  {section.items.map((c) => (
                    <motion.div
                      key={c.id}
                      variants={staggerItem}
                      whileHover={{ y: -1, scale: 1.002 }}
                      className="glow-hover flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{c.customer}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {c.service} · {c.staffName ?? "Unassigned"} · {c.date ?? "—"} {c.time ?? ""}
                          {c.postcode && ` · ${c.postcode}`}
                        </div>
                      </div>
                      <span className="w-20 shrink-0 text-right text-sm font-semibold text-foreground">{fmtGBP(c.price)}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </Card>
            </div>
          ))}
        </div>
      )}

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

      <Dialog open={!!manualTarget} onOpenChange={(open) => !open && setManualTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{manualTarget?.customer_name}</DialogTitle>
          </DialogHeader>
          {manualTarget && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {manualTarget.services?.name ?? "—"} · {manualTarget.staff?.name ?? "Unassigned"} ·{" "}
                <span className="font-medium text-foreground">{fmtGBP(manualTarget.price_pence)}</span>
              </p>
              {manualTarget.note && <p className="text-muted-foreground">{manualTarget.note}</p>}
              <div className="flex gap-2">
                <Input type="date" value={manualEditDate} onChange={(e) => setManualEditDate(e.target.value)} />
                <Input type="time" value={manualEditTime} onChange={(e) => setManualEditTime(e.target.value)} />
              </div>
              <Button size="sm" onClick={saveManualReschedule} disabled={manualSaving}>
                {manualSaving ? "Saving…" : "Save date & time"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
