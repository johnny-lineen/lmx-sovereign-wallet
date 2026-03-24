import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

// Ensure the same env files Next uses (.env.local, .env.development.local, etc.)
// are loaded before Prisma reads DATABASE_URL (Turbopack can evaluate this module early).
const isDev = process.env.NODE_ENV !== "production";
loadEnvConfig(process.cwd(), isDev);

if (!process.env.DATABASE_URL && process.env.database_url) {
  process.env.DATABASE_URL = process.env.database_url;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Add it to `.env.local` (name must be DATABASE_URL in capitals, not database_url) and restart `npm run dev`. Prisma CLI reads `.env` by default.",
  );
}

if (process.env.NODE_ENV === "development") {
  try {
    const normalized = databaseUrl.replace(/^postgresql(\+[^:]*):\/\//i, "http://");
    const { hostname, pathname } = new URL(normalized);
    const dbName = pathname.replace(/^\//, "").split("/")[0] ?? "";
    const dbSegment = dbName.split("?")[0] ?? "";
    let decodedDb = dbSegment;
    try {
      decodedDb = decodeURIComponent(dbSegment);
    } catch {
      /* keep raw segment */
    }
    if (dbSegment.includes("%22") || decodedDb.includes('"')) {
      throw new Error(
        'DATABASE_URL includes a stray `"` in the database name (Postgres reports names like `sovereign_wallet%22`). In `.env.local`, wrap the entire URL in one pair of quotes only—do not add `"` after the database name. Example: DATABASE_URL="postgresql://postgres:secret@localhost:5432/sovereign_wallet?schema=public"',
      );
    }
    const placeholderHost = hostname === "HOST" || hostname === "YOUR_POSTGRES_HOST";
    const placeholderDb = dbName === "DATABASE" || dbName === "YOUR_DATABASE_NAME";
    if (placeholderHost || placeholderDb) {
      throw new Error(
        "DATABASE_URL still looks like `.env.example` placeholders (e.g. host `HOST` / `YOUR_POSTGRES_HOST`, or database `DATABASE`). Paste the full connection string from your Postgres provider (Neon, Supabase, Railway, etc.) or use a real local URL like `postgresql://USER:PASSWORD@localhost:5432/mydb?schema=public`.",
      );
    }
  } catch (err) {
    if (err instanceof TypeError) {
      // Invalid URL shape; let Prisma surface connection errors.
    } else {
      throw err;
    }
  }
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
