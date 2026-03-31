# Environment Matrix (Vercel + Managed Postgres)

| Variable | Preview | Production | Notes |
|---|---|---|---|
| `DATABASE_URL` | Preview DB URL | Production DB URL | Never reuse production DB in preview |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Preview key | Production key | Must match Clerk environment |
| `CLERK_SECRET_KEY` | Preview secret | Production secret | Store as protected env vars |
| `NEXT_PUBLIC_APP_URL` | Preview deployment URL | Canonical app URL | No trailing slash |
| `GOOGLE_GMAIL_CLIENT_ID` | Optional preview OAuth client | Production OAuth client | Keep redirect URI exact |
| `GOOGLE_GMAIL_CLIENT_SECRET` | Optional preview secret | Production secret | Rotate if exposed |
| `GOOGLE_GMAIL_REDIRECT_URI` | Preview callback URL | Production callback URL | `/api/import/gmail/callback` |
| `LMX_TOKEN_ENCRYPTION_KEY` | Preview key | Production key | At least 32 chars; rotate with migration plan |
| `OPENAI_API_KEY` | Optional preview key | Production key | Used by graph explain service |
| `GRAPH_EXPLAIN_MODEL` | Optional | Optional | Defaults to `gpt-4o-mini` |
| `GRAPH_EXPLAIN_API_URL` | Optional | Optional | Defaults to OpenAI endpoint |

## Deploy Rules

- Preview deployments use preview-scoped variables only.
- Production deployment is restricted to `main`.
- Enable required reviewer checks before production deploy.
- Run `npm run db:migrate` against production DB before promoting app changes that require schema updates.

## Database Safety

- Enable daily backups and point-in-time recovery (PITR) in your managed Postgres provider.
- Keep at least 7-14 days retention during test-user phase.
- Test one restore in a non-production database before onboarding broad test cohorts.
