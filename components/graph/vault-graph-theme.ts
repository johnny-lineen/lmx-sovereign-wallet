import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Box,
  CreditCard,
  FileText,
  KeyRound,
  Mail,
  RefreshCw,
  Share2,
  Smartphone,
  UserCircle,
} from "lucide-react";

export type VaultNodeFocusTier = "selected" | "neighbor" | "idle" | "muted";

export const vaultTypeVisuals: Record<
  string,
  {
    Icon: LucideIcon;
    /** Left accent + soft fill */
    shell: string;
    iconClass: string;
  }
> = {
  email: {
    Icon: Mail,
    shell: "border-l-[3px] border-l-sky-500 bg-sky-500/[0.07]",
    iconClass: "text-sky-600 dark:text-sky-400",
  },
  account: {
    Icon: UserCircle,
    shell: "border-l-[3px] border-l-violet-500 bg-violet-500/[0.07]",
    iconClass: "text-violet-600 dark:text-violet-400",
  },
  subscription: {
    Icon: RefreshCw,
    shell: "border-l-[3px] border-l-amber-500 bg-amber-500/[0.07]",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  social_account: {
    Icon: Share2,
    shell: "border-l-[3px] border-l-rose-500 bg-rose-500/[0.07]",
    iconClass: "text-rose-600 dark:text-rose-400",
  },
  device: {
    Icon: Smartphone,
    shell: "border-l-[3px] border-l-emerald-500 bg-emerald-500/[0.07]",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  file_reference: {
    Icon: FileText,
    shell: "border-l-[3px] border-l-slate-500 bg-slate-500/[0.08]",
    iconClass: "text-slate-600 dark:text-slate-400",
  },
  payment_method_reference: {
    Icon: CreditCard,
    shell: "border-l-[3px] border-l-cyan-600 bg-cyan-500/[0.08]",
    iconClass: "text-cyan-700 dark:text-cyan-400",
  },
  credential_reference: {
    Icon: KeyRound,
    shell: "border-l-[3px] border-l-orange-500 bg-orange-500/[0.07]",
    iconClass: "text-orange-600 dark:text-orange-400",
  },
  identity_profile: {
    Icon: BadgeCheck,
    shell: "border-l-[3px] border-l-indigo-500 bg-indigo-500/[0.07]",
    iconClass: "text-indigo-600 dark:text-indigo-400",
  },
  custom: {
    Icon: Box,
    shell: "border-l-[3px] border-l-neutral-400 bg-muted/45",
    iconClass: "text-muted-foreground",
  },
};

export function getVaultTypeVisual(type: string) {
  return vaultTypeVisuals[type] ?? vaultTypeVisuals.custom;
}

export type VaultLayoutTier = "hub" | "primary" | "secondary";

export function getVaultLayoutTier(type: string): VaultLayoutTier {
  if (type === "email") return "hub";
  if (type === "account" || type === "social_account" || type === "identity_profile") {
    return "primary";
  }
  return "secondary";
}

export function humanizeVaultType(t: string): string {
  return t.split("_").join(" ");
}

export function focusRingClass(tier: VaultNodeFocusTier): string {
  switch (tier) {
    case "selected":
      return "ring-2 ring-primary ring-offset-2 ring-offset-background";
    case "neighbor":
      return "ring-1 ring-primary/45";
    case "muted":
      return "ring-1 ring-border/40";
    default:
      return "ring-1 ring-border/60";
  }
}
