import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabase";
import { ClientProvider, type ClientMembership } from "@/lib/clientContext";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";
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
      <div className="flex h-screen bg-background">
        <DashboardSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
          </main>
        </div>
      </div>
      <Toaster />
    </ClientProvider>
  );
}
