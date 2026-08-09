import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";

/**
 * POST /api/marketplace/playground/review-test
 * Body: { client_id: string }
 *
 * Marketplace Playground for "Google Reviews Booster". Sends the real
 * review-request message to the logged-in staff member's own email (never a
 * real customer) so they can see exactly what a customer would receive.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clientId = body?.client_id as string | undefined;
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => req.cookies.get(name)?.value } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: membership } = await supabaseAdmin
    .from("client_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "not a member of this client" }, { status: 403 });

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("name, google_review_link")
    .eq("id", clientId)
    .single();
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });
  if (!client.google_review_link) {
    return NextResponse.json({ error: "Configure a Google review link below first." }, { status: 400 });
  }

  const messageBody = `Thanks for choosing ${client.name}! If you have a moment, we'd really appreciate a quick review: ${client.google_review_link}`;

  try {
    await sendEmail(user.email, `[Test] Review request from ${client.name}`, messageBody, client.name);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `Send failed: ${e.message}` : "Send failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, sentTo: user.email, body: messageBody });
}
