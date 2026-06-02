import { AlertTriangle } from "lucide-react";

type BreachAlertBannerProps = {
  emailsExposedCount: number;
  uniqueBreachCount: number;
  subtext?: string;
};

export function BreachAlertBanner({
  emailsExposedCount,
  uniqueBreachCount,
  subtext = "Your passwords and personal data may be exposed — review below",
}: BreachAlertBannerProps) {
  return (
    <div
      className="flex gap-3 rounded-xl border border-[#f5c4b8]/25 bg-[#FAECE7]/[0.08] px-4 py-3.5 sm:items-start"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#f5a898]" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-[#fcd4c8]">
          {emailsExposedCount} of your emails appear in {uniqueBreachCount} known data breaches
        </p>
        <p className="text-sm text-[#e8b5a8]/80">{subtext}</p>
      </div>
    </div>
  );
}
