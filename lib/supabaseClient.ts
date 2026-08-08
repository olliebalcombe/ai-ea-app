import { createBrowserClient } from "@supabase/ssr";

// Browser/client-side Supabase client using the anon key -- this is what the
// dashboard UI should import, NOT lib/supabase.ts (that one uses the service
// role key and must only ever run server-side). Requests made with this
// client carry the logged-in user's session, so Row Level Security applies.
// Uses @supabase/ssr's browser client (not supabase-js's createClient)
// specifically so the session is synced into cookies -- middleware.ts and
// server components read the session via cookies, not localStorage.
export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
