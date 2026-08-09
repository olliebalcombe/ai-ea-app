import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/**
 * POST /api/leads/:id/analyze-photo
 * Body: { media_id: string, path: string }
 *
 * Downloads the already-uploaded image from Supabase Storage server-side,
 * sends it to Claude as a real vision request, and writes the summary back
 * to lead_media.ai_summary. Runs with the service role (same pattern as
 * /api/leads/simulate) after verifying the caller is a member of the
 * lead's client.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const leadId = params.id;
  const body = await req.json().catch(() => null);
  const mediaId = body?.media_id as string | undefined;
  const path = body?.path as string | undefined;
  if (!mediaId || !path) return NextResponse.json({ error: "media_id and path are required" }, { status: 400 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => req.cookies.get(name)?.value } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: lead } = await supabaseAdmin.from("leads").select("id, client_id, category_id").eq("id", leadId).single();
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  const { data: membership } = await supabaseAdmin
    .from("client_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("client_id", lead.client_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "not a member of this client" }, { status: 403 });

  const { data: blob, error: downloadError } = await supabaseAdmin.storage.from("lead-media").download(path);
  if (downloadError || !blob) {
    return NextResponse.json({ error: downloadError?.message ?? "could not download image" }, { status: 500 });
  }

  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mediaType = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: base64 },
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

  await supabaseAdmin.from("lead_media").update({ ai_summary: summary }).eq("id", mediaId);

  return NextResponse.json({ summary });
}
