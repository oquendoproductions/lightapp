# Cloudflare Wildcard Tenant Router

This worker removes the need to add a custom domain in Cloudflare Pages for each tenant subdomain.

## What it does
- Captures `cityreport.io/*`, `www.cityreport.io/*`, and `*.cityreport.io/*`.
- Applies tenant resolver rules at the edge.
- Redirects alias paths like `cityreport.io/{slug}` to `https://{slug}.cityreport.io/`.
- Proxies all valid traffic to Pages origin (`lightapp-ak2.pages.dev`).
- Adds `x-tenant-key`, `x-tenant-mode`, and `x-tenant-env` headers.

## Files
- `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/cloudflare/tenant-router/wrangler.toml`
- `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/cloudflare/tenant-router/src/index.js`
- `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/cloudflare/tenant-router/src/router.js`
- `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/cloudflare/tenant-router/src/router.test.mjs`

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
curl -I https://testcity1.cityreport.io/
curl -I https://cityreport.io/testcity1
```

Expected:
- Subdomain URLs return `200` (or app-level `404`, not Cloudflare `522`).
- `cityreport.io/testcity1` returns `301` to `https://testcity1.cityreport.io/`.

## New tenant onboarding impact
After this worker is deployed, onboarding a new tenant does not require custom domain setup in Pages:
1. Add tenant row/config in platform admin.
2. Visit `https://{tenantKey}.cityreport.io/`.
