# Gate E Rate-Limit Patch Evidence

Generated: 2026-03-22 04:34:02 UTC

## Change
- File: `supabase/functions/rate-limit-gate/index.ts`
- Replaced invalid `admin.rpc(...).catch(...)` usage with non-blocking `try { await admin.rpc(...) } catch {}`.

## Verification
- `npm run build` => PASS

## Patch Snippet

```ts
        remaining: Math.max(0, maxEvents - (usedEvents + eventCount)),
        remainingUnits: Math.max(0, maxUnits - (usedUnits + unitCount)),
        degraded: true,
        reason: "write_failed",
      });
    }

    if (Math.random() < 0.05) {
      // Best-effort retention prune; never block allow/deny decisions.
      try {
        await admin.rpc("prune_abuse_rate_events", { p_retention: "7 days" });
      } catch {
        // non-blocking on purpose
      }
    }

    await logAbuseEvent(admin, {
      tenant_key: tenantKey,
      domain,
      identity_hash: identityHash,
      ip_hash: ipHash,
      event_kind: "rate_limit_allow",
      allowed: true,
```

## Deployment Note
- Runtime verification of this specific fix requires deploying the updated edge function to staging/production.
- In this session, Supabase management token was not available in environment, so deploy step is pending operator shell.
