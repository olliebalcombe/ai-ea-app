import type { ToneStyle } from "@/types";

/** Client-safe display labels for ToneStyle -- shared between AI Settings and Qualifying Questions, both of which edit the same real `clients.tone_style` field. Labels only; the underlying enum values and their actual prompt behavior live in lib/prompts.ts's TONE_DESCRIPTIONS. */
export const TONE_OPTIONS: { value: ToneStyle; label: string; description: string }[] = [
  { value: "calm_direct", label: "Direct & Efficient", description: "Grounded and matter-of-fact — the default." },
  { value: "warm_friendly", label: "Warm & Professional", description: "A bit more personable, still natural." },
  { value: "formal_executive", label: "Trade Specialist", description: "Confident and knowledgeable, no slang or casual contractions." },
];
