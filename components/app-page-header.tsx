import { cn } from "@/lib/utils";

const eyebrow = "LMX Sovereign Wallet";

export function AppPageHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-400/90">{eyebrow}</p>
      <h2 className="font-heading text-2xl font-semibold tracking-tight text-white">{title}</h2>
      {description ? <p className="text-pretty text-slate-400">{description}</p> : null}
    </div>
  );
}
