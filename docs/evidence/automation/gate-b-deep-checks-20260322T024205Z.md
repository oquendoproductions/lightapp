# Gate B Deep Isolation Checks

Generated: 2026-03-22 02:42:05 UTC

## Worker Header Forwarding Tests

```text
[tenant-router][unknown-slug] {"host":"unknown-slug.cityreport.io","path":"/","slug":"unknown-slug","ts":"2026-03-22T02:42:05.722Z"}
✔ forwards tenant headers to upstream Pages request (10.144667ms)
✔ unknown tenant does not proxy upstream and returns 404 (1.111417ms)
✔ apex root resolves marketing home (0.531708ms)
✔ apex /platform resolves platform admin (0.070459ms)
✔ assets host is passthrough and not tenant-resolved (0.052084ms)
✔ apex static assets are passthrough and not tenant redirects (0.064542ms)
✔ apex slug redirects to canonical subdomain (0.071ms)
✔ apex unknown tenant slug returns not found when known tenant set is provided (0.056291ms)
✔ subdomain serves municipality app (0.056083ms)
✔ unknown subdomain returns not found when known tenant set is provided (0.045459ms)
✔ legacy /gmaps redirects to tenant root (0.055125ms)
✔ dev host path mode resolves municipality app in staging (0.091542ms)
✔ reserved slug subdomain returns not found + event (0.698791ms)
✔ defaults tenant key for unknown host /gmaps (0.087417ms)
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 41.940417
```

## tenant_key Nullability Inventory (staging DB)

```text
          table_name          | is_nullable 
------------------------------+-------------
 abuse_events                 | NO
 abuse_rate_events            | NO
 email_delivery_daily_metrics | YES
 email_delivery_events        | NO
 fixed_lights                 | NO
 incident_events              | NO
 incident_state_current       | NO
 light_actions                | NO
 official_lights              | NO
 official_signs               | NO
 pothole_reports              | NO
 potholes                     | NO
 reports                      | NO
 tenant_admins                | NO
 tenant_audit_log             | YES
 tenant_files                 | NO
 tenant_map_features          | NO
 tenant_profiles              | NO
 tenant_visibility_config     | NO
 tenants                      | NO
 utility_report_status        | NO
 water_drain_incidents        | NO
(22 rows)

```

## Null tenant_key Write Rejection Proof

```text
BEGIN
ERROR:  null value in column "tenant_key" of relation "tenant_map_features" violates not-null constraint
DETAIL:  Failing row contains (null, t, t, 0.42, 2026-03-22 02:42:06.247665+00, 2026-03-22 02:42:06.247665+00, #e53935, 4.00).
EXIT:1
```

## Storage Upload Path Prefix Proof

```text
15964:    const path = `${tenantKey}/${domain}/${new Date().toISOString().slice(0, 10)}/${ts}_${keyHint || "report"}_${rand}.${ext}`;
 15958	    const tenantKey = activeTenantKey();
 15959	    const domain = normalizeDomainKey(domainKey || "general");
 15960	    const ext = extFromFileName(f.name, "jpg");
 15961	    const ts = Date.now();
 15962	    const rand = Math.random().toString(36).slice(2, 9);
 15963	    const keyHint = String(reportKeyHint || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
 15964	    const path = `${tenantKey}/${domain}/${new Date().toISOString().slice(0, 10)}/${ts}_${keyHint || "report"}_${rand}.${ext}`;
 15965	    const { error: upErr } = await supabase.storage.from("report-images").upload(path, f, {
 15966	      cacheControl: "3600",
 15967	      upsert: false,
 15968	      contentType: f.type || undefined,
 15969	    });
 15970	    if (upErr) throw upErr;
 15971	    const { data } = supabase.storage.from("report-images").getPublicUrl(path);
 15972	    return String(data?.publicUrl || "").trim();
 15973	  }
 15974	
```
