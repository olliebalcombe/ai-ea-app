"use client";

import { motion } from "framer-motion";
import { Phone, MapPin } from "lucide-react";
import { staggerContainer, staggerItem, hoverLift } from "@/lib/motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DateTile from "@/components/DateTile";

export interface ScheduleItem {
  id: string;
  customer: string;
  service: string | null;
  time: string | null;
  date: string | null;
  phone: string | null;
  postcode: string | null;
}

/** Adaptive: a single condensed line when nothing's scheduled, an horizontal scrolling strip of compact chips otherwise -- keeps the single-screen Dashboard from growing taller on a busy day. */
export default function TodaySchedule({ items }: { items: ScheduleItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No site visits or appointments scheduled today.</p>;
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1"
    >
      {items.map((item) => (
        <motion.div key={item.id} variants={staggerItem} whileHover={hoverLift} className="shrink-0">
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
                <Button size="icon" variant="ghost" className="h-6 w-6" asChild title="Call">
                  <a href={`tel:${item.phone}`}>
                    <Phone className="h-3 w-3" />
                  </a>
                </Button>
              )}
              {item.postcode && (
                <Button size="icon" variant="ghost" className="h-6 w-6" asChild title="Directions">
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
