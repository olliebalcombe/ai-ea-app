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
 * DISABLE_AUTH_FOR_DEMO -- an opt-in, off-by-default escape hatch for viewing
 * the dashboard without signing in. It never overrides a real session: it
 * only kicks in when there is NO logged-in user, and only if the env var is
 * explicitly set. When active, it shows one real client's data (DEMO_CLIENT_ID
 * if set, otherwise the first client row) to anyone who loads this route --
 * that is a genuine, deliberate exposure of real business data with no
 * authentication, so this must stay off in any environment where that isn't
 * an explicit, informed choice.
 */
const DEMO_BYPASS = process.env.DISABLE_AUTH_FOR_DEMO === "true";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let memberships: ClientMembership[] = [];
  let userEmail = "";

  if (user) {
    const { data } = await supabaseAdmin.from("client_users").select("role, clients(*)").eq("user_id", user.id);
    memberships = (data ?? []) as unknown as ClientMembership[];
    userEmail = user.email ?? "";
  } else if (DEMO_BYPASS) {
    const demoClientId = process.env.DEMO_CLIENT_ID;
    const query = supabaseAdmin.from("clients").select("*");
    const { data: demoClient } = demoClientId
      ? await query.eq("id", demoClientId).single()
      : await query.order("created_at", { ascending: true }).limit(1).single();
    if (demoClient) {
      memberships = [{ role: "owner", clients: demoClient }] as unknown as ClientMembership[];
      userEmail = "demo@local";
    }
  }

  if (!user && memberships.length === 0) redirect("/login");

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
