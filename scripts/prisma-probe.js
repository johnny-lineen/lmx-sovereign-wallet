const { loadEnvConfig } = require("@next/env");
const { PrismaClient } = require("@prisma/client");

loadEnvConfig(process.cwd(), true);

async function main() {
  const db = process.env.DATABASE_URL || "";
  console.log("dbPrefix", db.split("://")[0] || "missing");
  const prisma = new PrismaClient();
  try {
    const count = await prisma.user.count();
    console.log("probe_ok", count);
  } catch (error) {
    console.log("probe_err_code", error && error.code ? error.code : "unknown");
    console.log("probe_err_msg", error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect();
  }
}

main();
