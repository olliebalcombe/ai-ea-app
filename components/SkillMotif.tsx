"use client";

import { motion } from "framer-motion";
import { Star, ArrowRight, type LucideIcon } from "lucide-react";

/**
 * Purely decorative, per-skill ambient motion — never a stand-in for real
 * data. In particular, Vision Site Inspector gets a "scanning" sweep rather
 * than literal bounding boxes, since Claude Vision returns free text, not
 * detected regions — a bounding box here would look like fabricated output.
 */
export default function SkillMotif({ skillKey, fallbackIcon: Icon }: { skillKey: string; fallbackIcon: LucideIcon }) {
  if (skillKey === "voice_ai_receptionist") {
    return (
      <div className="flex h-9 items-end gap-1">
        {[0.4, 0.9, 0.6, 1, 0.5].map((h, i) => (
          <motion.span
            key={i}
            className="w-1.5 rounded-full bg-foreground/70"
            style={{ height: `${h * 36}px` }}
            animate={{ scaleY: [0.3, 1, 0.4, 0.9, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
          />
        ))}
      </div>
    );
  }

  if (skillKey === "whatsapp_ballpark_estimator") {
    return (
      <div className="relative h-16 w-24 overflow-hidden rounded-lg border border-white/15 bg-black/20 p-2">
        <div className="h-2 w-3/4 rounded bg-foreground/25" />
        <div className="mt-1.5 h-2 w-1/2 rounded bg-foreground/20" />
        <div className="mt-2 h-2.5 w-2/5 rounded bg-primary/50" />
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{ x: ["-100%", "150%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  if (skillKey === "vision_site_inspector") {
    return (
      <div className="relative h-16 w-20">
        {[
          "top-0 left-0 border-t border-l",
          "top-0 right-0 border-t border-r",
          "bottom-0 left-0 border-b border-l",
          "bottom-0 right-0 border-b border-r",
        ].map((pos) => (
          <span key={pos} className={`absolute h-3 w-3 border-foreground/50 ${pos}`} />
        ))}
        <Icon className="absolute inset-0 m-auto h-6 w-6 text-foreground/40" />
        <motion.div
          className="absolute left-0 right-0 h-0.5 bg-primary/70"
          animate={{ top: ["4%", "92%", "4%"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    );
  }

  if (skillKey === "calendar_auto_rescheduler") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 flex-col overflow-hidden rounded-md border border-white/20 bg-black/20 text-center">
          <div className="bg-foreground/20 text-[8px] leading-3">MON</div>
          <div className="flex-1 text-sm leading-6 text-muted-foreground/70 line-through">12</div>
        </div>
        <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
          <ArrowRight className="h-4 w-4 text-primary" />
        </motion.div>
        <div className="flex h-9 w-9 flex-col overflow-hidden rounded-md border border-primary/40 bg-primary/10 text-center">
          <div className="bg-primary/30 text-[8px] leading-3">FRI</div>
          <div className="flex-1 text-sm font-medium leading-6 text-primary">16</div>
        </div>
      </div>
    );
  }

  if (skillKey === "google_reviews_booster") {
    return (
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.15, repeat: Infinity, repeatDelay: 1.4, repeatType: "reverse" }}
          >
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          </motion.span>
        ))}
      </div>
    );
  }

  return <Icon className="h-9 w-9 text-foreground/80" />;
}
