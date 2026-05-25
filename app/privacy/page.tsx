import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { PrivacyPolicyContent } from "@/components/legal/privacy-policy-content";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: `Privacy Policy | ${LEGAL_CONFIG.productName}`,
  description: `Privacy Policy for ${LEGAL_CONFIG.productName}.`,
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy">
      <PrivacyPolicyContent />
    </LegalPageShell>
  );
}
