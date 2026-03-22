# Week 5 UI Polish Checklist

## Popup Uniformity
- [ ] Streetlight info window uses new shared layout.
- [ ] Street sign info window uses new shared layout.
- [ ] Pothole info window uses same structural pattern where applicable.
- [ ] Button order is consistent (`Primary action`, `Secondary action`, `Destructive action`).
- [ ] Status block placement is consistent across domains.

## Marker/Icon Clarity
- [ ] Street sign icon updated for quick differentiation.
- [ ] Icon remains visible on light/dark map backgrounds.
- [ ] Marker legend reflects updated icon semantics.

## Modal Consistency
- [ ] Report modals share typography scale.
- [ ] Close/Cancel affordances are consistent.
- [ ] Spacing/padding tokens applied uniformly.
- [ ] Error and validation copy style is consistent.

## Interaction Hygiene
- [ ] Only one popup can be open at any time.
- [ ] Queued mapping popup closes when existing marker popup opens.
- [ ] Marker click behavior is consistent desktop/mobile.

## Public Copy Neutrality
- [ ] Public summary wording avoids blame language.
- [ ] Reopen/chronic wording is trend-focused and neutral.
- [ ] No internal-only wording leaks to public UI.

## Regression Guardrail
- [ ] No schema changes.
- [ ] No lifecycle rule changes.
- [ ] No export column changes.
- [ ] No new domain/report type additions.
