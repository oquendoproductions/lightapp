# Municipality Updates Launch Checklist

Use this checklist when turning on the resident updates homepage for a tenant.

## 1. Apply database migrations

From the app workspace:

```bash
cd /Users/oquendoproductions/Desktop/streetlight-app/streetlight-web
supabase migration list
supabase db push --include-all --yes
```

If you are targeting a linked remote project, verify the CLI is linked to the correct Supabase project first.

Required migrations for this feature:

- `20260324143000_municipality_updates_hub.sql`
- `20260325000500_tenant_resident_portal_toggle.sql`

## 2. Build and deploy the web app

```bash
cd /Users/oquendoproductions/Desktop/streetlight-app/streetlight-web
npm test
npm run build
```

Deploy with the same process already used for the tenant web frontend.

## 3. Enable the tenant switch

Open Platform Admin for the target tenant and turn on:

- `Resident Updates Homepage Enabled`

This keeps rollout selective. Tenants with the switch off still open directly into the map/reporting workspace.

## 4. Seed first content

For the target tenant:

- Create at least 1 published alert
- Create at least 1 published event
- Confirm topic labels look correct

Recommended first-pass content for a live demo:

- Alert: planned road or utility maintenance
- Event: upcoming public meeting or parade

## 5. Smoke test the tenant

Check these routes on the tenant host:

- `/` shows the new updates homepage
- `/alerts` shows the alerts list
- `/events` shows the events list
- `/preferences` supports resident sign-in/sign-up and preference saving
- `/report` opens the existing map/report flow

Also verify:

- Calendar `.ics` download works from the Events screen
- A tenant with the switch still off continues to open directly into the map

## 6. Ashtabula-specific launch suggestion

Recommended order for Ashtabula:

1. Apply migrations in staging
2. Turn on the resident homepage only in staging
3. Create one alert and one event
4. Smoke test all tenant routes
5. Enable it for production only after validation
