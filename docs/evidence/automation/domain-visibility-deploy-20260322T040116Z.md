# Domain Visibility Deploy Evidence

Generated: 2026-03-22 04:01:17 UTC  
Commit pushed: `95c9b38`  
Target: production (`https://ashtabulacity.cityreport.io`)

## Live bundle check
- Bundle: `assets/index-ClYgnYtv.js`
- Admin bypass string present (`isAdmin || isDomainPublic`): `no`

## Notes
- Expected state after fix: admin bypass string is absent in live bundle.
- Local validation before push: `npm run build` passed.
