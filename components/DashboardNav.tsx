"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import ClientSwitcher from "@/components/ClientSwitcher";

const LINKS = [
  { href: "/dashboard", label: "Leads" },
  { href: "/dashboard/settings/staff", label: "Settings" },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentClient, userEmail } = useCurrentClient();

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-gray-900">
            {currentClient?.name ?? "AI EA"}
          </span>
          <div className="flex gap-4">
            {LINKS.map((link) => {
              const active =
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname?.startsWith("/dashboard/settings");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm ${
                    active ? "font-semibold text-gray-900" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ClientSwitcher />
          <span className="text-sm text-gray-500">{userEmail}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
