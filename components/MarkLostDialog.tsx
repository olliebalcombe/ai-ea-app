"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function MarkLostDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string | null) => void;
}) {
  const [reason, setReason] = useState("");

  function confirm() {
    onConfirm(reason || null);
    setReason("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark lead as lost</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="lost-reason">Reason (optional)</Label>
          <Input
            id="lost-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. went with another provider"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
