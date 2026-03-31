const path = require("path");
const {
  loadEnvForCli,
  describeEnvFiles,
  envFileExists,
  applyLastSeedClerkUserIdFromEnvLocal,
} = require(path.join(__dirname, "..", "scripts", "load-env-for-cli.js"));

loadEnvForCli();
applyLastSeedClerkUserIdFromEnvLocal();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function readSeedClerkUserId() {
  let v = (process.env.SEED_CLERK_USER_ID || "").trim();
  if (v.startsWith("\ufeff")) v = v.replace(/^\ufeff/, "").trim();
  return v;
}

function logSeedEnvHint() {
  const { cwd, envFile, localFile } = describeEnvFiles();
  const hasLocal = envFileExists(localFile);
  const hasEnv = envFileExists(envFile);
  console.log(`[seed] cwd: ${cwd}`);
  console.log(`[seed] .env exists: ${hasEnv} | .env.local exists: ${hasLocal}`);
  if (!hasLocal && !hasEnv) {
    console.warn("[seed] No .env or .env.local found in cwd — set DATABASE_URL and SEED_CLERK_USER_ID before seeding.");
  }
}

function logDatabaseTarget() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error("[seed] DATABASE_URL is not set after loading .env / .env.local");
    return;
  }
  try {
    const normalized = raw.replace(/^postgresql(\+[^:]*):\/\//i, "http://");
    const u = new URL(normalized);
    const db = (u.pathname || "").replace(/^\//, "").split("/")[0]?.split("?")[0] ?? "?";
    console.log(`[seed] DATABASE_URL -> ${u.hostname} / ${decodeURIComponent(db)}`);
  } catch {
    console.log("[seed] DATABASE_URL is set (could not parse for log)");
  }
}

/**
 * Fails fast with a clear message when DATABASE_URL points at a DB that has not
 * had MVP migrations applied (VaultItem / VaultRelationship).
 */
async function assertVaultTablesExist() {
  const rows = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'VaultRelationship'
    ) AS "vaultRelationshipExists"
  `;
  const exists = Boolean(rows[0]?.vaultRelationshipExists);
  if (!exists) {
    console.error(
      [
        "Seed aborted: this database does not have vault tables yet (e.g. public.\"VaultRelationship\").",
        "Bring the schema up to date, then run the seed again:",
        "  npm run db:migrate",
        "",
        "If migrate deploy fails with P3005 (non-empty DB without Prisma migration history), for local dev you can sync the schema with:",
        "  npm run db:push",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
}

async function main() {
  logSeedEnvHint();
  logDatabaseTarget();

  await assertVaultTablesExist();

  const developmentClerkUserId = readSeedClerkUserId();
  if (!developmentClerkUserId) {
    console.error(
      [
        "Seed aborted: set SEED_CLERK_USER_ID in .env.local (overrides .env) to your Clerk user id.",
        "That must be the same id Clerk passes to the app as auth().userId when you are logged in.",
        "",
        "Find it: Clerk Dashboard → Users → your user → copy “User ID” (starts with user_).",
        "Example in .env.local:",
        '  SEED_CLERK_USER_ID="user_2abc..."',
        "",
        "Then run: npm run db:seed",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log(
    `[seed] Using SEED_CLERK_USER_ID: ${developmentClerkUserId} (last SEED_CLERK_USER_ID= line in .env.local on disk wins)`,
  );

  const developmentUser = await prisma.user.upsert({
    where: { clerkUserId: developmentClerkUserId },
    update: {
      email: "alex.rivera@lmx.dev",
      name: "Alex Rivera",
      imageUrl: "https://i.pravatar.cc/200?img=68",
    },
    create: {
      clerkUserId: developmentClerkUserId,
      email: "alex.rivera@lmx.dev",
      name: "Alex Rivera",
      imageUrl: "https://i.pravatar.cc/200?img=68",
    },
  });

  const existingRootIdentity = await prisma.lMXIdentity.findFirst({
    where: {
      userId: developmentUser.id,
      isRoot: true,
    },
  });

  const rootLmxIdentity = existingRootIdentity
    ? await prisma.lMXIdentity.update({
        where: { id: existingRootIdentity.id },
        data: {
          displayName: "Alex Rivera",
          summary: "LMX Sovereign identity root for development graph seeding",
          isRoot: true,
        },
      })
    : await prisma.lMXIdentity.create({
        data: {
          userId: developmentUser.id,
          displayName: "Alex Rivera",
          summary: "LMX Sovereign identity root for development graph seeding",
          isRoot: true,
        },
      });

  await prisma.vaultRelationship.deleteMany({
    where: { userId: developmentUser.id },
  });
  await prisma.vaultItem.deleteMany({
    where: { userId: developmentUser.id },
  });

  const createVaultItem = async ({
    type,
    title,
    summary,
    provider,
    metadata,
    status = "active",
  }) => {
    return prisma.vaultItem.create({
      data: {
        userId: developmentUser.id,
        lmxIdentityId: rootLmxIdentity.id,
        type,
        status,
        title,
        summary,
        provider,
        metadata,
      },
    });
  };

  const emailPrimaryPersonal = await createVaultItem({
    type: "email",
    title: "alex.rivera@gmail.com",
    summary: "Primary personal inbox used for most accounts",
    provider: "Google Workspace",
    metadata: {
      address: "alex.rivera@gmail.com",
      label: "personal-primary",
      domain: "gmail.com",
      verified: true,
      primary: true,
      recoveryEnabled: true,
      breachRiskScore: 18,
    },
  });

  const emailPrimaryWork = await createVaultItem({
    type: "email",
    title: "alex@sovereignlabs.dev",
    summary: "Work email used for builder and productivity tools",
    provider: "Fastmail",
    metadata: {
      address: "alex@sovereignlabs.dev",
      label: "work-primary",
      domain: "sovereignlabs.dev",
      verified: true,
      primary: false,
      recoveryEnabled: true,
      breachRiskScore: 12,
    },
  });

  const emailFinancialSecure = await createVaultItem({
    type: "email",
    title: "alex.secure@proton.me",
    summary: "Isolated inbox for finance and high-risk alerts",
    provider: "Proton Mail",
    metadata: {
      address: "alex.secure@proton.me",
      label: "finance-secure",
      domain: "proton.me",
      verified: true,
      primary: false,
      recoveryEnabled: true,
      breachRiskScore: 7,
      mfaRequired: true,
    },
  });

  const emailShoppingAlias = await createVaultItem({
    type: "email",
    title: "alex+shopping@duck.com",
    summary: "Alias mailbox for commerce receipts and offers",
    provider: "DuckDuckGo Email Protection",
    metadata: {
      address: "alex+shopping@duck.com",
      label: "shopping-alias",
      domain: "duck.com",
      verified: true,
      primary: false,
      autoForwardTarget: "alex.rivera@gmail.com",
      breachRiskScore: 24,
    },
  });

  const emailLegacyRecovery = await createVaultItem({
    type: "email",
    title: "arivera1989@yahoo.com",
    summary: "Legacy recovery inbox retained for older services",
    provider: "Yahoo Mail",
    metadata: {
      address: "arivera1989@yahoo.com",
      label: "legacy-recovery",
      domain: "yahoo.com",
      verified: true,
      primary: false,
      recoveryEnabled: true,
      breachRiskScore: 41,
    },
  });

  const accountGithub = await createVaultItem({
    type: "account",
    title: "GitHub - alexrivera",
    summary: "Core engineering account for repositories and CI",
    provider: "GitHub",
    metadata: {
      username: "alexrivera",
      accountId: "gh_438822",
      role: "owner",
      mfaEnabled: true,
      securityKeyBound: true,
    },
  });

  const accountGoogle = await createVaultItem({
    type: "account",
    title: "Google Account",
    summary: "Personal Google identity for mail and drive",
    provider: "Google",
    metadata: {
      username: "alex.rivera@gmail.com",
      accountId: "google_790114",
      mfaEnabled: true,
      passkeyEnabled: true,
      lastSecurityReview: "2026-02-20",
    },
  });

  const accountApple = await createVaultItem({
    type: "account",
    title: "Apple ID",
    summary: "Device ecosystem account for iPhone and MacBook",
    provider: "Apple",
    metadata: {
      username: "alex.rivera@icloud.com",
      accountId: "apple_351209",
      mfaEnabled: true,
      trustedDevices: 2,
      icloudPrivateRelay: true,
    },
  });

  const accountNotion = await createVaultItem({
    type: "account",
    title: "Notion Workspace Account",
    summary: "Knowledge base and operations workspace login",
    provider: "Notion",
    metadata: {
      username: "alex@sovereignlabs.dev",
      workspace: "Sovereign Labs",
      accountId: "notion_88201",
      mfaEnabled: true,
    },
  });

  const accountFigma = await createVaultItem({
    type: "account",
    title: "Figma Account",
    summary: "Design collaboration account tied to startup projects",
    provider: "Figma",
    metadata: {
      username: "alex@sovereignlabs.dev",
      accountId: "figma_194104",
      mfaEnabled: true,
      teamRole: "editor",
    },
  });

  const accountChase = await createVaultItem({
    type: "account",
    title: "Chase Online Banking",
    summary: "Primary checking and operational cash management",
    provider: "Chase",
    metadata: {
      username: "alex.secure@proton.me",
      accountId: "chase_021889",
      accountType: "checking",
      mfaEnabled: true,
      highRisk: true,
    },
  });

  const accountCoinbase = await createVaultItem({
    type: "account",
    title: "Coinbase Account",
    summary: "Crypto exchange account for fiat on-ramp",
    provider: "Coinbase",
    metadata: {
      username: "alex.secure@proton.me",
      accountId: "coinbase_773411",
      mfaEnabled: true,
      withdrawalWhitelist: true,
      kycLevel: "verified",
    },
  });

  const accountAWS = await createVaultItem({
    type: "account",
    title: "AWS Root Account",
    summary: "Cloud infrastructure account for production workloads",
    provider: "Amazon Web Services",
    metadata: {
      username: "alex@sovereignlabs.dev",
      accountId: "aws_91044219",
      mfaEnabled: true,
      iamAccessAnalyzerEnabled: true,
      billingAlertsEnabled: true,
    },
  });

  const accountDiscord = await createVaultItem({
    type: "account",
    title: "Discord - alexrivera",
    summary: "Community and developer ecosystem account",
    provider: "Discord",
    metadata: {
      username: "alexrivera",
      accountId: "discord_778421",
      mfaEnabled: true,
      nitro: false,
    },
  });

  const accountX = await createVaultItem({
    type: "account",
    title: "X (Twitter) - @alexrivera",
    summary: "Public profile for product updates and launch notes",
    provider: "X",
    metadata: {
      username: "@alexrivera",
      accountId: "x_330928",
      mfaEnabled: true,
      verifiedBadge: false,
    },
  });

  const subscriptionGithubPro = await createVaultItem({
    type: "subscription",
    title: "GitHub Pro",
    summary: "Monthly developer subscription for private repos and tools",
    provider: "GitHub",
    metadata: {
      planName: "Pro",
      billingCycle: "monthly",
      renewalDate: "2026-04-02",
      amountUsd: 10,
      status: "active",
    },
  });

  const subscriptionNotionPlus = await createVaultItem({
    type: "subscription",
    title: "Notion Plus",
    summary: "Productivity plan used by the core startup team",
    provider: "Notion",
    metadata: {
      planName: "Plus",
      billingCycle: "yearly",
      renewalDate: "2027-01-14",
      amountUsd: 96,
      seats: 4,
      status: "active",
    },
  });

  const subscriptionNetflix = await createVaultItem({
    type: "subscription",
    title: "Netflix Standard",
    summary: "Personal entertainment subscription",
    provider: "Netflix",
    metadata: {
      planName: "Standard",
      billingCycle: "monthly",
      renewalDate: "2026-03-30",
      amountUsd: 15.49,
      status: "active",
    },
  });

  const deviceIphone = await createVaultItem({
    type: "device",
    title: "iPhone 15 Pro",
    summary: "Primary mobile device used for MFA and daily access",
    provider: "Apple",
    metadata: {
      platform: "iOS",
      osVersion: "18.3.1",
      serialSuffix: "H2Q9",
      passcodeEnabled: true,
      biometricEnabled: true,
      trustedForMfa: true,
    },
  });

  const deviceMacbook = await createVaultItem({
    type: "device",
    title: "MacBook Pro 14",
    summary: "Primary workstation for development and operations",
    provider: "Apple",
    metadata: {
      platform: "macOS",
      osVersion: "15.3",
      serialSuffix: "LK82",
      fileVaultEnabled: true,
      biometricEnabled: true,
      trustedForMfa: true,
    },
  });

  const paymentMethodAmexGold = await createVaultItem({
    type: "payment_method_reference",
    title: "Amex Gold (•••• 3104)",
    summary: "Primary card used for digital subscriptions",
    provider: "American Express",
    metadata: {
      brand: "amex",
      last4: "3104",
      expirationMonth: 11,
      expirationYear: 2028,
      billingZip: "10011",
      cardholderName: "Alex Rivera",
    },
  });

  const relationshipsData = [
    { from: accountGithub, to: emailPrimaryWork, relationType: "uses_email", metadata: { purpose: "login" } },
    { from: accountNotion, to: emailPrimaryWork, relationType: "uses_email", metadata: { purpose: "login" } },
    { from: accountFigma, to: emailPrimaryWork, relationType: "uses_email", metadata: { purpose: "login" } },
    { from: accountAWS, to: emailPrimaryWork, relationType: "uses_email", metadata: { purpose: "root-login" } },
    { from: accountGoogle, to: emailPrimaryPersonal, relationType: "uses_email", metadata: { purpose: "primary-account" } },
    { from: accountApple, to: emailPrimaryPersonal, relationType: "uses_email", metadata: { purpose: "notifications" } },
    { from: accountDiscord, to: emailPrimaryPersonal, relationType: "uses_email", metadata: { purpose: "login" } },
    { from: accountX, to: emailPrimaryPersonal, relationType: "uses_email", metadata: { purpose: "login" } },
    { from: accountChase, to: emailFinancialSecure, relationType: "uses_email", metadata: { purpose: "security-alerts" } },
    { from: accountCoinbase, to: emailFinancialSecure, relationType: "uses_email", metadata: { purpose: "security-alerts" } },
    { from: subscriptionNetflix, to: emailShoppingAlias, relationType: "uses_email", metadata: { purpose: "receipts" } },
    { from: accountApple, to: emailLegacyRecovery, relationType: "recovers_with", metadata: { reason: "legacy-recovery-chain" } },
    { from: accountGoogle, to: deviceIphone, relationType: "accesses", metadata: { mfaMethod: "prompt" } },
    { from: accountAWS, to: deviceMacbook, relationType: "accesses", metadata: { mfaMethod: "hardware-key-bridge" } },
    { from: accountChase, to: deviceIphone, relationType: "accesses", metadata: { mfaMethod: "otp-app" } },
    { from: accountCoinbase, to: deviceIphone, relationType: "accesses", metadata: { mfaMethod: "passkey" } },
    { from: subscriptionGithubPro, to: accountGithub, relationType: "belongs_to", metadata: { seatType: "individual" } },
    { from: subscriptionNotionPlus, to: accountNotion, relationType: "belongs_to", metadata: { workspaceSeat: "owner" } },
    { from: subscriptionNetflix, to: accountApple, relationType: "belongs_to", metadata: { signedUpVia: "apple-id" } },
    { from: subscriptionGithubPro, to: paymentMethodAmexGold, relationType: "pays_with", metadata: { autopay: true } },
    { from: subscriptionNotionPlus, to: paymentMethodAmexGold, relationType: "pays_with", metadata: { autopay: true } },
    { from: subscriptionNetflix, to: paymentMethodAmexGold, relationType: "pays_with", metadata: { autopay: true } },
  ];

  const createdRelationships = await Promise.all(
    relationshipsData.map((relationship) =>
      prisma.vaultRelationship.create({
        data: {
          userId: developmentUser.id,
          fromItemId: relationship.from.id,
          toItemId: relationship.to.id,
          relationType: relationship.relationType,
          metadata: relationship.metadata,
        },
      }),
    ),
  );

  const createdItemCount = await prisma.vaultItem.count({
    where: { userId: developmentUser.id },
  });

  console.log("Development seed complete");
  console.log(`Clerk user id (SEED_CLERK_USER_ID): ${developmentClerkUserId}`);
  console.log(`User: ${developmentUser.name} (${developmentUser.email})`);
  console.log(`Root identity: ${rootLmxIdentity.displayName} [${rootLmxIdentity.id}]`);
  console.log(`Vault items created: ${createdItemCount}`);
  console.log(`Vault relationships created: ${createdRelationships.length}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
