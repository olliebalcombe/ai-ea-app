"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Client } from "@/types";

export interface ClientMembership {
  role: "owner" | "staff";
  clients: Client;
}

interface ClientContextValue {
  memberships: ClientMembership[];
  currentClient: Client | null;
  currentClientId: string | null;
  setCurrentClientId: (id: string) => void;
  userEmail: string;
}

const ClientContext = createContext<ClientContextValue | null>(null);

const STORAGE_KEY = "ai-ea-current-client-id";

export function ClientProvider({
  memberships,
  userEmail,
  children,
}: {
  memberships: ClientMembership[];
  userEmail: string;
  children: React.ReactNode;
}) {
  const [currentClientId, setCurrentClientIdState] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const validStored = stored && memberships.some((m) => m.clients.id === stored) ? stored : null;
    setCurrentClientIdState(validStored ?? memberships[0]?.clients.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setCurrentClientId(id: string) {
    setCurrentClientIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  }

  const currentClient = memberships.find((m) => m.clients.id === currentClientId)?.clients ?? null;

  return (
    <ClientContext.Provider
      value={{ memberships, currentClient, currentClientId, setCurrentClientId, userEmail }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useCurrentClient() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useCurrentClient must be used within a ClientProvider");
  return ctx;
}
