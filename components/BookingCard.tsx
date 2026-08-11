"use client";

import { motion } from "framer-motion";
import { Sparkles, User, ClipboardList, FlaskConical, Eye, CalendarClock } from "lucide-react";
import { hoverLift } from "@/lib/motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DateTile from "@/components/DateTile";

export interface BookingCardData {
  id: string;
  customer: string;
  service: string;
  price: number;
  staffName: string | null;
  date: string | null;
  time: string | null;
  kind: "lead" | "manual";
  bookingSource: "staff" | "customer_portal" | "simulated" | null;
}

function fmtGBP(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

const SOURCE_META = {
  customer_portal: { label: "Customer Booked", icon: Sparkles, colorVar: "--color-ai" },
  staff: { label: "Staff Booked", icon: User, colorVar: "--color-info" },
  manual: { label: "Manual Entry", icon: ClipboardList, colorVar: "--color-info" },
  simulated: { label: "Simulated", icon: FlaskConical, colorVar: null },
};

function sourceMeta(data: BookingCardData) {
  if (data.kind === "manual") return SOURCE_META.manual;
  if (data.bookingSource === "customer_portal") return SOURCE_META.customer_portal;
  if (data.bookingSource === "simulated") return SOURCE_META.simulated;
  return SOURCE_META.staff;
}

export default function BookingCard({
  data,
  onViewDetails,
  onReschedule,
}: {
  data: BookingCardData;
  onViewDetails: () => void;
  onReschedule: () => void;
}) {
  const meta = sourceMeta(data);
  const Icon = meta.icon;
  const isSimulated = data.bookingSource === "simulated";

  return (
    <motion.div whileHover={hoverLift}>
      <Card
        className={`group glow-hover flex items-start gap-3 p-4 ${isSimulated ? "border-dashed opacity-80" : ""}`}
      >
        <DateTile date={data.date} time={data.time} />

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-purple-500 text-[10px] font-bold text-background">
                {initials(data.customer)}
              </div>
              <span className="truncate text-sm font-medium text-foreground">{data.customer}</span>
            </div>
            <span className="shrink-0 text-sm font-semibold text-foreground">{fmtGBP(data.price)}</span>
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              {data.service}
            </span>
            {data.staffName && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                {data.staffName}
              </span>
            )}
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={
                meta.colorVar
                  ? { background: `rgba(var(${meta.colorVar}), 0.12)`, color: `rgb(var(${meta.colorVar}))` }
                  : { background: "rgba(255,255,255,0.06)", color: "hsl(var(--muted-foreground))" }
              }
            >
              <Icon className="h-2.5 w-2.5" /> {meta.label}
            </span>
          </div>

          <div className="flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={onViewDetails}>
              <Eye className="h-3 w-3" /> View Details
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={onReschedule}>
              <CalendarClock className="h-3 w-3" /> Reschedule
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
