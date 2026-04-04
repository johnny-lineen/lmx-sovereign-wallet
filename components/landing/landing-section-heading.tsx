export function LandingSectionHeading({
  eyebrow,
  title,
  subtitle,
  id,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  id?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
      <h2
        id={id}
        className="mt-3 font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
      >
        {title}
      </h2>
      <p className="mt-3 text-pretty text-sm text-muted-foreground sm:text-base">{subtitle}</p>
    </div>
  );
}
