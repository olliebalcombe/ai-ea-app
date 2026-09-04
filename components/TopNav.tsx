"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home,
  Inbox,
  Calendar,
  Sparkles,
  Settings as SettingsIcon,
  Kanban,
  XCircle,
  ClipboardList,
  ClipboardCheck,
  Clock,
  FileBarChart,
  Activity,
  BookOpen,
  Workflow,
  ListChecks,
  Clapperboard,
  Palette,
  Store,
  Users,
  UserCog,
  Wrench,
  Bell,
  Menu,
  ChevronsUpDown,
  LogOut,
  Check,
  Zap,
  Radio,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { useSandbox } from "@/lib/sandboxContext";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CommandPalette from "@/components/CommandPalette";
import HealthAuditButton from "@/components/HealthAuditButton";
import SimulateLeadDrawer from "@/components/SimulateLeadDrawer";
import BroadcastDialog from "@/components/BroadcastDialog";
import LiveActivityTicker from "@/components/LiveActivityTicker";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  /** Where clicking the category label itself (not a specific item) navigates. */
  href: string;
  /** The named core workspaces for this category -- shown first, full-weight. */
  primary: NavItem[];
  /** Everything else that still lives in this category -- shown under a "More" header. */
  secondary: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Inbox",
    icon: Inbox,
    href: "/dashboard/inbox",
    primary: [
      { href: "/dashboard", label: "Today", icon: Home },
      { href: "/dashboard/inbox", label: "Inbox", icon: Inbox },
      { href: "/dashboard/approvals", label: "Approvals", icon: ClipboardCheck },
    ],
    secondary: [
      { href: "/dashboard/leads", label: "Lead Queue", icon: Kanban },
      { href: "/dashboard/lost", label: "Lost Leads", icon: XCircle },
    ],
  },
  {
    label: "Schedule",
    icon: Calendar,
    href: "/dashboard/calendar",
    primary: [
      { href: "/dashboard/follow-ups", label: "Follow-ups", icon: Clock },
      { href: "/dashboard/calendar", label: "Calendar & Site Visits", icon: Calendar },
      { href: "/dashboard/reports", label: "Reports", icon: FileBarChart },
    ],
    secondary: [{ href: "/dashboard/bookings", label: "Bookings", icon: ClipboardList }],
  },
  {
    label: "AI Assistant",
    icon: Sparkles,
    href: "/dashboard/business-memory",
    primary: [
      { href: "/dashboard/business-memory", label: "Business Memory", icon: BookOpen },
      { href: "/dashboard/playbooks", label: "Playbooks", icon: Workflow },
    ],
    secondary: [
      { href: "/dashboard/activity", label: "Assistant Activity", icon: Activity },
      { href: "/dashboard/canvas", label: "Canvas", icon: Clapperboard },
      { href: "/dashboard/marketplace", label: "Marketplace", icon: Store },
    ],
  },
  {
    label: "Settings",
    icon: SettingsIcon,
    href: "/dashboard/settings/ai",
    primary: [
      { href: "/dashboard/customers", label: "Customers", icon: Users },
      { href: "/dashboard/settings/integrations", label: "Integrations & Settings", icon: SettingsIcon },
    ],
    secondary: [
      { href: "/dashboard/settings/staff", label: "Staff", icon: UserCog },
      { href: "/dashboard/settings/services", label: "Services", icon: Wrench },
      { href: "/dashboard/settings/questions", label: "Questions", icon: ListChecks },
      { href: "/dashboard/settings/notifications", label: "Notifications", icon: Bell },
      { href: "/dashboard/settings/ai", label: "AI Settings", icon: Sparkles },
      { href: "/dashboard/design-studio", label: "Design Studio", icon: Palette },
    ],
  },
];

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { memberships, currentClient, currentClientId, setCurrentClientId, userEmail } = useCurrentClient();
  const { sandbox, setSandbox } = useSandbox();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }
  function isGroupActive(group: NavGroup) {
    return [...group.primary, ...group.secondary].some((i) => isActive(i.href));
  }

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="sticky top-0 z-[999] shrink-0 border-b border-white/10 bg-background/60 backdrop-blur-md">
      <header className="flex h-14 items-center gap-4 px-4 md:px-6">
        <Link href="/dashboard" className="shrink-0 truncate text-sm font-semibold text-foreground">
          {currentClient?.name ?? "AI EA"}
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => setOpenGroup(group.label)}
                onMouseLeave={() => setOpenGroup(null)}
              >
                <Link
                  href={group.href}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                    isGroupActive(group) ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isGroupActive(group) && (
                    <motion.div
                      layoutId="active-nav-group"
                      className="absolute inset-0 rounded-md bg-primary/10"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <GroupIcon className="relative h-3.5 w-3.5" /> <span className="relative">{group.label}</span>
                </Link>
                <AnimatePresence>
                  {openGroup === group.label && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className={cn(
                        "glow-hover absolute left-0 top-full z-[1000] mt-1 grid gap-1 rounded-lg border border-white/10 bg-popover p-3 shadow-2xl drop-shadow-2xl backdrop-blur-xl",
                        group.secondary.length > 0 ? "w-[420px] grid-cols-2" : "w-56 grid-cols-1"
                      )}
                    >
                      <div className="space-y-0.5">
                        {group.secondary.length > 0 && (
                          <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                            {group.label}
                          </p>
                        )}
                        {group.primary.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                                isActive(item.href) ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                              )}
                            >
                              <ItemIcon className="h-3.5 w-3.5" /> {item.label}
                            </Link>
                          );
                        })}
                      </div>
                      {group.secondary.length > 0 && (
                        <div className="space-y-0.5 border-l border-white/5 pl-3">
                          <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">More</p>
                          {group.secondary.map((item) => {
                            const ItemIcon = item.icon;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                                  isActive(item.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                )}
                              >
                                <ItemIcon className="h-3.5 w-3.5" /> {item.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        <div className="flex-1" />

        <div className="hidden items-center gap-2 md:flex">
          <CommandPalette />
          <HealthAuditButton />
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-secondary/30 px-3 py-1.5">
            <FlaskConical className={`h-3.5 w-3.5 ${sandbox ? "text-amber-400" : "text-muted-foreground"}`} />
            <span className="text-xs font-medium text-foreground">{sandbox ? "Sandbox" : "Live"}</span>
            <Switch checked={sandbox} onCheckedChange={setSandbox} />
          </div>
          <Button onClick={() => setSimulateOpen(true)} size="sm" className="gap-1.5">
            <Zap className="h-4 w-4" />
            Simulate Lead
          </Button>
          <Button onClick={() => setBroadcastOpen(true)} size="icon" variant="outline" title="Broadcast Update">
            <Radio className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-accent">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px]">{initials(currentClient?.name ?? userEmail ?? "?")}</AvatarFallback>
                </Avatar>
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{userEmail}</DropdownMenuLabel>
              {memberships.length > 1 && (
                <>
                  <DropdownMenuSeparator />
                  {memberships.map((m) => (
                    <DropdownMenuItem key={m.clients.id} onClick={() => setCurrentClientId(m.clients.id)} className="justify-between">
                      {m.clients.name}
                      {m.clients.id === currentClientId && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <button className="rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </button>

        <SimulateLeadDrawer open={simulateOpen} onOpenChange={setSimulateOpen} />
        <BroadcastDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />
      </header>
      <LiveActivityTicker />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 overflow-y-auto">
          <div className="mt-6 space-y-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                <div className="space-y-0.5">
                  {group.primary.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium",
                          isActive(item.href) ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                        )}
                      >
                        <ItemIcon className="h-3.5 w-3.5" /> {item.label}
                      </Link>
                    );
                  })}
                </div>
                {group.secondary.length > 0 && (
                  <div className="mt-1 space-y-0.5 border-t border-white/5 pt-1">
                    {group.secondary.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm",
                            isActive(item.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                        >
                          <ItemIcon className="h-3.5 w-3.5" /> {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
