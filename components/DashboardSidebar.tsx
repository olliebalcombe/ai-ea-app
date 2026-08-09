"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Kanban,
  XCircle,
  ClipboardList,
  FileBarChart,
  Calendar,
  BookOpen,
  Palette,
  Store,
  Clapperboard,
  Users,
  Wrench,
  ListChecks,
  Bell,
  ChevronsUpDown,
  LogOut,
  Check,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/messages", label: "Messages", icon: Inbox },
  { href: "/dashboard/leads", label: "Lead Queue", icon: Kanban },
  { href: "/dashboard/lost", label: "Lost Leads", icon: XCircle },
  { href: "/dashboard/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/reports", label: "Reports", icon: FileBarChart },
  { href: "/dashboard/knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { href: "/dashboard/design-studio", label: "Design Studio", icon: Palette },
  { href: "/dashboard/marketplace", label: "Marketplace", icon: Store },
  { href: "/dashboard/canvas", label: "Canvas", icon: Clapperboard },
];

const SETTINGS_NAV = [
  { href: "/dashboard/settings/staff", label: "Staff", icon: Users },
  { href: "/dashboard/settings/services", label: "Services", icon: Wrench },
  { href: "/dashboard/settings/questions", label: "Questions", icon: ListChecks },
  { href: "/dashboard/settings/notifications", label: "Notifications", icon: Bell },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { memberships, currentClient, currentClientId, setCurrentClientId, userEmail } =
    useCurrentClient();

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center px-4">
        <span className="truncate text-sm font-semibold text-foreground">
          {currentClient?.name ?? "AI EA"}
        </span>
      </div>
      <Separator />

      <nav className="flex-1 space-y-4 px-3 py-4">
        <div className="space-y-1">
          {NAV.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md border-l-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div>
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Settings
          </p>
          <div className="space-y-1">
            {SETTINGS_NAV.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-secondary font-medium text-secondary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <Separator />
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {initials(currentClient?.name ?? userEmail ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {currentClient?.name ?? "Account"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
              </div>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {memberships.length > 1 && (
              <>
                <DropdownMenuLabel>Switch business</DropdownMenuLabel>
                {memberships.map((m) => (
                  <DropdownMenuItem
                    key={m.clients.id}
                    onClick={() => setCurrentClientId(m.clients.id)}
                    className="justify-between"
                  >
                    {m.clients.name}
                    {m.clients.id === currentClientId && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
