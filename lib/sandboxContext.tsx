"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface SandboxContextValue {
  sandbox: boolean;
  setSandbox: (v: boolean) => void;
}

const SandboxContext = createContext<SandboxContextValue | null>(null);

const STORAGE_KEY = "ai-ea-sandbox-mode";

export function SandboxProvider({ children }: { children: React.ReactNode }) {
  const [sandbox, setSandboxState] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    setSandboxState(stored === "true");
  }, []);

  function setSandbox(v: boolean) {
    setSandboxState(v);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, String(v));
  }

  return <SandboxContext.Provider value={{ sandbox, setSandbox }}>{children}</SandboxContext.Provider>;
}

export function useSandbox() {
  const ctx = useContext(SandboxContext);
  if (!ctx) throw new Error("useSandbox must be used within a SandboxProvider");
  return ctx;
}
