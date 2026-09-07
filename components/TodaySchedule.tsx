"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Phone, MapPin, CalendarOff } from "lucide-react";
import { staggerContainer, staggerItem, hoverLift } from "@/lib/motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DateTile from "@/components/DateTile";
import EmptyState from "@/components/EmptyState";

export interface ScheduleItem {
  id: string;
  customer: string;
  service: string | null;
  time: string | null;
  date: string | null;
  phone: string | null;
  postcode: string | null;
}

/** Adaptive: a calm empty state when nothing's scheduled, a horizontal scrolling strip of compact chips otherwise -- keeps the single-screen Dashboard from growing taller on a busy day. */
export default function TodaySchedule({ items }: { items: ScheduleItem[] }) {
  const reduceMotion = useReducedMotion();

  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarOff}
        title="Nothing scheduled today"
        description="Site visits and appointments booked for today will show up here."
        className="py-6"
      />
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial={reduceMotion ? false : "initial"}
      animate="animate"
      className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1"
    >
      {items.map((item) => (
        <motion.div key={item.id} variants={staggerItem} whileHover={reduceMotion ? undefined : hoverLift} className="shrink-0">
          <Card className="glow-hover flex w-64 items-center gap-2.5 p-2.5">
            <DateTile date={item.date} time={item.time} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{item.customer}</div>
              <div className="truncate text-xs text-muted-foreground">
                {item.service ?? "—"}
                {item.postcode ? ` · ${item.postcode}` : ""}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              {item.phone && (
                <Button size="icon" variant="ghost" className="h-11 w-11 sm:h-6 sm:w-6" asChild aria-label={`Call ${item.customer}`} title="Call">
                  <a href={`tel:${item.phone}`}>
                    <Phone className="h-3 w-3" />
                  </a>
                </Button>
              )}
              {item.postcode && (
                <Button size="icon" variant="ghost" className="h-11 w-11 sm:h-6 sm:w-6" asChild aria-label={`Directions to ${item.postcode}`} title="Directions">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.postcode)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
