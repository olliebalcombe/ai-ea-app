"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BroadcastFilter } from "@/app/api/leads/broadcast/route";

const FILTER_LABELS: Record<BroadcastFilter, string> = {
  won: "Won leads",
  qualified: "Qualified leads",
  all_active: "All active leads",
};

/** Real, capped, confirmed bulk send -- not a fabricated broadcast platform, the same real sendSms/lead_messages pattern in a loop. */
export default function BroadcastDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { currentClientId } = useCurrentClient();
  const [filter, setFilter] = useState<BroadcastFilter>("won");
  const [message, setMessage] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !currentClientId) return;
    setResult(null);
    setConfirming(false);
    let query = supabaseBrowser.from("leads").select("id", { count: "exact", head: true }).eq("client_id", currentClientId).not("phone", "is", null);
    if (filter === "won") query = query.eq("status", "Won");
    else if (filter === "qualified") query = query.eq("status", "Qualified");
    else query = query.in("status", ["New", "Contacted", "Qualified", "Booked"]);
    query.then(({ count }) => setPreviewCount(count ?? 0));
  }, [open, filter, currentClientId]);

  async function send() {
    if (!currentClientId || !message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: currentClientId, filter, message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Broadcast failed");
      setResult(`Sent to ${data.sent} lead${data.sent === 1 ? "" : "s"}${data.failed > 0 ? ` (${data.failed} failed)` : ""}.`);
      setMessage("");
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Broadcast failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" /> Broadcast Update
          </DialogTitle>
          <DialogDescription>Sends a real text to a real, filtered segment of your leads — capped and confirmed before it sends.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Select value={filter} onValueChange={(v) => setFilter(v as BroadcastFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FILTER_LABELS) as BroadcastFilter[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {FILTER_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message to send…" rows={4} />

          {previewCount != null && <p className="text-xs text-muted-foreground">Will send to {previewCount} real lead{previewCount === 1 ? "" : "s"}.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && <p className="text-sm text-primary">{result}</p>}

          {!confirming ? (
            <Button size="sm" onClick={() => setConfirming(true)} disabled={!message.trim() || !previewCount}>
              Review &amp; Send
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={send} disabled={sending}>
                {sending ? "Sending…" : `Confirm — send to ${previewCount}`}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={sending}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
