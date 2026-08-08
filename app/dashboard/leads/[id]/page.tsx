"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import StatusBadge from "@/components/StatusBadge";
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
  const [saving, setSaving] = useState(false);

  const [showLostInput, setShowLostInput] = useState(false);
  const [lostReason, setLostReason] = useState("");

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
    setSaving(true);
    const { error } = await supabaseBrowser
      .from("leads")
      .update({ status, ...extra })
      .eq("id", lead.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setShowLostInput(false);
    setLostReason("");
    loadLead();
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

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!lead) return <p className="text-sm text-gray-500">Lead not found.</p>;

  return (
    <div>
      <button
        onClick={() => router.push("/dashboard")}
        className="mb-4 text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to Lead Queue
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{lead.name ?? "Unknown"}</h1>
          <p className="text-sm text-gray-500">{lead.phone ?? lead.email ?? "No contact info"}</p>
        </div>
        <StatusBadge status={lead.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Conversation transcript */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Conversation</h2>
            {messages.length === 0 ? (
              <p className="text-sm text-gray-500">No messages yet.</p>
            ) : (
              <div className="space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.sender === "lead"
                        ? "bg-gray-100 text-gray-900"
                        : m.sender === "ai"
                        ? "ml-auto bg-gray-900 text-white"
                        : "mx-auto bg-amber-50 text-amber-800 text-center"
                    }`}
                  >
                    {m.body}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Qualifying answers */}
          {lead.lead_answers.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Answers</h2>
              <dl className="space-y-2 text-sm">
                {lead.lead_answers.map((a) => (
                  <div key={a.id}>
                    <dt className="text-gray-500">{a.question}</dt>
                    <dd className="text-gray-900">{a.answer}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Status controls */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Status</h2>
            <div className="flex flex-wrap gap-2">
              {(["Contacted", "Qualified", "Won"] as LeadStatus[]).map((s) => (
                <button
                  key={s}
                  disabled={saving || lead.status === s}
                  onClick={() => updateStatus(s)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Mark {s}
                </button>
              ))}
              <button
                disabled={saving || lead.status === "Lost"}
                onClick={() => setShowLostInput(true)}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Mark Lost
              </button>
            </div>
            {showLostInput && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus("Lost", { lost_reason: lostReason || null })}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowLostInput(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Staff assignment */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Assigned to</h2>
            <select
              value={lead.assigned_staff_id ?? ""}
              onChange={(e) => updateAssignedStaff(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Unassigned</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Booking widget */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Book a slot</h2>
            <div className="space-y-2">
              <select
                value={bookingServiceId}
                onChange={(e) => setBookingServiceId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">Choose a service…</option>
                {servicesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({formatPrice(s.price_pence)})
                  </option>
                ))}
              </select>
              <select
                value={bookingStaffId}
                onChange={(e) => {
                  setBookingStaffId(e.target.value);
                  setSlots([]);
                }}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">Choose staff…</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchSlots}
                disabled={!bookingStaffId || slotsLoading}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                {slotsLoading ? "Loading slots…" : "Show available slots"}
              </button>

              {bookingError && <p className="text-xs text-red-600">{bookingError}</p>}

              {slots.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {slots.map((slot) => (
                    <button
                      key={`${slot.date}-${slot.time}`}
                      onClick={() => confirmBooking(slot)}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-xs hover:bg-gray-50"
                    >
                      {slot.date} {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
