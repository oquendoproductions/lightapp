# Gate A RLS + Staging Runtime Checks

Generated: 2026-03-22 02:28:04 UTC
Project ref: madjklbsdwbtrqhpxmfs

## RLS Runtime Verification

```text
BEGIN
                  set_config                  
----------------------------------------------
 {"role":"anon","tenant_key":"ashtabulacity"}
(1 row)

SET
 role_user | resolved_tenant 
-----------+-----------------
 anon      | ashtabulacity
(1 row)

 ashtabula_rows | other_rows 
----------------+------------
              3 |          0
(1 row)

ROLLBACK
BEGIN
                   set_config                    
-------------------------------------------------
 {"role":"authenticated","tenant_key":"default"}
(1 row)

SET
   role_user   | resolved_tenant 
---------------+-----------------
 authenticated | default
(1 row)

 default_rows | other_rows 
--------------+------------
            1 |          0
(1 row)

ROLLBACK
```

## Staging Runtime Endpoint Checks

### https://dev.cityreport.io/ashtabulacity

```text
HTTP/2 200 
date: Sun, 22 Mar 2026 02:28:05 GMT
content-type: text/html; charset=utf-8
report-to: {"group":"cf-nel","max_age":604800,"endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=I76YGrLCwzzuO%2FECrMpjuVEMdBmK%2B%2FCMcHpkczVpIn1C%2BuiXvZ4OHs%2FIQqmx%2BGmqI%2Blf6ktdcoISV1G2pJ7Aw%2F2gH13D2u8K4OYFSBQ%2Box4G"}]}
nel: {"report_to":"cf-nel","success_fraction":0.0,"max_age":604800}
cf-ray: 9e01c2cf08218009-IAD
access-control-allow-origin: *
cache-control: public, max-age=0, must-revalidate
x-content-type-options: nosniff
server: cloudflare
vary: Accept-Encoding
referrer-policy: strict-origin-when-cross-origin
```

### https://dev.cityreport.io/unknown-slug-does-not-exist

```text
HTTP/2 200 
date: Sun, 22 Mar 2026 02:28:05 GMT
content-type: text/html; charset=utf-8
report-to: {"group":"cf-nel","max_age":604800,"endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=c6qxeJhmVVTOdfg6Jo9Mz12MB1SUJFXyoPN3yV1zhhI1b326dJIU9s%2FYRNKHr7vpYXgbLKlmA7q%2BbLcchfS3cROMPT%2FES21pbb2eVrS3DbqL"}]}
nel: {"report_to":"cf-nel","success_fraction":0.0,"max_age":604800}
cf-ray: 9e01c2d01b8946fd-IAD
access-control-allow-origin: *
cache-control: public, max-age=0, must-revalidate
x-content-type-options: nosniff
server: cloudflare
vary: Accept-Encoding
referrer-policy: strict-origin-when-cross-origin
```

### https://dev.cityreport.io/gmaps

```text
HTTP/2 301 
date: Sun, 22 Mar 2026 02:28:06 GMT
location: https://dev.cityreport.io/ashtabulacity/
report-to: {"group":"cf-nel","max_age":604800,"endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=pwqCKzC%2BRb2X1qxdLt10VuHWaBPdmRm30mYMHnDXxZrjyNWpoa%2B42O4LO7bcF%2F4rwJY2KIr3mwYoHfME4Z8jDPKAArpx%2FzJQiyoliaIC2iWc"}]}
nel: {"report_to":"cf-nel","success_fraction":0.0,"max_age":604800}
server: cloudflare
cf-ray: 9e01c2d19e7af276-IAD

```

## Edge Function tenant_key Enforcement (staging project)

### rate-limit-gate missing tenant_key

```text
HTTP/2 400 
date: Sun, 22 Mar 2026 02:28:06 GMT
content-type: application/json
server: cloudflare
cf-ray: 9e01c2d25e138792-IAD
cf-cache-status: DYNAMIC
access-control-allow-origin: *
strict-transport-security: max-age=31536000; includeSubDomains; preload
vary: Accept-Encoding
access-control-allow-headers: authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-api-version, x-tenant-key
access-control-allow-methods: POST, OPTIONS
sb-gateway-version: 1
sb-project-ref: madjklbsdwbtrqhpxmfs
sb-request-id: 019d135e-ffa0-7a4c-9b62-64b7be628bea
x-deno-execution-id: d789510a-9644-492f-8c59-a5669c6ef89b
x-sb-edge-region: us-east-1
x-served-by: supabase-edge-runtime
set-cookie: __cf_bm=LMNEGPopuaY4BZO.dkQCXeySJyzQhm8l6CXE00_BRT8-1774146486-1.0.1.1-TyYZspLcAcu5RYsSINZ1G6Pmtdgu39jUJJkRbVfYhuZxkqnu0WDxKMR7NmCuQpEKV1B61bD_1Eh30hyL7GzDZJi5IMhKMCzOVmhrOD4ERG4; path=/; expires=Sun, 22-Mar-26 02:58:06 GMT; domain=.supabase.co; HttpOnly; Secure; SameSite=None
```

