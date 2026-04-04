export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden bg-background p-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--accent),transparent)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute -top-24 right-[12%] h-[22rem] w-[22rem] rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
