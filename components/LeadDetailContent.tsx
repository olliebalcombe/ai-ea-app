"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MessageCircle, CheckCheck, ImagePlus, Sparkles, Send, CalendarClock, PoundSterling, Wand2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import MarkLostDialog from "@/components/MarkLostDialog";
import ViewportFrame from "@/components/ViewportFrame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lead, LeadAnswer, LeadMedia, LeadMessage, LeadStatus, Staff, Service } from "@/types";

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

export default function LeadDetailContent({
  leadId,
  compact = false,
}: {
  leadId: string;
  compact?: boolean;
}) {
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

  const [media, setMedia] = useState<(LeadMedia & { signedUrl: string | null })[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [analysisSkippedNote, setAnalysisSkippedNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);
  const [toolbarLoading, setToolbarLoading] = useState<string | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);

  const [enabledSkills, setEnabledSkills] = useState<string[]>([]);

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

  const loadMedia = useCallback(async () => {
    const { data, error } = await supabaseBrowser
      .from("lead_media")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    if (error || !data) return;
    const withUrls = await Promise.all(
      (data as LeadMedia[]).map(async (m) => {
        const { data: signed } = await supabaseBrowser.storage.from("lead-media").createSignedUrl(m.path, 3600);
        return { ...m, signedUrl: signed?.signedUrl ?? null };
      })
    );
    setMedia(withUrls);
  }, [leadId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadLead(), loadMessages(), loadMedia()]).finally(() => setLoading(false));
  }, [loadLead, loadMessages, loadMedia]);

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
    supabaseBrowser
      .from("clients")
      .select("enabled_skills")
      .eq("id", currentClientId)
      .single()
      .then(({ data }) => setEnabledSkills((data?.enabled_skills as string[]) ?? []));
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

    if (status === "Won" && enabledSkills.includes("google_reviews_booster")) {
      fetch(`/api/leads/${lead.id}/request-review`, { method: "POST" })
        .then(() => loadMessages())
        .catch(() => {});
    }
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

  async function uploadPhoto(file: File) {
    if (!currentClientId || !lead) return;
    setUploading(true);
    setMediaError(null);
    try {
      const path = `${currentClientId}/${lead.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabaseBrowser.storage.from("lead-media").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: mediaRow, error: insertError } = await supabaseBrowser
        .from("lead_media")
        .insert({ lead_id: lead.id, path })
        .select()
        .single();
      if (insertError || !mediaRow) throw insertError ?? new Error("Failed to save media record");

      await loadMedia();

      if (!enabledSkills.includes("vision_site_inspector")) {
        setAnalysisSkippedNote("AI photo analysis is turned off — enable Vision Site Inspector in the Marketplace to turn this on.");
        return;
      }

      setAnalyzingId(mediaRow.id);

      const res = await fetch(`/api/leads/${lead.id}/analyze-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_id: mediaRow.id, path }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      await loadMedia();
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setAnalyzingId(null);
    }
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

  async function sendMessage() {
    if (!composeText.trim() || sending) return;
    setSending(true);
    setComposeError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: composeText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setComposeText("");
      loadMessages();
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function injectAvailableSlots() {
    if (!bookingStaffId) {
      setComposeError("Choose a staff member in the booking widget first.");
      return;
    }
    setToolbarLoading("slots");
    setComposeError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/book?staff_id=${bookingStaffId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load slots");
      const found: Slot[] = data.slots ?? [];
      if (found.length === 0) {
        setComposeError("No available slots found for that staff member.");
        return;
      }
      const text = `Here are some times that could work: ${found
        .slice(0, 3)
        .map((s) => `${s.date} at ${s.time}`)
        .join(", ")}. Let me know what suits you.`;
      setComposeText((t) => (t.trim() ? `${t}\n${text}` : text));
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : "Failed to load slots");
    } finally {
      setToolbarLoading(null);
    }
  }

  async function draftQuote() {
    setToolbarLoading("quote");
    setComposeError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/draft-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "quote" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Draft failed");
      setComposeText(data.text);
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setToolbarLoading(null);
    }
  }

  async function polishTone(tone: "Calm" | "Friendly" | "Direct") {
    if (!composeText.trim()) {
      setComposeError("Type a message first, then polish its tone.");
      return;
    }
    setToolbarLoading(`polish-${tone}`);
    setComposeError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/draft-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "polish", currentText: composeText, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Polish failed");
      setComposeText(data.text);
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : "Polish failed");
    } finally {
      setToolbarLoading(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!lead) return <p className="text-sm text-muted-foreground">Lead not found.</p>;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serifDisplay text-3xl font-normal tracking-tight text-foreground">
            {lead.name ?? "Unknown"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lead.phone ?? lead.email ?? "No contact info"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {waLink(lead.phone) && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#25D366]"
              onClick={() => window.open(waLink(lead.phone)!, "_blank")}
            >
              <MessageCircle className="h-3.5 w-3.5" /> Open in WhatsApp
            </Button>
          )}
          <StatusBadge status={lead.status} />
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-6", !compact && "md:grid-cols-3")}>
        <div className={cn("space-y-6", !compact && "md:col-span-2")}>
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="conversation">
                <TabsList className="mb-4">
                  <TabsTrigger value="conversation">Conversation</TabsTrigger>
                  <TabsTrigger value="media">Media {media.length > 0 && `(${media.length})`}</TabsTrigger>
                </TabsList>

                <TabsContent value="conversation" className="mt-0 space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No messages yet.</p>
                  ) : (
                    <ViewportFrame title={lead.phone ?? lead.email ?? "Conversation"}>
                    <div className="space-y-2 p-4">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${
                            m.sender === "system"
                              ? "justify-center"
                              : m.sender === "ai" || m.sender === "staff"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div className={m.sender === "system" ? "" : "max-w-[75%]"}>
                            {(m.sender === "ai" || m.sender === "staff") && (
                              <div className="mb-0.5 text-right text-[10px] font-medium text-muted-foreground">
                                {m.sender === "ai" ? "AI Assistant" : "You"}
                              </div>
                            )}
                            <div
                              className={`rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                                m.sender === "lead"
                                  ? "rounded-bl-sm bg-secondary text-foreground"
                                  : m.sender === "ai"
                                  ? "rounded-br-sm bg-primary text-primary-foreground"
                                  : m.sender === "staff"
                                  ? "rounded-br-sm border border-sky-500/30 bg-sky-500/15 text-sky-100"
                                  : "bg-amber-500/10 text-center text-xs text-amber-300"
                              }`}
                            >
                              {m.body}
                              <div
                                className={`mt-1 flex items-center justify-end gap-1 text-right text-[10px] ${
                                  m.sender === "ai" ? "text-primary-foreground/60" : "text-muted-foreground"
                                }`}
                              >
                                {new Date(m.created_at).toLocaleTimeString("en-GB", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {(m.sender === "ai" || m.sender === "staff") && (
                                  <CheckCheck className="h-3 w-3 text-sky-300" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    </ViewportFrame>
                  )}

                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={injectAvailableSlots}
                        disabled={toolbarLoading === "slots"}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {toolbarLoading === "slots" ? "Loading…" : "Inject Available Slots"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={draftQuote}
                        disabled={toolbarLoading === "quote" || !enabledSkills.includes("whatsapp_ballpark_estimator")}
                        title={
                          enabledSkills.includes("whatsapp_ballpark_estimator")
                            ? undefined
                            : "Enable WhatsApp Ballpark Estimator in the Marketplace to use this"
                        }
                      >
                        <PoundSterling className="h-3 w-3" />
                        {toolbarLoading === "quote" ? "Drafting…" : "Draft Ballpark Quote"}
                      </Button>
                      {(["Calm", "Friendly", "Direct"] as const).map((tone) => (
                        <Button
                          key={tone}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => polishTone(tone)}
                          disabled={toolbarLoading === `polish-${tone}`}
                        >
                          <Wand2 className="h-3 w-3" />
                          {toolbarLoading === `polish-${tone}` ? "Polishing…" : `${tone} Tone`}
                        </Button>
                      ))}
                    </div>

                    <Textarea
                      value={composeText}
                      onChange={(e) => setComposeText(e.target.value)}
                      placeholder="Write a reply…"
                      rows={3}
                    />
                    {composeError && <p className="text-xs text-destructive">{composeError}</p>}
                    <div className="flex justify-end">
                      <Button size="sm" onClick={sendMessage} disabled={sending || !composeText.trim()}>
                        <Send className="h-3.5 w-3.5" />
                        {sending ? "Sending…" : "Send"}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="media" className="mt-0 space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadPhoto(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    {uploading ? "Uploading…" : "Upload site photo"}
                  </Button>
                  {mediaError && <p className="text-xs text-destructive">{mediaError}</p>}
                  {analysisSkippedNote && <p className="text-xs text-muted-foreground">{analysisSkippedNote}</p>}

                  {media.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {media.map((m) => (
                        <div key={m.id} className="overflow-hidden rounded-lg border border-border">
                          {m.signedUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.signedUrl} alt="Site photo" className="h-40 w-full object-cover" />
                          )}
                          <div className="p-3">
                            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary">
                              <Sparkles className="h-3 w-3" /> AI Visual Analysis
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {m.ai_summary
                                ? m.ai_summary
                                : analyzingId === m.id
                                ? "Analyzing…"
                                : "No analysis yet."}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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
