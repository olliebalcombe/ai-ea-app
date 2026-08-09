"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { applyThemeTokens, type ThemeTokens } from "@/lib/themeTokens";

export default function ThemeTokenLoader() {
  const { currentClientId } = useCurrentClient();

  useEffect(() => {
    if (!currentClientId) return;
    supabaseBrowser
      .from("clients")
      .select("theme_tokens")
      .eq("id", currentClientId)
      .single()
      .then(({ data }) => {
        const tokens = data?.theme_tokens as Partial<ThemeTokens> | null;
        if (tokens) applyThemeTokens(tokens);
      });
  }, [currentClientId]);

  return null;
}
