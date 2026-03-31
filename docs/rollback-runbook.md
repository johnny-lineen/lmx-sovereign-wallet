# Rollback Runbook

## App Rollback (Vercel)

1. Identify the last known-good deployment in Vercel.
2. Promote that deployment to production.
3. Confirm `GET /api/health` returns `200` and core auth/import flows work.
4. Announce rollback in team channel with incident summary and next actions.

## Database Rollback Guidelines

- Prefer **forward-fix** migrations over destructive rollbacks.
- If rollback is required:
  1. Stop write-heavy actions (temporarily disable user import access if needed).
  2. Restore DB snapshot/PITR to a new instance first.
  3. Validate schema/data integrity against expected version.
  4. Point app to restored instance only after validation.

## Trigger Conditions

- Sustained 5xx error rates > 5% for 10 minutes.
- Auth flow regression affecting sign-in/sign-up.
- Import approval creates duplicate records unexpectedly.
- Health endpoint unavailable in production.

## Post-Rollback

- Open an incident ticket with timeline and root-cause hypotheses.
- Add failing case to tests before re-release.
- Ship fix behind a controlled rollout when possible.
