"use client";

import { useState } from "react";
import { Zap, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import SimulateLeadDrawer from "@/components/SimulateLeadDrawer";
import CommandPalette from "@/components/CommandPalette";
import LiveActivityTicker from "@/components/LiveActivityTicker";
import HealthAuditButton from "@/components/HealthAuditButton";
import { useSandbox } from "@/lib/sandboxContext";

export default function DashboardHeader() {
  const [open, setOpen] = useState(false);
  const { sandbox, setSandbox } = useSandbox();

  return (
    <div className="shrink-0 border-b border-white/10 bg-background/60 backdrop-blur-md">
      <header className="flex h-16 items-center justify-between px-8">
        <CommandPalette />
        <div className="flex items-center gap-3">
          <HealthAuditButton />

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-secondary/30 px-3 py-1.5">
            <FlaskConical className={`h-3.5 w-3.5 ${sandbox ? "text-amber-400" : "text-muted-foreground"}`} />
            <span className="text-xs font-medium text-foreground">{sandbox ? "Sandbox" : "Live"}</span>
            <Switch checked={sandbox} onCheckedChange={setSandbox} />
          </div>

          <Button onClick={() => setOpen(true)} className="gap-1.5">
            <Zap className="h-4 w-4" />
            Simulate Lead
          </Button>
        </div>
        <SimulateLeadDrawer open={open} onOpenChange={setOpen} />
      </header>
      <LiveActivityTicker />
    </div>
  );
}
