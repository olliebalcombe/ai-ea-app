"use client";

import { useEffect, useState } from "react";
import { searchMentions, parseMention, type MentionResult } from "@/lib/mentions";
import { cn } from "@/lib/utils";

export default function MentionAutocomplete({
  fragment,
  clientId,
  onSelect,
}: {
  /** Raw text typed after "@", e.g. "lead karen" or "kb" */
  fragment: string;
  clientId: string;
  onSelect: (result: MentionResult) => void;
}) {
  const [results, setResults] = useState<MentionResult[]>([]);
  const { type, rest } = parseMention(fragment);

  useEffect(() => {
    if (!type || !clientId) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const r = await searchMentions(type, rest, clientId);
      setResults(r);
    }, 150);
    return () => clearTimeout(timeout);
  }, [type, rest, clientId]);

  if (!type) {
    return (
      <div className="absolute z-50 mt-1 w-64 rounded-lg border border-white/10 bg-popover p-2 text-xs text-muted-foreground shadow-xl">
        Type @lead, @kb, @booking, or @component…
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div className="absolute z-50 mt-1 max-h-56 w-72 overflow-y-auto rounded-lg border border-white/10 bg-popover p-1 shadow-xl">
      {results.map((r) => (
        <button
          key={`${r.type}-${r.id}`}
          onClick={() => onSelect(r)}
          className={cn(
            "flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
          )}
        >
          <span className="text-foreground">{r.label}</span>
          {r.sublabel && <span className="text-xs text-muted-foreground">{r.sublabel}</span>}
        </button>
      ))}
    </div>
  );
}
