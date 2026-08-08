"use client";

import { useCurrentClient } from "@/lib/clientContext";

export default function ClientSwitcher() {
  const { memberships, currentClientId, setCurrentClientId } = useCurrentClient();

  if (memberships.length <= 1) return null;

  return (
    <select
      value={currentClientId ?? ""}
      onChange={(e) => setCurrentClientId(e.target.value)}
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
    >
      {memberships.map((m) => (
        <option key={m.clients.id} value={m.clients.id}>
          {m.clients.name}
        </option>
      ))}
    </select>
  );
}
