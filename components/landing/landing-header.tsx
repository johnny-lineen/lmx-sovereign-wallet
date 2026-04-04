"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const consoleHref = "/sign-in";

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  const linkRowClass =
    "flex flex-col gap-1 p-2 sm:flex-row sm:items-center sm:gap-2 sm:p-0";

  return (
    <header
      data-slot="landing-header"
      className="sticky top-0 z-50 border-b border-border/80 bg-background/90 text-foreground shadow-sm shadow-black/20 backdrop-blur-md supports-[backdrop-filter]:bg-background/75"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link
          href="/"
          data-slot="landing-logo"
          className="font-heading text-sm font-semibold tracking-tight text-foreground sm:text-base"
        >
          LMX Sovereign Wallet
        </Link>

        {/* Desktop: menu trigger + panel */}
        <div className="hidden sm:block">
          <details className="group relative">
            <summary
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "list-none cursor-pointer [&::-webkit-details-marker]:hidden",
              )}
            >
              <span className="flex items-center gap-2">
                Menu
                <Menu className="size-4 opacity-70" aria-hidden />
              </span>
            </summary>
            <div
              data-slot="landing-header-menu"
              className={cn(
                "absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-lg",
                "origin-top-right animate-in fade-in zoom-in-95 duration-150",
              )}
            >
              <div className={linkRowClass}>
                <Link
                  href={consoleHref}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "w-full justify-center sm:w-auto",
                  )}
                >
                  Console
                </Link>
                <Link
                  href="/sign-up"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "w-full justify-center text-muted-foreground sm:w-auto",
                  )}
                >
                  Create account
                </Link>
              </div>
            </div>
          </details>
        </div>

        {/* Mobile: icon menu */}
        <div className="sm:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="landing-mobile-nav"
          data-slot="landing-header-mobile"
          className="border-t border-border bg-background px-4 py-3 text-foreground sm:hidden"
        >
          <nav className="flex flex-col gap-2" aria-label="Site">
            <Link
              href={consoleHref}
              className={cn(buttonVariants({ size: "lg" }), "w-full justify-center")}
              onClick={() => setOpen(false)}
            >
              Console
            </Link>
            <Link
              href="/sign-up"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full justify-center",
              )}
              onClick={() => setOpen(false)}
            >
              Create account
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
