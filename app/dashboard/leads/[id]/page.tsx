"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import StatusBadge from "@/components/StatusBadge";
import MarkLostDialog from "@/components/MarkLostDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lead, LeadAnswer, LeadMessage, LeadStatus, Staff, Service } from "@/types";

type LeadRow = Lead & {
  lead_answers: LeadAnswer[];
  staff: { name: string } | null;
  services: { name: string; price_pence: number } | null;
};

interface Slot {
  date: string;
  time: string;
}

function formatPrice(pence: number | null) {
  if (pence == null) return "—";
  return `£${(pence / 100).toFixed(2)}`;
}

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const leadId = params.id;
  const router = useRouter();
  const { currentClientId } = useCurrentClient();

  const [lead, setLead] = useState<LeadRow | null>(null);
  const [messages, setMessages] = useState<LeadMessage[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const [bookingStaffId, setBookingStaffId] = useState("");
  const [bookingServiceId, setBookingServiceId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const loadLead = useCallback(async () => {
    const { data, error } = await supabaseBrowser
      .from("leads")
      .select(
        "*, lead_answers(*), staff:assigned_staff_id(name), services:service_id(name, price_pence)"
      )
      .eq("id", leadId)
      .single();

    if (error) {
      setError(error.message);
      return;
    }
    const row = data as unknown as LeadRow;
    setLead(row);
    setNotes(row.notes ?? "");
    setBookingStaffId(row.assigned_staff_id ?? "");
    setBookingServiceId(row.service_id ?? "");
  }, [leadId]);

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabaseBrowser
      .from("lead_messages")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });
    if (!error) setMessages((data as LeadMessage[]) ?? []);
  }, [leadId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadLead(), loadMessages()]).finally(() => setLoading(false));
  }, [loadLead, loadMessages]);

  useEffect(() => {
    if (!currentClientId) return;
    supabaseBrowser
      .from("staff")
      .select("*")
      .eq("client_id", currentClientId)
      .then(({ data }) => setStaffList((data as Staff[]) ?? []));
    supabaseBrowser
      .from("services")
      .select("*")
      .eq("client_id", currentClientId)
      .then(({ data }) => setServicesList((data as Service[]) ?? []));
  }, [currentClientId]);

  async function updateStatus(status: LeadStatus, extra?: Partial<Lead>) {
    if (!lead) return;
    const { error } = await supabaseBrowser
      .from("leads")
      .update({ status, ...extra })
      .eq("id", lead.id);
    if (error) {
      setError(error.message);
      return;
    }
    setLostDialogOpen(false);
    loadLead();
  }

  async function confirmLost(reason: string | null) {
    await updateStatus("Lost", { lost_reason: reason });
  }

  async function saveNotes() {
    if (!lead) return;
    setNotesSaving(true);
    const { error } = await supabaseBrowser.from("leads").update({ notes: notes || null }).eq("id", lead.id);
    setNotesSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  async function updateAssignedStaff(staffId: string) {
    if (!lead) return;
    const { error } = await supabaseBrowser
      .from("leads")
      .update({ assigned_staff_id: staffId || null })
      .eq("id", lead.id);
    if (!error) loadLead();
  }

  async function fetchSlots() {
    if (!bookingStaffId) return;
    setSlotsLoading(true);
    setBookingError(null);
    setSlots([]);
    try {
      const res = await fetch(`/api/leads/${leadId}/book?staff_id=${bookingStaffId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load slots");
      setSlots(data.slots ?? []);
    } catch (e) {
      setBookingError(e instanceof Error ? e.message : "Failed to load slots");
    } finally {
      setSlotsLoading(false);
    }
  }

  async function confirmBooking(slot: Slot) {
    if (!bookingStaffId || !bookingServiceId) {
      setBookingError("Choose a staff member and a service first.");
      return;
    }
    setBookingError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: bookingStaffId,
          service_id: bookingServiceId,
          date: slot.date,
          time: slot.time,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Booking failed");
      setSlots([]);
      loadLead();
      loadMessages();
    } catch (e) {
      setBookingError(e instanceof Error ? e.message : "Booking failed");
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!lead) return <p className="text-sm text-muted-foreground">Lead not found.</p>;

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/dashboard/leads")}
        className="mb-4 -ml-2 text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Lead Queue
      </Button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {lead.name ?? "Unknown"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lead.phone ?? lead.email ?? "No contact info"}
          </p>
        </div>
        <StatusBadge status={lead.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.sender === "lead"
                          ? "bg-muted text-foreground"
                          : m.sender === "ai"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "mx-auto bg-amber-500/10 text-center text-amber-300"
                      }`}
                    >
                      {m.body}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {lead.lead_answers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Answers</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  {lead.lead_answers.map((a) => (
                    <div key={a.id}>
                      <dt className="text-muted-foreground">{a.question}</dt>
                      <dd className="text-foreground">{a.answer}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this lead…"
                rows={4}
              />
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" onClick={saveNotes} disabled={notesSaving}>
                  {notesSaving ? "Saving…" : "Save notes"}
                </Button>
                {notesSaved && <span className="text-xs text-green-400">Saved.</span>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(["Contacted", "Qualified", "Won"] as LeadStatus[]).map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  disabled={lead.status === s}
                  onClick={() => updateStatus(s)}
                >
                  Mark {s}
                </Button>
              ))}
              <Button
                variant="destructive"
                size="sm"
                disabled={lead.status === "Lost"}
                onClick={() => setLostDialogOpen(true)}
              >
                Mark Lost
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Assigned to</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={lead.assigned_staff_id ?? "unassigned"}
                onValueChange={(v) => updateAssignedStaff(v === "unassigned" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Book a slot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select value={bookingServiceId} onValueChange={setBookingServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a service…" />
                </SelectTrigger>
                <SelectContent>
                  {servicesList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({formatPrice(s.price_pence)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={bookingStaffId}
                onValueChange={(v) => {
                  setBookingStaffId(v);
                  setSlots([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose staff…" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={fetchSlots}
                disabled={!bookingStaffId || slotsLoading}
              >
                {slotsLoading ? "Loading slots…" : "Show available slots"}
              </Button>

              {bookingError && <p className="text-xs text-destructive">{bookingError}</p>}

              {slots.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {slots.map((slot) => (
                    <Button
                      key={`${slot.date}-${slot.time}`}
                      variant="outline"
                      size="sm"
                      onClick={() => confirmBooking(slot)}
                    >
                      {slot.date} {slot.time}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <MarkLostDialog open={lostDialogOpen} onOpenChange={setLostDialogOpen} onConfirm={confirmLost} />
    </div>
  );
}
