import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { TermsOfServiceContent } from "@/components/legal/terms-of-service-content";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: `Terms of Service | ${LEGAL_CONFIG.productName}`,
  description: `Terms of Service for ${LEGAL_CONFIG.productName}.`,
};

export default function TermsOfServicePage() {
  return (
    <LegalPageShell title="Terms of Service" active="terms">
      <TermsOfServiceContent />
    </LegalPageShell>
  );
}
