# Release Posture Snapshot

Generated: 2026-03-22 05:42:53 UTC
Repo root: /Users/oquendoproductions/Documents/New project

## Summary
- Build: `PASS`
- Tenant router tests: `PASS`

## Build Output
```text

> streetlight-web@0.0.0 build
> vite build

vite v7.3.1 building client environment for production...
transforming...
✓ 94 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                              1.70 kB │ gzip:   0.61 kB
dist/assets/App-BYl5VIvE.css                12.24 kB │ gzip:   3.48 kB
dist/assets/index-DLjwyHDQ.css              15.67 kB │ gzip:   6.48 kB
dist/assets/RedirectingApp-BxTgvvn3.js       0.25 kB │ gzip:   0.23 kB
dist/assets/TenantNotFoundApp-K_-a5jBz.js    0.51 kB │ gzip:   0.35 kB
dist/assets/App-DFIp6K30.js                 18.07 kB │ gzip:   5.91 kB
dist/assets/PlatformAdminApp-D079_yRV.js    52.84 kB │ gzip:  11.55 kB
dist/assets/index-Csyqmzos.js              374.05 kB │ gzip: 109.18 kB
dist/assets/MapGoogleFull-BlZK6b8q.js      540.14 kB │ gzip: 125.30 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 757ms
```

## Tenant Router Test Output
```text
[tenant-router][unknown-slug] {"host":"unknown-slug.cityreport.io","path":"/","slug":"unknown-slug","ts":"2026-03-22T05:42:53.244Z"}
✔ forwards tenant headers to upstream Pages request (10.055ms)
✔ unknown tenant does not proxy upstream and returns 404 (1.143375ms)
✔ auto-syncs active tenant keys from Supabase before resolving host (0.731375ms)
✔ apex root resolves marketing home (0.515834ms)
✔ apex /platform resolves platform admin (0.371375ms)
✔ assets host is passthrough and not tenant-resolved (0.080334ms)
✔ apex static assets are passthrough and not tenant redirects (0.083416ms)
✔ apex legal path stays on apex for static legal page serving (0.065458ms)
✔ apex slug redirects to canonical subdomain (0.076125ms)
✔ apex unknown tenant slug returns not found when known tenant set is provided (0.06325ms)
✔ subdomain serves municipality app (0.052875ms)
✔ unknown subdomain returns not found when known tenant set is provided (0.055667ms)
✔ legacy /gmaps redirects to tenant root (0.084083ms)
✔ dev host path mode resolves municipality app in staging (0.071792ms)
✔ reserved slug subdomain returns not found + event (0.596541ms)
✔ defaults tenant key for unknown host /gmaps (0.078166ms)
ℹ tests 16
ℹ suites 0
ℹ pass 16
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 41.73925
```
