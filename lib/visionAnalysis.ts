import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/**
 * Downloads an already-uploaded image from Supabase Storage, sends it to
 * Claude as a real vision request, and writes the summary back to
 * lead_media.ai_summary. Shared by the staff-side analyze-photo route and
 * the public portal upload route -- same real analysis either way, just
 * different auth wrapped around the call site.
 */
export async function analyzeLeadPhoto(opts: { mediaId: string; path: string }): Promise<string> {
  const { data: blob, error: downloadError } = await supabaseAdmin.storage.from("lead-media").download(opts.path);
  if (downloadError || !blob) {
    throw new Error(downloadError?.message ?? "could not download image");
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

  await supabaseAdmin.from("lead_media").update({ ai_summary: summary }).eq("id", opts.mediaId);

  return summary;
}
