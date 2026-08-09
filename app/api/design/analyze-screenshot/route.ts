import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/**
 * POST /api/design/analyze-screenshot
 * Body: { client_id: string, image_base64: string, media_type: string }
 *
 * Real Claude Vision call over an in-memory screenshot (never persisted to Storage --
 * nothing needs to survive past this single analysis) that returns *interpreted*
 * design-token suggestions, not pixel-exact extraction.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clientId = body?.client_id as string | undefined;
  const imageBase64 = body?.image_base64 as string | undefined;
  const mediaType = (body?.media_type as string | undefined) ?? "image/png";

  if (!clientId || !imageBase64) {
    return NextResponse.json({ error: "client_id and image_base64 are required" }, { status: 400 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => req.cookies.get(name)?.value } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: membership } = await supabaseAdmin
    .from("client_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "not a member of this client" }, { status: 403 });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 500,
    tools: [
      {
        name: "suggest_design_tokens",
        description: "Report an interpreted, approximate design-token reading of a UI screenshot.",
        input_schema: {
          type: "object",
          properties: {
            primaryColorHex: { type: "string", description: "Dominant accent color as hex, e.g. #12e28a" },
            backgroundColorHex: { type: "string", description: "Dominant background color as hex" },
            glowIntensity: { type: "number", description: "0-1 impression of how much glow/luminous shadow the UI uses" },
            cardBlur: { type: "number", description: "Approximate backdrop blur in px used on cards/panels, 0 if none" },
            borderOpacity: { type: "number", description: "0-1 impression of how visible card borders are" },
            description: { type: "string", description: "One or two sentence plain-English description of the style" },
          },
          required: ["primaryColorHex", "backgroundColorHex", "glowIntensity", "cardBlur", "borderOpacity", "description"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "suggest_design_tokens" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: imageBase64 },
          },
          {
            type: "text",
            text: "Look at this UI screenshot (e.g. a Framer, Linear, or other product site) and give an approximate, interpreted reading of its visual design tokens using the suggest_design_tokens tool -- this is a starting point for a theme, not exact color-picking.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return NextResponse.json({ error: "Claude did not return a structured suggestion" }, { status: 502 });

  return NextResponse.json({ suggestion: toolUse.input });
}
