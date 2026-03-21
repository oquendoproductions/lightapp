# Deployment Runbook

## Pre-deploy
1. Confirm scope is still in migration guardrails:
   - tenant architecture only
   - blocker bug fixes only
2. Create isolated staging backend before any production deploy:
   - follow [/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/docs/STAGING_SETUP.md](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/docs/STAGING_SETUP.md)
   - run `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/scripts/staging/create_and_bootstrap_staging.sh`
3. Run local build and quick smoke pass:
   - homepage loads on apex mode
   - municipality app mode loads map shell
   - pothole submit path
   - water/drain submit path
   - admin open reports
4. Verify tenant resolver behavior in local/dev host simulation:
   - `cityreport.io/`
   - `cityreport.io/ashtabulacity`
   - `ashtabulacity.cityreport.io/`
   - `dev.cityreport.io/ashtabulacity`
5. Verify edge function payloads include `tenant_key`.

## Commands
```bash
cd /Users/oquendoproductions/Desktop/streetlight-app/streetlight-web
git status
git add src/ supabase/ docs/ vite.config.js
git commit -m "multi-tenant: resolver + tenant-key foundation"
git push origin main
```

## Cloudflare Pages / DNS
1. Keep `cityreport.io` apex serving marketing homepage mode.
2. Keep municipality canonical host pattern: `{slug}.cityreport.io`.
3. Keep dev host pattern: `dev.cityreport.io/{slug}`.
4. Deploy worker router from `cloudflare/tenant-router` (see `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/docs/CLOUDFLARE_WILDCARD_ROUTER.md`).
5. Do not cut over DNS for municipality canonical routes until Gate D/E checks pass.

## Production Smoke Checklist
1. `https://cityreport.io` shows marketing homepage.
2. `https://ashtabulacity.cityreport.io` shows municipality app.
3. `/gmaps` legacy URL redirects to municipality root.
4. Guest pothole report still submits successfully.
5. Guest water/drain report still submits successfully.
6. Admin open reports and lifecycle actions still function.
7. Export summary/detail still function.

## Rollback
1. Revert to previous known-good commit.
2. Push revert commit.
3. Validate apex + municipality smoke checks.
