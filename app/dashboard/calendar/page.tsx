"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ManualBooking, Staff } from "@/types";

type BookingRow = ManualBooking & { staff: { name: string } | null; services: { name: string } | null };

const STAFF_COLORS = [
  { border: "border-l-emerald-400", bg: "bg-emerald-400/10", text: "text-emerald-300" },
  { border: "border-l-sky-400", bg: "bg-sky-400/10", text: "text-sky-300" },
  { border: "border-l-purple-400", bg: "bg-purple-400/10", text: "text-purple-300" },
  { border: "border-l-amber-400", bg: "bg-amber-400/10", text: "text-amber-300" },
  { border: "border-l-rose-400", bg: "bg-rose-400/10", text: "text-rose-300" },
  { border: "border-l-indigo-400", bg: "bg-indigo-400/10", text: "text-indigo-300" },
];

function startOfWeek(offset: number) {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const { currentClientId } = useCurrentClient();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    if (!currentClientId) return;
    setLoading(true);
    Promise.all([
      supabaseBrowser
        .from("manual_bookings")
        .select("*, staff:staff_id(name), services:service_id(name)")
        .eq("client_id", currentClientId)
        .not("booking_date", "is", null),
      supabaseBrowser.from("staff").select("*").eq("client_id", currentClientId).order("name"),
    ]).then(([bookingsRes, staffRes]) => {
      setBookings((bookingsRes.data as unknown as BookingRow[]) ?? []);
      setStaffList((staffRes.data as Staff[]) ?? []);
      setLoading(false);
    });
  }, [currentClientId]);

  const colorFor = useMemo(() => {
    const map = new Map<string, (typeof STAFF_COLORS)[number]>();
    staffList.forEach((s, i) => map.set(s.id, STAFF_COLORS[i % STAFF_COLORS.length]));
    return map;
  }, [staffList]);

  const monday = startOfWeek(weekOffset);
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const byDay = new Map<string, BookingRow[]>();
  for (const b of bookings) {
    if (!b.booking_date) continue;
    const key = b.booking_date;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(b);
  }
  Array.from(byDay.values()).forEach((list) => {
    list.sort((a, b) => (a.booking_time ?? "").localeCompare(b.booking_time ?? ""));
  });

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center text-sm text-muted-foreground">
            {monday.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
            {days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              Today
            </Button>
          )}
        </div>
      </div>

      {staffList.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {staffList.map((s) => {
            const c = colorFor.get(s.id)!;
            return (
              <span key={s.id} className={`flex items-center gap-1.5 text-xs ${c.text}`}>
                <span className={`h-2 w-2 rounded-full ${c.bg.replace("/10", "")}`} />
                {s.name}
              </span>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {days.map((d) => {
          const key = toDateKey(d);
          const dayBookings = byDay.get(key) ?? [];
          const isToday = key === toDateKey(new Date());
          return (
            <Card key={key} className={`min-h-[220px] p-3 ${isToday ? "border-primary/40" : ""}`}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {d.toLocaleDateString("en-GB", { weekday: "short" })}
              </div>
              <div className={`mb-3 text-lg font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                {d.getDate()}
              </div>
              <div className="space-y-2">
                {dayBookings.map((b) => {
                  const c = b.staff_id ? colorFor.get(b.staff_id) : undefined;
                  return (
                    <div
                      key={b.id}
                      className={`rounded-md border-l-2 px-2 py-1.5 text-xs ${c ? c.border : "border-l-muted-foreground"} ${c ? c.bg : "bg-secondary/40"}`}
                    >
                      <div className="font-medium text-foreground">
                        {b.booking_time ?? "—"} · {b.customer_name}
                      </div>
                      <div className="text-muted-foreground">{b.services?.name ?? "—"}</div>
                    </div>
                  );
                })}
                {dayBookings.length === 0 && <div className="text-xs text-muted-foreground/50">—</div>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
