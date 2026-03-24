This is the **LMX Sovereign Wallet** MVP — Phase 1 (foundation): Next.js App Router, Clerk auth, Prisma + PostgreSQL, and a protected app shell.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com) v4 + [shadcn/ui](https://ui.shadcn.com)
- [Clerk](https://clerk.com) authentication
- [Prisma](https://www.prisma.io) ORM (PostgreSQL)
- [Zod](https://zod.dev) validation

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables**

   Copy `.env.example` to `.env.local` and fill in values (see [Environment variables](#environment-variables) below).

3. **Database**

   Create a PostgreSQL database and set `DATABASE_URL`.

   Apply migrations:

   ```bash
   npx prisma migrate deploy
   ```

   For local development you can use:

   ```bash
   npx prisma migrate dev
   ```

4. **Clerk**

   In the [Clerk Dashboard](https://dashboard.clerk.com), create an application and add the publishable and secret keys to `.env.local`.

   Set paths (or rely on env defaults that match this repo):

   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
   - After sign-in / sign-up: `/dashboard`

5. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Unauthenticated users are sent to sign-in; after login, routes live under the authenticated shell (`/dashboard`, etc.).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string for Prisma |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | No | Default `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | No | Default `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | No | Default `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | No | Default `/dashboard` |

For hosted Postgres (e.g. Supabase, Neon, Railway), use the provider’s **pooled** or **direct** URL as recommended for Prisma; add `?sslmode=require` if required.

## Deploy notes (Vercel + hosted Postgres)

- Set the same env vars in Vercel.
- Build command: `npm run build` (runs `prisma generate` then `next build`).
- Run migrations against production from CI or your host: `npx prisma migrate deploy` with `DATABASE_URL` pointing at production.

## Project layout (high level)

- `app/` — routes, layouts, API route handlers
- `components/` — UI (no direct database access)
- `lib/` — shared utilities, Prisma client, Zod schemas
- `server/services/` — domain logic
- `server/repositories/` — Prisma data access
- `prisma/` — schema and migrations

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Clerk + Next.js](https://clerk.com/docs/quickstarts/nextjs)
- [Prisma Docs](https://www.prisma.io/docs)
