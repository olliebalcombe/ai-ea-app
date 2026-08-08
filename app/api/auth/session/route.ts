import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/auth/session
 * Returns the logged-in user's accessible client(s), via the client_users
 * mapping table. The dashboard calls this on load to know which business
 * (or businesses) the current user is allowed to see -- mirrors the
 * client-switcher already built in the UI prototypes, now backed by real auth
 * instead of a hardcoded CLIENTS array.
 */
export async function GET(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => req.cookies.get(name)?.value } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: memberships } = await supabaseAdmin
    .from("client_users")
    .select("role, clients(*)")
    .eq("user_id", user.id);

  return NextResponse.json({ user: { id: user.id, email: user.email }, clients: memberships ?? [] });
}
