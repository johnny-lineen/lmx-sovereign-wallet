/**
 * Moves all VaultItem + VaultRelationship rows from a "source" User to your logged-in User.
 * Use when seed targeted the wrong clerkUserId but DATABASE_URL is correct.
 *
 * Required: VAULT_OWNER_CLERK_USER_ID — same value as auth().userId when you are signed in.
 * Optional: VAULT_MOVE_FROM_CLERK_USER_ID — explicit source (e.g. user_dev_lmx_owner).
 *   If omitted, picks another user with the highest vault item count (excluding target).
 *
 * Run: npm run db:align-vault
 */
const { loadEnvForCli } = require("./load-env-for-cli.js");

loadEnvForCli();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const targetClerk = (process.env.VAULT_OWNER_CLERK_USER_ID || "").trim();
  if (!targetClerk) {
    console.error(
      [
        "Set VAULT_OWNER_CLERK_USER_ID in .env.local to your Clerk user id (same as shown on the Vault page when empty).",
        "Optional: VAULT_MOVE_FROM_CLERK_USER_ID=user_dev_lmx_owner (or another id from npm run db:peek).",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  const targetUser = await prisma.user.findUnique({ where: { clerkUserId: targetClerk } });
  if (!targetUser) {
    console.error(`No User row for clerkUserId=${targetClerk}. Sign in once in the app, then run again.`);
    process.exit(1);
  }

  const explicitSourceClerk = (process.env.VAULT_MOVE_FROM_CLERK_USER_ID || "").trim();

  let sourceUser;
  if (explicitSourceClerk) {
    sourceUser = await prisma.user.findUnique({ where: { clerkUserId: explicitSourceClerk } });
    if (!sourceUser) {
      console.error(`No User row for VAULT_MOVE_FROM_CLERK_USER_ID=${explicitSourceClerk}`);
      process.exit(1);
    }
  } else {
    const rows = await prisma.user.findMany({
      where: { id: { not: targetUser.id } },
      select: {
        id: true,
        clerkUserId: true,
        _count: { select: { vaultItems: true } },
      },
    });
    const withItems = rows.filter((r) => r._count.vaultItems > 0);
    withItems.sort((a, b) => {
      const byCount = b._count.vaultItems - a._count.vaultItems;
      if (byCount !== 0) return byCount;
      return a.clerkUserId.localeCompare(b.clerkUserId);
    });
    const pick = withItems[0];
    if (!pick) {
      console.log("No other user with vault items found. Run npm run db:seed with SEED_CLERK_USER_ID set first.");
      return;
    }
    sourceUser = await prisma.user.findUnique({ where: { id: pick.id } });
    console.log(
      `[align-vault] Auto-selected source ${pick.clerkUserId} (${pick._count.vaultItems} items). Set VAULT_MOVE_FROM_CLERK_USER_ID to override.`,
    );
  }

  if (!sourceUser || sourceUser.id === targetUser.id) {
    console.log("Nothing to move (source and target are the same or source missing).");
    return;
  }

  const sourceCount = await prisma.vaultItem.count({ where: { userId: sourceUser.id } });
  if (sourceCount === 0) {
    console.log(`Source user ${sourceUser.clerkUserId} has no vault items.`);
    return;
  }

  const targetExisting = await prisma.vaultItem.count({ where: { userId: targetUser.id } });
  if (targetExisting > 0) {
    console.error(
      [
        `Target user ${targetUser.clerkUserId} already has ${targetExisting} vault item(s).`,
        "Aborting to avoid mixing two datasets. Clear target vault in Prisma Studio or pick a fresh DB.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  const targetRoot = await prisma.lMXIdentity.findFirst({
    where: { userId: targetUser.id, isRoot: true },
  });
  if (!targetRoot) {
    console.error("Target has no root LMXIdentity. Open the app once while signed in, then run again.");
    process.exit(1);
  }

  const [items, rels] = await prisma.$transaction([
    prisma.vaultItem.updateMany({
      where: { userId: sourceUser.id },
      data: { userId: targetUser.id, lmxIdentityId: targetRoot.id },
    }),
    prisma.vaultRelationship.updateMany({
      where: { userId: sourceUser.id },
      data: { userId: targetUser.id },
    }),
  ]);

  console.log(
    `Aligned vault: moved ${items.count} items and ${rels.count} relationships from ${sourceUser.clerkUserId} → ${targetUser.clerkUserId}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
