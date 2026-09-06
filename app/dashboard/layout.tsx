import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabase";
import { ClientProvider, type ClientMembership } from "@/lib/clientContext";
import { SandboxProvider } from "@/lib/sandboxContext";
import TopNav from "@/components/TopNav";
import ThemeTokenLoader from "@/components/ThemeTokenLoader";
import PageTransition from "@/components/PageTransition";
import { Toaster } from "@/components/ui/sonner";

/**
 * NEXT_PUBLIC_DISABLE_AUTH_FOR_DEMO -- an opt-in, off-by-default escape hatch
 * for viewing the dashboard without signing in. NEXT_PUBLIC_-prefixed so
 * client components can read it too (e.g. to show a "Demo Mode" indicator),
 * not just this server layout. It never overrides a real session: it only
 * kicks in when there is NO logged-in user, and only if the env var is
 * explicitly set. When active, a real (but single-purpose, narrowly-scoped)
 * demo Auth session is minted via /api/demo-session for one real client
 * (DEMO_CLIENT_ID if set, otherwise 'Bracewell Flooring') -- a genuine,
 * deliberate exposure of that client's real data with no authentication, so
 * this must stay off in any environment where that isn't an explicit,
 * informed choice.
 */
const DEMO_BYPASS = process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_DEMO === "true";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (DEMO_BYPASS) redirect("/api/demo-session");
    redirect("/login");
  }

  const { data } = await supabaseAdmin.from("client_users").select("role, clients(*)").eq("user_id", user.id);
  const memberships = (data ?? []) as unknown as ClientMembership[];
  const userEmail = user.email ?? "";

  if (memberships.length === 0) redirect("/login");

  return (
    <ClientProvider memberships={memberships} userEmail={userEmail}>
      <SandboxProvider>
        <ThemeTokenLoader />
        <div className="dashboard-shell-gradient flex h-screen flex-col bg-background">
          <TopNav />
          <main className="relative z-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-6 py-8">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </div>
        <Toaster />
      </SandboxProvider>
    </ClientProvider>
  );
}
