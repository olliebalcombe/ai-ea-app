"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import StatusBadge from "@/components/StatusBadge";
import type { Lead, LeadAnswer, LeadStatus } from "@/types";

type LeadRow = Lead & {
  lead_answers: LeadAnswer[];
  staff: { name: string } | null;
  services: { name: string; price_pence: number } | null;
};

const TABS: (LeadStatus | "All")[] = [
  "All",
  "New",
  "Contacted",
  "Qualified",
  "Booked",
  "Won",
  "Lost",
];

function formatPrice(pence: number | null) {
  if (pence == null) return "—";
  return `£${(pence / 100).toFixed(2)}`;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function LeadQueuePage() {
  const router = useRouter();
  const { currentClientId } = useCurrentClient();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");

  useEffect(() => {
    if (!currentClientId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const { data, error } = await supabaseBrowser
        .from("leads")
        .select(
          "*, lead_answers(*), staff:assigned_staff_id(name), services:service_id(name, price_pence)"
        )
        .eq("client_id", currentClientId)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        setLeads((data as unknown as LeadRow[]) ?? []);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [currentClientId]);

  const filtered = tab === "All" ? leads : leads.filter((l) => l.status === tab);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">Lead Queue</h1>

      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm ${
              tab === t
                ? "border-gray-900 font-medium text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500">
          No leads {tab !== "All" ? `with status "${tab}"` : "yet"}. New leads appear here as
          calls, texts, and emails come in.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">Channel</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Service</th>
                <th className="px-4 py-2 font-medium">Price</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{lead.name ?? "Unknown"}</div>
                    <div className="text-xs text-gray-500">{lead.phone ?? lead.email ?? ""}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{lead.channel}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lead.services?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{formatPrice(lead.price_pence)}</td>
                  <td className="px-4 py-3 text-gray-500">{timeAgo(lead.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
