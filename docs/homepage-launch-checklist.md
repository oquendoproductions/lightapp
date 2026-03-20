# Homepage Launch Checklist

## Product and Copy

- [ ] Hero messaging aligned with municipal/procurement audience.
- [ ] Capability proof language avoids unverifiable public claims.
- [ ] Trust section accurately reflects data handling and visibility boundaries.

## UX and Accessibility

- [ ] Primary CTA and lead form accessible on desktop and mobile.
- [ ] Keyboard-only navigation covers CTA, all form fields, and submit.
- [ ] Reduced-motion preference disables non-essential transitions.

## Technical Validation

- [ ] `npm run lint` passes.
- [ ] `npm run build` completes successfully.

## Lead Capture and Security

- [ ] Supabase migration applied.
- [ ] Edge function deployed and reachable from homepage.
- [ ] Honeypot field blocks bot-style submissions.
- [ ] Rate limit returns `RATE_LIMITED` response under repeated requests.

## Observability

- [ ] CTA click events fire.
- [ ] Lead submit attempt/success/failure events fire once per action.
- [ ] Production logs confirm successful lead persistence.
