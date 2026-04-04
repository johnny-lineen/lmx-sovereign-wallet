import { cn } from "@/lib/utils";

/** Fixed gradient IDs — only one GlobeWireframe should mount per page. */
const GB = {
  trailBright: "globe-wf-trailBright",
  trailDim: "globe-wf-trailDim",
  trailBrightLight: "globe-wf-trailBrightLight",
  trailDimLight: "globe-wf-trailDimLight",
} as const;

export function GlobeWireframe({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 300"
      className={cn("h-full w-full", className)}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={GB.trailBright} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={GB.trailDim} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={GB.trailBrightLight} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0891b2" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#4338ca" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={GB.trailDimLight} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0891b2" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#4338ca" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      <g>
        {[...Array(6)].map((_, i) => (
          <ellipse
            key={`lat-${i}`}
            cx="150"
            cy="150"
            rx={120}
            ry={40 + i * 12}
            stroke={`url(#${GB.trailDim})`}
            strokeWidth="1.2"
            fill="none"
            strokeDasharray="5 5"
            style={{ animation: "flowAnimation 10s linear infinite" }}
            opacity={0.8}
            transform="rotate(-25,150,150)"
            className="stroke-[url(#globe-wf-trailDimLight)] dark:stroke-[url(#globe-wf-trailDim)]"
          />
        ))}

        {[...Array(8)].map((_, i) => (
          <path
            key={`lon-${i}`}
            d="M150,30 A120,120 0 0,1 150,270"
            stroke={`url(#${GB.trailDim})`}
            strokeWidth="1.2"
            fill="none"
            strokeDasharray="4 4"
            style={{ animation: "flowAnimation 12s linear infinite reverse" }}
            opacity={0.8}
            transform={`rotate(${i * 22.5},150,150)`}
            className="stroke-[url(#globe-wf-trailDimLight)] dark:stroke-[url(#globe-wf-trailDim)]"
          />
        ))}

        <ellipse
          cx="150"
          cy="150"
          rx="140"
          ry="60"
          stroke={`url(#${GB.trailBright})`}
          strokeWidth="3"
          fill="none"
          strokeDasharray="10 10"
          style={{ animation: "flowAnimation 14s linear infinite" }}
          opacity={1}
          transform="rotate(20,150,150)"
          className="stroke-[url(#globe-wf-trailBrightLight)] dark:stroke-[url(#globe-wf-trailBright)]"
        />
        <ellipse
          cx="150"
          cy="150"
          rx="130"
          ry="50"
          stroke={`url(#${GB.trailDim})`}
          strokeWidth="2.5"
          fill="none"
          strokeDasharray="12 12"
          style={{ animation: "flowAnimation 9s linear infinite reverse" }}
          opacity={0.9}
          transform="rotate(-40,150,150)"
          className="stroke-[url(#globe-wf-trailDimLight)] dark:stroke-[url(#globe-wf-trailDim)]"
        />
      </g>
    </svg>
  );
}

export type GlobePerformanceCardProps = {
  className?: string;
  title?: string;
  description?: string;
};

const defaultTitle = "Top-level performance";
const defaultDescription =
  "Made for static sites while avoiding heavy assets, your website will feel snappy and load instantly.";

export const Component = ({
  className,
  title = defaultTitle,
  description = defaultDescription,
}: GlobePerformanceCardProps = {}) => {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-border/80 bg-card/90 p-8 text-card-foreground backdrop-blur-md md:p-12",
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-80 w-80 rounded-full bg-accent/40 blur-3xl" />

      <div className="relative flex flex-col items-center text-center">
        <h2 className="font-heading text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          {title}
        </h2>
        <p className="mt-4 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
          {description}
        </p>

        <div className="mt-10 h-64 w-64 md:h-80 md:w-80 overflow-hidden">
          <GlobeWireframe />
        </div>
      </div>
    </div>
  );
};