### email-pothole-report missing tenant_key

```text
HTTP/2 400 
date: Sun, 22 Mar 2026 02:28:06 GMT
content-type: application/json
server: cloudflare
cf-ray: 9e01c2d54ef7e615-IAD
cf-cache-status: DYNAMIC
access-control-allow-origin: *
strict-transport-security: max-age=31536000; includeSubDomains; preload
vary: Accept-Encoding
access-control-allow-headers: authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-api-version, x-tenant-key
access-control-allow-methods: POST, OPTIONS
sb-gateway-version: 1
sb-project-ref: madjklbsdwbtrqhpxmfs
sb-request-id: 019d135f-0151-7566-9a25-dfa69d52563d
x-deno-execution-id: a48653c3-5d84-4240-ad22-9539c71fd040
x-sb-edge-region: us-east-1
x-served-by: supabase-edge-runtime
set-cookie: __cf_bm=c8_0HzZxp8.H1fW2lqz9wld.UgvM6MNVBiUK7LNN9LE-1774146486-1.0.1.1-EEluojCMfhTaVrNmsZBF6U3Cy0xXIpY2DJyvqvCtj7R1c9KnpoZiZxiqW5KEr5hWAqeBaTggpdZ1oiXNEGX0G7zXAm1XHCNpG26ZYyrhc2Y; path=/; expires=Sun, 22-Mar-26 02:58:06 GMT; domain=.supabase.co; HttpOnly; Secure; SameSite=None
```

### email-water-drain-report missing tenant_key

```text
HTTP/2 400 
date: Sun, 22 Mar 2026 02:28:06 GMT
content-type: application/json
server: cloudflare
cf-ray: 9e01c2d6be7357ae-IAD
cf-cache-status: DYNAMIC
access-control-allow-origin: *
strict-transport-security: max-age=31536000; includeSubDomains; preload
vary: Accept-Encoding
access-control-allow-headers: authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-api-version, x-tenant-key
access-control-allow-methods: POST, OPTIONS
sb-gateway-version: 1
sb-project-ref: madjklbsdwbtrqhpxmfs
sb-request-id: 019d135f-023a-7a70-8aff-c8f28d2558b8
x-deno-execution-id: e39e9a43-8523-49eb-b27f-5fd7714345c8
x-sb-edge-region: us-east-1
x-served-by: supabase-edge-runtime
set-cookie: __cf_bm=7ss4VIdAXXEsm0Dz5ItEBGkEbbUSjdFknWxv_nFnzBk-1774146486-1.0.1.1-2sD8.3uRDTrTsvTX0NMF2Ejrl8SLF5hxIsrZV042TvwIF1B1ZGdQwVIQwePCkjMuEp9fXbw2dU2nyncXydDfteMgANBJ.zf8LQIURteIwMU; path=/; expires=Sun, 22-Mar-26 02:58:06 GMT; domain=.supabase.co; HttpOnly; Secure; SameSite=None
```

### cache-official-light-geo missing tenant_key

```text
HTTP/2 400 
date: Sun, 22 Mar 2026 02:28:07 GMT
content-type: application/json
server: cloudflare
cf-ray: 9e01c2d84b213956-IAD
cf-cache-status: DYNAMIC
access-control-allow-origin: *
strict-transport-security: max-age=31536000; includeSubDomains; preload
vary: Accept-Encoding
access-control-allow-headers: authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-api-version, x-tenant-key
access-control-allow-methods: POST, OPTIONS
sb-gateway-version: 1
sb-project-ref: madjklbsdwbtrqhpxmfs
sb-request-id: 019d135f-033a-7ca0-b616-c356d82ab389
x-deno-execution-id: cf3afbfb-c03e-4503-b7d1-49397f4c470d
x-sb-edge-region: us-east-1
x-served-by: supabase-edge-runtime
set-cookie: __cf_bm=QPyuV12p6E4pjSrZXzqwSAPIE06FdrbkBT6HCx1WFXc-1774146487-1.0.1.1-rGKFwvtW4EyX1S7.E7doKDNnDIfMf1IkGC781Va421k1g25rBRlNj7xFQP61ejyJllmTAqilhCgvo2h67MLX0ChsXTWK.dFnZxlk7cTZ2c8; path=/; expires=Sun, 22-Mar-26 02:58:07 GMT; domain=.supabase.co; HttpOnly; Secure; SameSite=None
```

