# Test User Launch Checklist

## Preflight (must pass)

- [ ] `npm run check` passes on main branch.
- [ ] `GET /api/health` is healthy in production.
- [ ] Security headers present on app routes.
- [ ] Gmail OAuth callback and state validation confirmed.
- [ ] Import job start path enforces rate limits and safe error messages.
- [ ] Import candidate review path prevents duplicate approval side effects.

## Test Cohort Rollout

- [ ] Start with 5-10 allowlisted test users.
- [ ] Monitor logs daily for import failures and 429 spikes.
- [ ] Track job statuses (`completed`, `failed`) and failure reasons.
- [ ] Capture user-reported blockers with severity labels.

## Incident Handling

- [ ] If severe regression appears, execute rollback runbook.
- [ ] Pause new user invites during unresolved incidents.
- [ ] Document root cause and preventive test coverage.

## Exit Criteria for Wider Beta

- [ ] At least 7 days stable operation.
- [ ] No critical auth or data-integrity incidents.
- [ ] Failure alerts and on-call ownership confirmed.
