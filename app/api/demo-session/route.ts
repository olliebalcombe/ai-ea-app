import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Only reachable when NEXT_PUBLIC_DISABLE_AUTH_FOR_DEMO="true" -- mints a
 * REAL Supabase Auth session for a dedicated, single-purpose demo account
 * (mapped only to one client via client_users) so the existing RLS-protected
 * dashboard pages actually return data for an unauthenticated visitor,
 * instead of the layout merely faking React context (which RLS ignores).
 * The demo account is provisioned on first use and reused after that --
 * it is never given access to more than the one demo client.
 *
 * Uses a deterministic password + signInWithPassword rather than
 * generateLink()/verifyOtp() -- the magic-link token exchange proved
 * unreliable on Vercel ("Email link is invalid or expired"), and a direct
 * password sign-in has no link/token expiry to race against. The password
 * is never sent to the browser or logged -- it's derived from the service
 * role key so it never needs to be stored anywhere new.
 */
function demoPasswordFor(email: string) {
  return createHash("sha256").update(`${email}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest("hex");
}

export async function GET(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_DEMO !== "true") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const demoClientId = process.env.DEMO_CLIENT_ID;
  const clientQuery = supabaseAdmin.from("clients").select("*");
  const { data: demoClient, error: clientError } = demoClientId
    ? await clientQuery.eq("id", demoClientId).single()
    : await clientQuery.eq("name", "Bracewell Flooring").single();

  if (clientError || !demoClient) {
    console.error("[demo-session] could not find demo client", clientError);
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Deterministic per-client so repeat visits reuse the same account rather than creating a new one each time.
  const demoEmail = `demo-${demoClient.id}@internal.demo`;
  const demoPassword = demoPasswordFor(demoEmail);

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: demoEmail,
    password: demoPassword,
    email_confirm: true,
    user_metadata: { demo_account: true },
  });

  let demoUserId: string;
  if (created?.user) {
    demoUserId = created.user.id;
    const { error: linkError } = await supabaseAdmin
      .from("client_users")
      .insert({ user_id: demoUserId, client_id: demoClient.id, role: "owner" });
    if (linkError) {
      console.error("[demo-session] failed to link demo user to client_users", linkError);
      return NextResponse.redirect(new URL("/login", req.url));
    }
  } else {
    // Already provisioned from a previous visit -- look it up instead.
    const listResp = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = listResp.data?.users ?? [];
    const existing = users.find((u) => u.email === demoEmail);
    if (listResp.error || !existing) {
      console.error("[demo-session] createUser failed and no existing demo user found", createError, listResp.error);
      return NextResponse.redirect(new URL("/login", req.url));
    }
    demoUserId = existing.id;
  }

  const response = NextResponse.redirect(new URL("/dashboard", req.url));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  let { error: signInError } = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPassword });

  if (signInError) {
    // The account may predate this password scheme (e.g. created by an earlier
    // magic-link version of this route with no password at all) -- reset it to
    // the known deterministic password and retry once before giving up.
    console.warn("[demo-session] initial sign-in failed, resetting demo account password and retrying", signInError.message);
    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(demoUserId, { password: demoPassword });
    if (resetError) {
      console.error("[demo-session] failed to reset demo account password", resetError);
      return NextResponse.redirect(new URL("/login", req.url));
    }
    ({ error: signInError } = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPassword }));
  }

  if (signInError) {
    console.error("[demo-session] sign-in failed even after password reset", signInError);
    return NextResponse.redirect(new URL("/login", req.url));
  }

  console.log("[demo-session] established real session for demo account", { clientId: demoClient.id, clientName: demoClient.name });
  return response;
}
