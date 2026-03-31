/**
 * Prints each User row with vault item and relationship counts.
 * Run: npm run db:peek
 */
const { loadEnvForCli } = require("./load-env-for-cli.js");

loadEnvForCli();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      clerkUserId: true,
      email: true,
      name: true,
      _count: {
        select: {
          vaultItems: true,
          relationships: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(JSON.stringify(users, null, 2));

  if (users.length === 0) {
    console.log("\nNo User rows found.");
  } else {
    const totalItems = users.reduce((s, u) => s + u._count.vaultItems, 0);
    const totalRels = users.reduce((s, u) => s + u._count.relationships, 0);
    console.log(`\nTotals across all users: ${totalItems} vault items, ${totalRels} relationships.`);

    const hasItems = users.some((u) => u._count.vaultItems > 0);
    const hasEmpty = users.some((u) => u._count.vaultItems === 0);
    if (hasItems && hasEmpty) {
      console.log(
        [
          "",
          "Note: Some User rows have vaultItems: 0 and others have data.",
          "Updating .env does not move database rows. To attach mock data to your login:",
          "  • Reseed: set SEED_CLERK_USER_ID to your exact clerkUserId above, then: npm run db:seed",
          "  • Or move: set VAULT_OWNER_CLERK_USER_ID + VAULT_MOVE_FROM_CLERK_USER_ID in .env.local, then: npm run db:align-vault",
        ].join("\n"),
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
