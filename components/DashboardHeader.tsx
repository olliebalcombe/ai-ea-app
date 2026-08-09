"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import SimulateLeadDrawer from "@/components/SimulateLeadDrawer";

export default function DashboardHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-16 shrink-0 items-center justify-end border-b border-white/10 bg-background/60 px-8 backdrop-blur-md">
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Zap className="h-4 w-4" />
        Simulate Lead
      </Button>
      <SimulateLeadDrawer open={open} onOpenChange={setOpen} />
    </header>
  );
}
