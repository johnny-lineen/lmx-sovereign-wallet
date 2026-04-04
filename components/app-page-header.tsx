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
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
      <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      {description ? <p className="text-pretty text-muted-foreground">{description}</p> : null}
    </div>
  );
}
