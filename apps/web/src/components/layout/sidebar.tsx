"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  LayoutDashboard, FolderKanban, Receipt, Tags, Users, Settings, LogOut, ChevronsUpDown,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { roleBadge } from "@/components/ui/badge";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/projects",  label: "Projects",  icon: FolderKanban,    adminOnly: false },
  { href: "/spendings", label: "Spendings", icon: Receipt,          adminOnly: false },
  { href: "/categories",label: "Categories",icon: Tags,             adminOnly: false },
  { href: "/users",     label: "Users",     icon: Users,            adminOnly: true  },
  { href: "/settings",  label: "Settings",  icon: Settings,         adminOnly: false },
];

function NavSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="w-64 border-r bg-sidebar flex flex-col gap-2 p-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
      </div>
      <div className="flex-1 p-8"><Skeleton className="h-8 w-48" /></div>
    </div>
  );
}

function AppSidebarInner() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;

  const initials = (user.displayName ?? user.username)
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const items = NAV.filter((n) => !n.adminOnly || user.role === "admin");

  async function handleLogout() {
    await api.auth.logout();
    toast.success("Signed out");
    router.push("/login");
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white text-sm font-bold">F</div>
          <div>
            <p className="text-sm font-semibold leading-none">Finance Yanti</p>
            <p className="text-xs text-muted-foreground mt-0.5">Internal tracker</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    render={<Link href={href} />}
                    isActive={pathname.startsWith(href)}
                    tooltip={label}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-sidebar-accent transition-colors outline-none"
          >
              <Avatar className="h-7 w-7 rounded-md shrink-0">
                <AvatarFallback className="rounded-md text-xs bg-zinc-200 text-zinc-800">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                <span className="truncate font-semibold text-xs">{user.displayName ?? user.username}</span>
                <span className="truncate text-xs text-muted-foreground">{user.username}</span>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
            <div className="px-2 py-2 flex items-center gap-2">
              <Avatar className="h-8 w-8 rounded-md">
                <AvatarFallback className="rounded-md text-xs bg-zinc-200 text-zinc-800">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{user.displayName ?? user.username}</p>
                <div className="mt-0.5">{roleBadge(user.role)}</div>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user?.mustChangePassword) router.push("/change-password");
  }, [loading, user, router]);

  if (loading) return <NavSkeleton />;
  if (!user) return null;
  if (user.mustChangePassword) return null;

  return (
    <SidebarProvider>
      <AppSidebarInner />
      <main className="flex flex-1 flex-col min-w-0 min-h-screen">
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4 mx-1" />
          <span className="text-sm text-muted-foreground font-medium">Finance Yanti</span>
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </main>
    </SidebarProvider>
  );
}
