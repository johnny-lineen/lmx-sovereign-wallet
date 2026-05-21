import { LEGAL_CONFIG } from "@/lib/legal-config";

import { LegalList, LegalSection } from "./legal-page-shell";

export function PrivacyPolicyContent() {
  const { productName, operatorName, contactEmail } = LEGAL_CONFIG;

  return (
    <>
      <LegalSection title="Introduction">
        <p>
          This Privacy Policy describes how {operatorName} (&quot;we,&quot; &quot;us,&quot; or
          &quot;our&quot;) collects, uses, stores, and shares information when you use the{" "}
          {productName} website, web application, and related services (collectively, the
          &quot;Service&quot;).
        </p>
        <p>
          {productName} is a digital identity footprint console—not a cryptocurrency wallet. We help
          you map accounts, relationships, and signals you choose to connect so you can review your
          exposure and decide what to act on.
        </p>
        <p>
          By using the Service, you agree to this Privacy Policy. If you do not agree, do not use the
          Service.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <p>
          <strong className="text-slate-100">Account and profile information.</strong> When you sign
          up or sign in, we receive information from our authentication provider (Clerk), such as your
          email address, name, profile image, and account identifiers. We store a corresponding user
          record in our application database.
        </p>
        <p>
          <strong className="text-slate-100">Data you connect and generate.</strong> When you use
          features such as Vault, Graph, Insights, imports, or public footprint audits, we process and
          store the data needed to provide those features. This may include:
        </p>
        <LegalList
          items={[
            "Email-derived signals when you voluntarily connect Gmail via Google OAuth (read-only Gmail scope, user-initiated imports).",
            "Structured vault items, relationship graph data, audit candidates, and review decisions you make in the product.",
            "Settings and identity profile information you provide in the console.",
            "In-product feedback you submit (theme, message, and contextual metadata such as the page you were on).",
          ]}
        />
        <p>
          <strong className="text-slate-100">Waitlist and demo requests.</strong> If you submit an
          early-access or demo request on our landing page, we collect the information you provide
          (such as email and stated goals). We may forward that submission to a webhook you configure
          for operations.
        </p>
        <p>
          <strong className="text-slate-100">Technical and usage information.</strong> We and our
          service providers may collect standard log and device data, including IP address, browser
          type, pages viewed, timestamps, and error diagnostics, to operate, secure, and improve the
          Service.
        </p>
        <p>
          <strong className="text-slate-100">Landing page assistant queries.</strong> Questions you
          ask on the public landing agent are processed to generate responses. That assistant is
          designed not to access your personal vault; optional AI phrasing may send your question (not
          your vault contents) to a third-party language model when configured.
        </p>
      </LegalSection>

      <LegalSection title="How we use information">
        <p>We use collected information to:</p>
        <LegalList
          items={[
            "Provide, maintain, and improve the Service (authentication, vault, graph, insights, imports, audits, and support).",
            "Process user-initiated scans and normalize results into structured records you can review.",
            "Communicate about access, security, or product updates when appropriate.",
            "Monitor reliability, prevent abuse, enforce our Terms, and comply with law.",
            "Respond to feedback, demo requests, and support inquiries.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Legal bases (where applicable)">
        <p>
          If you are in a region that requires a legal basis for processing (such as the EEA or UK),
          we rely on one or more of: performance of a contract, legitimate interests in operating and
          securing the Service, your consent (for example when you connect Gmail or submit a form), and
          compliance with legal obligations.
        </p>
      </LegalSection>

      <LegalSection title="How we share information">
        <p>We do not sell your personal information. We may share information with:</p>
        <LegalList
          items={[
            "Service providers that help us run the Service (for example Clerk for authentication, cloud hosting, PostgreSQL database providers such as Neon, and optional AI providers for graph explanations or landing-agent phrasing when enabled).",
            "Google when you authorize Gmail OAuth, subject to Google's policies and the scopes you approve.",
            "Third-party data sources used in public footprint audits only as needed to run audits you initiate (for example search, breach-check, or OSINT connectors configured in the deployment).",
            "Authorities or other parties when required by law, to protect rights and safety, or in connection with a merger or acquisition.",
          ]}
        />
        <p>
          Some third-party connectors process queries derived from information you supply (such as an
          email address or username) to return candidate results. Those providers have their own privacy
          practices.
        </p>
      </LegalSection>

      <LegalSection title="Data retention">
        <p>
          We retain information for as long as your account is active or as needed to provide the
          Service, unless a longer period is required by law. You may request deletion of your account
          data by contacting us; some logs or backups may persist for a limited period for security and
          compliance.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We use administrative, technical, and organizational measures appropriate to the nature of
          the Service, including HTTPS, encrypted storage of sensitive tokens where implemented, and
          least-privilege access to infrastructure. No method of transmission or storage is completely
          secure; we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <p>
          Depending on your location, you may have rights to access, correct, delete, or restrict
          processing of your personal information, or to object to certain processing. You can disconnect
          Gmail by revoking access in your Google Account security settings and removing connected
          import configuration in the Service where available.
        </p>
        <p>
          To exercise privacy rights or ask questions, contact us at{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="font-medium text-cyan-300 underline-offset-4 hover:underline"
          >
            {contactEmail}
          </a>
          . We may need to verify your identity before responding.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          The Service is not directed to children under 13 (or the minimum age required in your
          jurisdiction). We do not knowingly collect personal information from children. Contact us if
          you believe we have collected such information.
        </p>
      </LegalSection>

      <LegalSection title="International transfers">
        <p>
          We and our providers may process information in countries other than where you live. Where
          required, we use appropriate safeguards for cross-border transfers.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. We will post the updated version on this
          page and revise the effective date. Material changes may be communicated through the Service
          or by email where appropriate.
        </p>
      </LegalSection>

      <LegalSection title="Contact us">
        <p>
          Questions about this Privacy Policy:{" "}
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
