# Runbook: Deployment

## Pre-Deploy Checklist

- [ ] All tests pass locally
- [ ] No hardcoded localhost URLs in `src/`
- [ ] No dev JWTs or test API keys in code
- [ ] All `process.env.*` references verified against deployment config
- [ ] Changes committed AND pushed (commit without push = no deploy)
- [ ] Build succeeds locally

## Deployment Steps

1. Ensure all tests pass: `npm test`
2. Build the project: `npm run build`
3. Commit and push to the deploy branch
4. Verify deployment succeeded (don't just check HTTP 200 — verify new content is live)
5. Check deployed commit hash matches what was pushed

## Post-Deploy Verification

- [ ] New changes are visible/functional
- [ ] No console errors in production
- [ ] Core user flows still work
- [ ] API endpoints responding correctly

## Rollback

If deployment fails:
1. Check build logs for errors
2. If critical: revert the commit and push
3. Document the failure in the engineering log
