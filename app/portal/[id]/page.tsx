"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Check, ImagePlus, MapPin, CalendarClock, PoundSterling } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ViewportFrame from "@/components/ViewportFrame";

interface Slot {
  date: string;
  time: string;
}

interface PortalLead {
  id: string;
  name: string | null;
  status: string;
  service: { name: string; price_pence: number } | null;
  staffName: string | null;
  price_pence: number | null;
  room_type: string | null;
  flooring_type: string | null;
  area_sqm: number | null;
  postcode: string | null;
  booking_date: string | null;
  booking_time: string | null;
  quote_approved_at: string | null;
}

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.split(",")[1] ?? "", mediaType: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fmtGBP(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export default function CustomerPortalPage() {
  const params = useParams();
  const id = params.id as string;

  const [lead, setLead] = useState<PortalLead | null>(null);
  const [business, setBusiness] = useState<{ name: string; assistantName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [postcode, setPostcode] = useState("");
  const [flooringType, setFlooringType] = useState("");
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Not found");
      setLead(data.lead);
      setBusiness(data.business);
      setPostcode(data.lead.postcode ?? "");
      setFlooringType(data.lead.flooring_type ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Not found");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveDetails() {
    setDetailsSaving(true);
    try {
      const res = await fetch(`/api/portal/${id}/confirm-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcode, flooring_type: flooringType }),
      });
      if (!res.ok) throw new Error();
      setDetailsSaved(true);
      setTimeout(() => setDetailsSaved(false), 2000);
      load();
    } catch {
      setError("Couldn't save your details — please try again.");
    } finally {
      setDetailsSaving(false);
    }
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const { base64, mediaType } = await fileToBase64(file);
      const res = await fetch(`/api/portal/${id}/upload-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, media_type: mediaType, filename: file.name }),
      });
      if (!res.ok) throw new Error();
      setUploaded(true);
    } catch {
      setError("Couldn't upload that photo — please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function loadSlots() {
    setSlotsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${id}/slots`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load times");
      setSlots(data.slots ?? []);
      setStaffId(data.staff_id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load times");
    } finally {
      setSlotsLoading(false);
    }
  }

  async function confirmSlot(slot: Slot) {
    if (!staffId) return;
    setBooking(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: staffId, date: slot.date, time: slot.time }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That slot's no longer available");
      setSlots([]);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBooking(false);
    }
  }

  async function approveQuote() {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${id}/approve-quote`, { method: "POST" });
      if (!res.ok) throw new Error();
      load();
    } catch {
      setError("Couldn't approve the quote — please try again.");
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error && !lead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <p className="text-sm text-muted-foreground">This link isn't valid or has expired.</p>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="font-serifDisplay text-3xl font-normal text-foreground">
            {business?.name ?? "Your job"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lead.name ? `Hi ${lead.name}, here's` : "Here's"} everything for your enquiry in one place.
          </p>
        </div>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        {lead.service && lead.price_pence != null && (
          <ViewportFrame title="Your quote" className="glow-ring">
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{lead.service.name}</div>
                  <div className="text-2xl font-semibold text-foreground">{fmtGBP(lead.price_pence)}</div>
                </div>
                <PoundSterling className="h-8 w-8 text-primary/50" />
              </div>
              {lead.quote_approved_at ? (
                <div className="flex items-center gap-1.5 text-sm text-primary">
                  <Check className="h-4 w-4" /> Approved — the team will be in touch to confirm next steps.
                </div>
              ) : (
                <Button onClick={approveQuote} disabled={approving} className="w-full">
                  {approving ? "Approving…" : "Approve Quote"}
                </Button>
              )}
            </div>
          </ViewportFrame>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" /> Confirm your job details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode" />
            <Input value={flooringType} onChange={(e) => setFlooringType(e.target.value)} placeholder="Flooring type (e.g. engineered oak)" />
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={saveDetails} disabled={detailsSaving}>
                {detailsSaving ? "Saving…" : "Save details"}
              </Button>
              {detailsSaved && <span className="text-xs text-primary">Saved.</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ImagePlus className="h-4 w-4 text-primary" /> Upload room photos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading…" : "Choose a photo"}
            </Button>
            {uploaded && <p className="text-xs text-primary">Photo uploaded — thanks!</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-primary" /> Book a site visit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lead.booking_date ? (
              <p className="text-sm text-foreground">
                Booked for <strong>{lead.booking_date}</strong> at <strong>{lead.booking_time}</strong>
                {lead.staffName ? ` with ${lead.staffName}` : ""}.
              </p>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={loadSlots} disabled={slotsLoading}>
                  {slotsLoading ? "Loading times…" : "Show available times"}
                </Button>
                {slots.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {slots.map((slot) => (
                      <Button key={`${slot.date}-${slot.time}`} variant="outline" size="sm" onClick={() => confirmSlot(slot)} disabled={booking}>
                        {slot.date} {slot.time}
                      </Button>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
