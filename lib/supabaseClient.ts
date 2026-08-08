import { createClient } from "@supabase/supabase-js";

// Browser/client-side Supabase client using the anon key -- this is what the
// dashboard UI should import, NOT lib/supabase.ts (that one uses the service
// role key and must only ever run server-side). Requests made with this
// client carry the logged-in user's session, so Row Level Security applies.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
