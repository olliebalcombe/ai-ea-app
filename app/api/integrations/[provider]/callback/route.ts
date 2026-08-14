import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { exchangeGoogleCode } from "@/lib/calendar/google";
import { exchangeOutlookCode } from "@/lib/calendar/outlook";

/**
 * GET /api/integrations/:provider/callback?code=...&state=client_id
 * Exchanges the real OAuth code for real tokens and stores them in
 * calendar_connections, then redirects back to the Integrations page.
 */
export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider;
  const code = req.nextUrl.searchParams.get("code");
  const clientId = req.nextUrl.searchParams.get("state");
  const settingsUrl = new URL("/dashboard/settings/integrations", req.nextUrl.origin);

  if (!code || !clientId) {
    settingsUrl.searchParams.set("error", "Missing code or state from the provider.");
    return NextResponse.redirect(settingsUrl);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => req.cookies.get(name)?.value } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    settingsUrl.searchParams.set("error", "Not signed in.");
    return NextResponse.redirect(settingsUrl);
  }

  const { data: membership } = await supabaseAdmin
    .from("client_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!membership) {
    settingsUrl.searchParams.set("error", "Not a member of this client.");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const tokens =
      provider === "google" ? await exchangeGoogleCode(code) : provider === "outlook" ? await exchangeOutlookCode(code) : null;
    if (!tokens) throw new Error("unknown provider");

    await supabaseAdmin.from("calendar_connections").upsert(
      {
        client_id: clientId,
        provider,
        connected_email: tokens.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      },
      { onConflict: "client_id,provider" }
    );
    settingsUrl.searchParams.set("connected", provider);
  } catch (e) {
    settingsUrl.searchParams.set("error", e instanceof Error ? e.message : "Connection failed");
  }

  return NextResponse.redirect(settingsUrl);
}
