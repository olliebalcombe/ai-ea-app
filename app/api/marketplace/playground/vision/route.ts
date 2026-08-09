import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/**
 * POST /api/marketplace/playground/vision
 * Body: { client_id: string, image_base64: string, media_type: string }
 *
 * Marketplace Playground for "Vision Site Inspector" -- the same real Claude
 * Vision call and prompt as /api/leads/[id]/analyze-photo, but standalone
 * (no lead, no Storage round-trip) so it can be tried before installing.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clientId = body?.client_id as string | undefined;
  const imageBase64 = body?.image_base64 as string | undefined;
  const mediaType = (body?.media_type as string | undefined) ?? "image/jpeg";

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
    max_tokens: 400,
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
            text: "This is a photo a customer sent in about a job enquiry. In 3-4 sentences: describe what's in the photo, note the likely job scope, roughly estimate materials/complexity if relevant, and flag anything that looks urgent (e.g. active leaks, damage, safety issues). Be concise and practical, like a tradesperson glancing at the photo -- no filler.",
          },
        ],
      },
    ],
  });

  const summary = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return NextResponse.json({ summary });
}
