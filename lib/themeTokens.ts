// Shared shape for Design Studio's tweakable tokens — persisted as `clients.theme_tokens` jsonb,
// applied live as CSS custom properties on <html> (see app/globals.css for where each is consumed).

export interface ThemeTokens {
  glowIntensity: number; // 0-1
  cardBlur: number; // px
  borderOpacity: number; // 0-1
  fontScale: number; // multiplier
  bgGradientFrom: string; // rgba(...)
  bgGradientTo: string; // rgba(...)
  primary: string; // hex
}

export const DEFAULT_TOKENS: ThemeTokens = {
  glowIntensity: 0.7,
  cardBlur: 12,
  borderOpacity: 0.12,
  fontScale: 1,
  bgGradientFrom: "rgba(16, 185, 129, 0.06)",
  bgGradientTo: "rgba(16, 185, 129, 0)",
  primary: "#10B981",
};

export const PRESETS: Record<string, { label: string; description: string; tokens: ThemeTokens }> = {
  executive_glass: {
    label: "Executive Glass",
    description: "The current default — balanced glow, soft blur, green accent.",
    tokens: DEFAULT_TOKENS,
  },
  neon_cyber: {
    label: "Neon Cyber",
    description: "Near-black background, punchier neon-green glow, sharper borders.",
    tokens: {
      glowIntensity: 1,
      cardBlur: 16,
      borderOpacity: 0.22,
      fontScale: 1,
      bgGradientFrom: "rgba(0, 255, 157, 0.12)",
      bgGradientTo: "rgba(0, 255, 157, 0)",
      primary: "#00ff9d",
    },
  },
  minimal_mono: {
    label: "Minimal Mono",
    description: "Desaturated to white/zinc, minimal glow, thin quiet borders.",
    tokens: {
      glowIntensity: 0.1,
      cardBlur: 8,
      borderOpacity: 0.08,
      fontScale: 1,
      bgGradientFrom: "rgba(255, 255, 255, 0.03)",
      bgGradientTo: "rgba(255, 255, 255, 0)",
      primary: "#e4e4e7",
    },
  },
};

function hexToRgbTriplet(hex: string): string | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return null;
  return `${(num >> 16) & 0xff}, ${(num >> 8) & 0xff}, ${num & 0xff}`;
}

export function applyThemeTokens(tokens: Partial<ThemeTokens>) {
  const root = document.documentElement;
  if (tokens.glowIntensity != null) root.style.setProperty("--glow-intensity", String(tokens.glowIntensity));
  if (tokens.cardBlur != null) root.style.setProperty("--card-blur", `${tokens.cardBlur}px`);
  if (tokens.borderOpacity != null) root.style.setProperty("--border-opacity", String(tokens.borderOpacity));
  if (tokens.fontScale != null) root.style.setProperty("--font-scale", String(tokens.fontScale));
  if (tokens.bgGradientFrom != null) root.style.setProperty("--bg-gradient-from", tokens.bgGradientFrom);
  if (tokens.bgGradientTo != null) root.style.setProperty("--bg-gradient-to", tokens.bgGradientTo);
  if (tokens.primary != null) {
    root.style.setProperty("--primary", tokens.primary);
    root.style.setProperty("--ring", tokens.primary);
    const rgb = hexToRgbTriplet(tokens.primary);
    if (rgb) root.style.setProperty("--primary-rgb", rgb);
  }
}
