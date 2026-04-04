"use client";

import { UserButton } from "@clerk/nextjs";
import { Bot, LayoutDashboard, Lightbulb, Lock, Network, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vault", label: "Vault", icon: Lock },
  { href: "/graph", label: "Graph", icon: Network },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/vault": "Vault",
  "/graph": "Graph",
  "/insights": "Insights",
  "/agent": "Agent",
  "/settings": "Settings",
};

export function AppShell({
  children,
  title: titleProp,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const title = titleProp ?? titles[pathname] ?? "Console";
  const isGraphWorkspace = pathname === "/graph" || pathname.startsWith("/graph/");

  return (
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      <aside className="hidden w-56 shrink-0 border-b border-border/80 bg-sidebar md:flex md:flex-col md:border-b-0 md:border-r md:border-border/80">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Link
            href="/dashboard"
            className="font-heading text-sm font-semibold tracking-tight text-sidebar-foreground sm:text-base"
          >
            LMX Sovereign Wallet
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div
        className={cn(
          "flex min-w-0 min-h-0 flex-1 flex-col",
          isGraphWorkspace && "md:min-h-dvh",
        )}
      >
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border/80 bg-background/85 px-4 text-foreground backdrop-blur-md supports-[backdrop-filter]:bg-background/70 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href="/dashboard"
              className="shrink-0 font-heading text-sm font-semibold tracking-tight md:hidden"
            >
              LMX
            </Link>
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1 md:hidden">
              {nav.map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
            <h1 className="hidden truncate font-heading text-lg font-semibold md:block">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <UserButton />
          </div>
        </header>
        <main
          className={cn(
            "min-h-0 flex-1",
            isGraphWorkspace ? "flex flex-col overflow-hidden p-0" : "p-4 md:p-6",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
