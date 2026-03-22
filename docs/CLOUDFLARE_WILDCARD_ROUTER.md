# Cloudflare Wildcard Tenant Router

This worker removes the need to add a custom domain in Cloudflare Pages for each tenant subdomain.

## What it does
- Captures `cityreport.io/*`, `www.cityreport.io/*`, and `*.cityreport.io/*`.
- Applies tenant resolver rules at the edge.
- Redirects alias paths like `cityreport.io/{slug}` to `https://{slug}.cityreport.io/`.
- Returns controlled `404 Not Found` for unknown tenant slugs.
- Proxies valid traffic to Pages origin (`lightapp-ak2.pages.dev`).
- Adds `x-tenant-key`, `x-tenant-mode`, and `x-tenant-env` headers.

## Files
- `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/cloudflare/tenant-router/wrangler.toml`
- `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/cloudflare/tenant-router/src/index.js`
- `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/cloudflare/tenant-router/src/router.js`
- `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/cloudflare/tenant-router/src/router.test.mjs`

## Required worker vars
Defined in `cloudflare/tenant-router/wrangler.toml`:
- `PAGES_ORIGIN` (Pages hostname)
- `DEFAULT_TENANT_KEY` (fallback legacy redirect target)
- `KNOWN_TENANT_KEYS` (fallback allowlist; unknown slugs return 404 if not validated)
- `SUPABASE_URL` (used for runtime tenant validation)
- `TENANT_KEYS_SYNC_TTL_SEC` (cache TTL for synced tenant keys; default `30`)

Worker secret (set via wrangler):
- `SUPABASE_ANON_KEY`

Current value:
- `KNOWN_TENANT_KEYS = "ashtabulacity"`

## One-time DNS requirements
In Cloudflare DNS (`cityreport.io` zone):
- `CNAME cityreport.io -> lightapp-ak2.pages.dev` (Proxied)
- `CNAME * -> cityreport.io` (Proxied)
- `CNAME dev -> cityreport.io` (Proxied)

## Deploy
```bash
cd /Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/cloudflare/tenant-router
npx wrangler deploy
```

## Quick verify
```bash
curl -I https://ashtabulacity.cityreport.io/
curl -I https://cityreport.io/ashtabulacity
curl -I https://unknown-slug-does-not-exist.cityreport.io/
curl -I https://cityreport.io/unknown-slug-does-not-exist
```

Expected:
- Known tenant paths return app responses (`200` or app-level status).
- Unknown tenant paths return worker `404` with `cache-control: no-store`.

## New tenant onboarding impact
After this worker is deployed, onboarding a tenant does not require Pages custom-domain setup.

Current behavior:
1. Worker first checks cached/synced active tenant keys from Supabase.
2. If an unknown slug is requested, worker probes Supabase for that specific `tenant_key` + `active=true`.
3. If active, slug is admitted immediately and routed without manual allowlist update.
4. If not active/not found, worker returns controlled `404`.

Fallback behavior:
- If Supabase lookup fails, `KNOWN_TENANT_KEYS` remains the safety net.

Manual fallback flow (if needed):
1. Add tenant row/config in platform admin.
2. Add tenant key to `KNOWN_TENANT_KEYS` in worker vars.
3. Deploy worker.
4. Visit `https://{tenantKey}.cityreport.io/`.
