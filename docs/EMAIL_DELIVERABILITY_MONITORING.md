# Email Deliverability Monitoring

This runbook tracks delivery health for report-forwarding emails.

## Data source

- Table: `public.email_delivery_events`
- View: `public.email_delivery_daily_metrics`
- Domains tracked:
  - `potholes`
  - `water_drain_issues`

## Daily checks

1. Confirm last 7-day success trend:

```sql
select *
from public.email_delivery_daily_metrics
where tenant_key = 'ashtabulacity'
  and delivery_day_utc >= (current_date - interval '7 days')::date
order by delivery_day_utc desc, domain;
```

2. Inspect most recent failures:

```sql
select
  created_at,
  tenant_key,
  domain,
  report_number,
  recipient_email,
  http_status,
  error_text
from public.email_delivery_events
where success = false
order by created_at desc
limit 100;
```

3. Compare success rates by domain over 30 days:

```sql
select
  domain,
  count(*) as attempts,
  count(*) filter (where success) as successes,
  round((count(*) filter (where success))::numeric * 100.0 / nullif(count(*), 0), 2) as success_rate_pct
from public.email_delivery_events
where tenant_key = 'ashtabulacity'
  and created_at >= now() - interval '30 days'
group by domain
order by domain;
```

## Alert thresholds (recommended)

- Investigate immediately if any domain drops below `95%` success in the trailing 24 hours.
- Investigate immediately if there are `5+` failures in 1 hour.
- If failures are `401/403`, rotate and verify `RESEND_API_KEY`.
- If failures are `429/5xx`, treat as provider-side instability and monitor retries.
