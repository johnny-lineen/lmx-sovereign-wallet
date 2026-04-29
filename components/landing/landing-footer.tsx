import Link from "next/link";

export function LandingFooter() {
  return (
    <footer
      data-slot="landing-footer"
      className="border-t border-white/[0.06] bg-[#030509] py-12 text-sm text-slate-500"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 sm:flex-row sm:items-start sm:justify-between sm:gap-12 sm:px-8 lg:px-12 xl:px-16">
        <div className="max-w-sm space-y-2.5">
          <p className="font-heading text-sm font-semibold tracking-tight text-slate-200">LMX Sovereign Wallet</p>
          <p className="text-pretty text-[0.8125rem] leading-relaxed sm:text-sm">
            Identity graph and footprint console. Early access; in active development.
          </p>
        </div>
        <nav className="flex flex-col gap-4 sm:min-w-[12rem] sm:items-end" aria-label="Footer">
          <div className="flex flex-wrap gap-x-5 gap-y-2 sm:justify-end">
            <Link
              href="/sign-in"
              className="text-[0.8125rem] font-medium text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              Sign in
            </Link>
            <Link
              href="/sign-in"
              className="text-[0.8125rem] font-medium text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              Scan now
            </Link>
            <Link
              href="#waitlist"
              className="text-[0.8125rem] font-medium text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              Waitlist
            </Link>
            <Link
              href="#compare"
              className="text-[0.8125rem] font-medium text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              Compare
            </Link>
            <Link
              href="#plans"
              className="text-[0.8125rem] font-medium text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              Plans
            </Link>
          </div>
          <p className="text-[11px] leading-snug text-slate-600 sm:text-right">
            © {new Date().getFullYear()} LMX Sovereign Wallet. All rights reserved.
          </p>
        </nav>
      </div>
    </footer>
  );
}
