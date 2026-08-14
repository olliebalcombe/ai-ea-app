import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabase";
import { ClientProvider, type ClientMembership } from "@/lib/clientContext";
import { SandboxProvider } from "@/lib/sandboxContext";
import TopNav from "@/components/TopNav";
import ThemeTokenLoader from "@/components/ThemeTokenLoader";
import PageTransition from "@/components/PageTransition";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: memberships } = await supabaseAdmin
    .from("client_users")
    .select("role, clients(*)")
    .eq("user_id", user.id);

  return (
    <ClientProvider
      memberships={(memberships ?? []) as unknown as ClientMembership[]}
      userEmail={user.email ?? ""}
    >
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
