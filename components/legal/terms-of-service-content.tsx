import { LEGAL_CONFIG } from "@/lib/legal-config";

import { LegalList, LegalSection } from "./legal-page-shell";

export function TermsOfServiceContent() {
  const { productName, operatorName, contactEmail } = LEGAL_CONFIG;

  return (
    <>
      <LegalSection title="Agreement">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of {productName}{" "}
          (the &quot;Service&quot;) operated by {operatorName} (&quot;we,&quot; &quot;us,&quot; or
          &quot;our&quot;). By accessing or using the Service, you agree to these Terms. If you do not
          agree, do not use the Service.
        </p>
        <p>
          The Service provides an identity footprint console (vault, graph, insights, and related
          tools). It is not a cryptocurrency wallet, payment service, or licensed security product
          unless we expressly state otherwise in writing.
        </p>
      </LegalSection>

      <LegalSection title="Eligibility">
        <p>
          You must be at least 13 years old (or the minimum age in your jurisdiction) and able to form
          a binding contract. You may not use the Service if you are barred under applicable law or if
          your account has been suspended.
        </p>
        <p>
          We may limit access during early access, beta, or allowlisted testing. Features described on
          marketing pages may not yet be available in your environment.
        </p>
      </LegalSection>

      <LegalSection title="Accounts">
        <p>
          You are responsible for your account credentials and for all activity under your account. Use
          accurate information and notify us promptly of unauthorized access at{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="font-medium text-cyan-300 underline-offset-4 hover:underline"
          >
            {contactEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Your content and connected sources">
        <p>
          You retain ownership of content you submit or connect. You grant us a limited license to
          host, process, display, and improve the Service using that content solely to operate features
          you use (imports, graphing, insights, audits, feedback, and similar).
        </p>
        <p>
          You represent that you have the right to connect any third-party accounts or data sources
          (such as Gmail) and that your use complies with those providers&apos; terms and applicable
          law. Imports and audits run only when you initiate them.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to:</p>
        <LegalList
          items={[
            "Use the Service for unlawful, harmful, or fraudulent purposes.",
            "Probe, scan, or test vulnerabilities without authorization.",
            "Interfere with or disrupt the Service or other users.",
            "Access another person's account or data without permission.",
            "Reverse engineer or scrape the Service except as permitted by law.",
            "Misrepresent audit or insight results as legal, financial, or professional advice.",
            "Use automated means to overload the Service or bypass rate limits.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Third-party services">
        <p>
          The Service integrates with third parties (including Clerk, Google Gmail API, database
          hosting, and optional connectors or AI providers). Your use of those services is subject to
          their terms and policies. We are not responsible for third-party services we do not control.
        </p>
        <p>
          Public footprint audits may query external sources using information you provide. Results are
          informational candidates for your review—not guarantees of accuracy or completeness.
        </p>
      </LegalSection>

      <LegalSection title="No professional advice">
        <p>
          Insights, graph explanations, agent responses, and audit output are provided for informational
          purposes only. They do not constitute legal, financial, security, or compliance advice. You are
          responsible for decisions you make based on the Service.
        </p>
      </LegalSection>

      <LegalSection title="Beta and availability">
        <p>
          The Service is under active development. We may change, suspend, or discontinue features at
          any time. We do not guarantee uninterrupted or error-free operation. Scheduled or emergency
          maintenance may occur without notice.
        </p>
      </LegalSection>

      <LegalSection title="Fees">
        <p>
          If we offer paid plans in the future, separate pricing terms will apply. During free or early
          access periods, we may modify or withdraw access at our discretion.
        </p>
      </LegalSection>

      <LegalSection title="Intellectual property">
        <p>
          We and our licensors own the Service, software, branding, and documentation, except for content
          you provide. You may not use our trademarks without permission.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer of warranties">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF
          ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT
          WARRANT THAT THE SERVICE WILL BE SECURE, ACCURATE, OR FREE OF ERRORS.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR AFFILIATES, OFFICERS, EMPLOYEES, AND
          SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
        </p>
        <p>
          OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A)
          AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED
          U.S. DOLLARS (USD $100).
        </p>
        <p>
          Some jurisdictions do not allow certain limitations; in those cases, our liability is limited
          to the fullest extent permitted by law.
        </p>
      </LegalSection>

      <LegalSection title="Indemnification">
        <p>
          You will defend and indemnify us against claims arising from your misuse of the Service, your
          content, or your violation of these Terms or third-party rights, except to the extent caused by
          our gross negligence or willful misconduct.
        </p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>
          You may stop using the Service at any time. We may suspend or terminate access if you violate
          these Terms, pose a security risk, or as required by law. Provisions that by nature should
          survive termination will survive (including disclaimers, limitations, and indemnity).
        </p>
      </LegalSection>

      <LegalSection title="Governing law and disputes">
        <p>
          These Terms are governed by the laws of the State of Delaware, United States, without regard
          to conflict-of-law rules, except where mandatory consumer protections in your country of
          residence apply.
        </p>
        <p>
          Disputes will be resolved in the state or federal courts located in Delaware, unless applicable
          law requires otherwise. You may also have rights to bring claims in your local courts under
          consumer protection laws.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may modify these Terms by posting an updated version on this page. Continued use after the
          effective date constitutes acceptance of the revised Terms where permitted by law.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these Terms:{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="font-medium text-cyan-300 underline-offset-4 hover:underline"
          >
            {contactEmail}
          </a>
        </p>
      </LegalSection>
    </>
  );
}
