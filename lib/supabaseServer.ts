import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server component / server-side helper for reading the logged-in user's
// session from cookies (set by middleware.ts / the browser client's
// createBrowserClient). Use this in server components and layouts;
// lib/supabaseClient.ts (supabaseBrowser) is the client-component equivalent.
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );
}
