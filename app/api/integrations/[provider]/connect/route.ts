import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { getGoogleAuthUrl, isGoogleConfigured } from "@/lib/calendar/google";
import { getOutlookAuthUrl, isOutlookConfigured } from "@/lib/calendar/outlook";

/**
 * GET /api/integrations/:provider/connect?client_id=...
 * Redirects into the real Google/Microsoft OAuth consent screen. Returns a
 * clear error instead of a broken redirect if the provider's client
 * ID/secret env vars aren't set yet -- no pretending a connection attempt
 * can succeed without them.
 */
export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider;
  const clientId = req.nextUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

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

  if (provider === "google") {
    if (!isGoogleConfigured()) {
      return NextResponse.json({ error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET aren't set yet." }, { status: 400 });
    }
    return NextResponse.redirect(getGoogleAuthUrl(clientId));
  }
  if (provider === "outlook") {
    if (!isOutlookConfigured()) {
      return NextResponse.json({ error: "MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET aren't set yet." }, { status: 400 });
    }
    return NextResponse.redirect(getOutlookAuthUrl(clientId));
  }
  return NextResponse.json({ error: "unknown provider" }, { status: 400 });
}
