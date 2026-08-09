"use client";

import { useEffect, useState } from "react";
import { ClipboardList, CalendarPlus, MessageCircle } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { waLink } from "@/lib/whatsapp";
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
import type { Lead, ManualBooking, Staff, Service } from "@/types";

interface BookingRow {
  id: string;
  customer: string;
  service: string;
  price: number;
  staff: string;
  date: string;
  time: string;
  source: "AI EA" | "Manual";
  phone: string | null;
}

function fmtGBP(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export default function BookingsPage() {
  const { currentClientId } = useCurrentClient();
  const [leads, setLeads] = useState<(Lead & { staff: { name: string } | null; services: { name: string } | null })[]>([]);
  const [manual, setManual] = useState<(ManualBooking & { staff: { name: string } | null; services: { name: string } | null })[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        .order("created_at", { ascending: false }),
      supabaseBrowser
        .from("manual_bookings")
        .select("*, staff:staff_id(name), services:service_id(name)")
        .eq("client_id", currentClientId)
        .order("created_at", { ascending: false }),
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

  const rows: BookingRow[] = [
    ...leads.map((l) => ({
      id: l.id,
      customer: l.name ?? "Unknown",
      service: l.services?.name ?? "—",
      price: l.price_pence ?? 0,
      staff: l.staff?.name ?? "Unassigned",
      date: l.booking_date ?? "—",
      time: l.booking_time ?? "—",
      source: "AI EA" as const,
      phone: l.phone,
    })),
    ...manual.map((m) => ({
      id: m.id,
      customer: m.customer_name,
      service: m.services?.name ?? "—",
      price: m.price_pence,
      staff: m.staff?.name ?? "Unassigned",
      date: m.booking_date ?? "—",
      time: m.booking_time ?? "—",
      source: "Manual" as const,
      phone: null,
    })),
  ];
  const total = rows.reduce((sum, r) => sum + r.price, 0);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bookings</h1>
        <Button onClick={() => setFormOpen((v) => !v)}>
          <CalendarPlus className="h-4 w-4" /> Add appointment
        </Button>
      </div>

      <Card className="mb-6 flex items-center gap-3 border-indigo-500/20 bg-indigo-500/[0.05] p-4">
        <ClipboardList className="h-5 w-5 text-indigo-400" />
        <div className="text-sm text-foreground">
          Every booking, AI-sourced and manual, tracked together — total revenue:{" "}
          <span className="text-base font-semibold text-green-400">{fmtGBP(total)}</span>
        </div>
      </Card>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {formOpen && (
        <Card className="mb-6 p-5">
          <div className="mb-3 text-sm font-semibold text-foreground">
            New appointment (booked outside AI EA — walk-in, phone, referral, etc.)
          </div>
          <form onSubmit={submitBooking} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              placeholder="Customer name"
              required
            />
            <Select
              value={form.service_id}
              onValueChange={(v) => setForm((f) => ({ ...f, service_id: v }))}
            >
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
            <Input
              type="date"
              value={form.booking_date}
              onChange={(e) => setForm((f) => ({ ...f, booking_date: e.target.value }))}
            />
            <Input
              type="time"
              value={form.booking_time}
              onChange={(e) => setForm((f) => ({ ...f, booking_time: e.target.value }))}
            />
            <Input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Note (optional)"
            />
            <Button type="submit" disabled={saving} className="sm:col-span-2">
              {saving ? "Saving…" : "Save appointment"}
            </Button>
          </form>
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-4 text-sm font-semibold text-foreground">All bookings</div>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No bookings yet for this business.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{b.customer}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {b.service} · {b.staff} · {b.date !== "—" ? `${b.date} ` : ""}
                    {b.time}
                  </div>
                </div>
                {waLink(b.phone) && (
                  <button
                    onClick={() => window.open(waLink(b.phone)!, "_blank")}
                    title="Open in WhatsApp"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#25D366]/25 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </button>
                )}
                <span
                  className={
                    b.source === "Manual"
                      ? "shrink-0 rounded-full border border-purple-500/25 bg-purple-500/10 px-2.5 py-1 text-[10px] font-semibold text-purple-300"
                      : "shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300"
                  }
                >
                  {b.source}
                </span>
                <span className="w-20 shrink-0 text-right text-sm font-semibold text-green-400">
                  {fmtGBP(b.price)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
