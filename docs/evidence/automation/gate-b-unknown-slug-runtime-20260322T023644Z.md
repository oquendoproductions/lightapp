# Gate B Unknown Slug Runtime Verification

Generated: 2026-03-22 02:36:51 UTC
Worker: cityreport-tenant-router

## HTTP Verification

- Request: `https://dev.cityreport.io/unknown-slug-does-not-exist`
- Response status: 404
- Body sample: Not Found

## Header Snapshot

```text
HTTP/2 404 
date: Sun, 22 Mar 2026 02:36:51 GMT
content-type: text/plain; charset=utf-8
report-to: {"group":"cf-nel","max_age":604800,"endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=ZjIpcjfIpNZGN6YHjYYOVwnF0RQMkhF0cWbtvjWBEJmZ%2FTT%2F6FcoFmYZOADMIHwXYNRGMe13wPMyxNcvFGlklQJK%2BODiWKNjIF6IFK2txHf0"}]}
nel: {"report_to":"cf-nel","success_fraction":0.0,"max_age":604800}
cache-control: no-store
server: cloudflare
cf-ray: 9e01cfa80f691272-IAD
```

## Worker Log Verification

- Unknown slug warning event observed in worker tail output.

```text
16:                "[tenant-router][unknown-slug]",
17:                "{\"host\":\"dev.cityreport.io\",\"path\":\"/unknown-slug-does-not-exist\",\"slug\":\"unknown-slug-does-not-exist\",\"ts\":\"2026-03-22T02:36:47.646Z\"}"
26:            "url": "https://dev.cityreport.io/unknown-slug-does-not-exist",
97:            "status": 404
```
