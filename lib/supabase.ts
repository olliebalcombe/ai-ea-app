import { createClient } from "@supabase/supabase-js";

// Server-side client using the service role key -- only ever import this in
// server code (API routes, server components), never in client-side code,
// since the service role key bypasses row-level security.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
