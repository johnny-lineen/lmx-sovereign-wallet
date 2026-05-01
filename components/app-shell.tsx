"use client";

import { UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { Bot, LayoutDashboard, Layers, Lightbulb, Lock, Network, ServerCog, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vault", label: "Vault", icon: Lock },
  { href: "/graph", label: "Graph", icon: Network },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useUser();
  const isGraphWorkspace = pathname === "/graph" || pathname.startsWith("/graph/");
  const isDevOpsAllowed = (user?.emailAddresses ?? []).some(
    (entry) => entry.emailAddress.toLowerCase() === "jlineen06@gmail.com",
  );
  const navItems = isDevOpsAllowed
    ? [...nav, { href: "/dev-ops", label: "Dev Ops", icon: ServerCog }]
    : nav;

  return (
    <div className="dark flex min-h-dvh flex-col bg-[#05070a] text-slate-200">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#05070a]/85 text-slate-100 backdrop-blur-md supports-[backdrop-filter]:bg-[#05070a]/75">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-4 px-4 md:px-6">
          <Link
            href="/dashboard"
            className="group flex shrink-0 items-center gap-2.5 font-heading text-sm font-semibold tracking-tight text-white sm:text-base"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 transition-colors group-hover:border-cyan-400/35">
              <Layers className="size-4" aria-hidden />
            </span>
            <span className="hidden min-w-0 truncate leading-tight sm:inline">LMX</span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-200 shadow-[0_0_20px_-8px_rgba(34,211,238,0.35)]"
                      : "text-slate-400 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-slate-100",
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <UserButton />
          </div>
        </div>
      </header>

      <div
        className={cn(
          "flex min-h-0 w-full flex-1 flex-col",
          isGraphWorkspace ? "max-w-none" : "mx-auto max-w-[1440px]",
        )}
      >
        <main
          className={cn(
            "min-h-0 flex-1",
            isGraphWorkspace ? "flex flex-col overflow-hidden p-0" : "p-4 md:p-6",
          )}
        >
          {children}
        </main>
        {!isGraphWorkspace ? <SiteFooter variant="console" /> : null}
      </div>
    </div>
  );
}
