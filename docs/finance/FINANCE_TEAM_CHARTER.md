# CityReport.io Finance Team Charter

Prepared: July 20, 2026  
Owner: Founder / CEO  
Operating model: Fractional finance team with AI-supported analysis

## 1. Mission

Give CityReport.io reliable cash visibility, defensible municipal pricing, clean books, disciplined contract economics, and an auditable path from pilot to annual recurring revenue.

This team does not replace licensed accounting, tax, or legal professionals. AI agents may prepare analysis, schedules, and drafts; a qualified human must approve tax positions, legal terms, financial statements, and material customer commitments.

## 2. Team structure

| Role | Initial staffing | Core ownership | Decision authority |
|---|---|---|---|
| Executive sponsor and pricing owner | Founder / CEO | Strategy, cash commitments, final price, exceptions | Final commercial approval |
| Finance lead / fractional CFO | Fractional, 4–8 hours monthly at first | Budget, forecast, pricing model, cash runway, deal economics | Recommends; co-approves major exceptions |
| Bookkeeper / controller | Fractional, monthly | Transaction coding, reconciliation, invoice tracking, close package | Accounting process control |
| CPA / tax advisor | Quarterly and on demand | Entity tax, sales/use tax assessment, filings, year-end review | Licensed tax advice and filings |
| Municipal contracts counsel | On demand | MOU, pilot/municipal agreement, non-appropriation, liability, privacy, procurement | Legal approval of customer terms |
| Sales / Revenue Operations | Founder initially | Quotes, order forms, PO path, renewals, collections handoff | Approved pricing only |
| Engineering / FinOps | Technical owner | Usage metering, vendor alerts, tenant cost drivers, billing metadata | Technical feasibility and cost estimates |
| Security and compliance | Existing internal role plus outside support as needed | Data safeguards, vendor reviews, procurement responses | Security commitment approval |
| AI Finance & Accounting Agent | Existing repository role | Models, variance drafts, cost register, invoice checklist, decision log | No independent spending, tax, legal, or contract authority |

## 3. Why this structure now

- One municipal MOU does not justify full-time finance hires.
- Municipal contracts require more discipline than consumer self-service billing: purchase orders, appropriations, tax-exempt documentation, security review, and slower collections.
- A fractional model preserves cash while establishing controls that can scale to additional municipalities.
- The existing repository already defines Finance collaboration with Legal, Sales, Engineering, and Security; this charter turns that instruction into an operating team.

## 4. Core workflows

### Deal desk

Before any pilot, proposal, expansion, or renewal:

1. Sales records scope, term, included domains, staff seats, assets, support, implementation, and requested exceptions.
2. Engineering estimates tenant-specific infrastructure and support burden.
3. Finance calculates recurring COGS, gross margin, implementation margin, cash timing, and discount impact.
4. Legal reviews MOU/contract, payment, tax, non-appropriation, data, SLA, and termination terms.
5. Founder approves the final offer.

### Vendor cost control

1. Maintain one vendor register with plan, renewal date, owner, payment method, monthly budget, actual expense, included usage, and cancellation method.
2. Configure budget alerts for Google Cloud/Maps, Supabase, Cloudflare, Resend, and OpenAI/Codex.
3. Review trailing usage before adding a paid tier.
4. Do not buy overlapping products without an explicit reason; examples include Resend plus Cloudflare Email, Adobe Express plus Canva, or Google Analytics plus Plausible.

### Billing and collections

1. Execute agreement and obtain vendor/PO documentation before provisioning paid production scope.
2. Invoice annual subscription and implementation separately, normally in advance with Net 30 terms.
3. Accept municipality-approved ACH or check first. Card processing remains optional rather than the default municipal path.
4. Track `booked`, `billed`, and `collected` amounts separately.
5. Review accounts receivable weekly and escalate at 15, 30, 45, and 60 days according to the contract and city process.

## 5. Approval matrix

| Decision | Required approval |
|---|---|
| Standard list-price quote | Founder or delegated Sales owner |
| Discount up to 10% for one year | Founder, with Finance recorded |
| Discount up to 15% tied to a three-year commitment | Founder + Finance |
| Discount above 15%, free pilot, or waived implementation | Founder + Finance + written strategic rationale |
| Subscription gross margin below 80% | Finance exception memo |
| Subscription gross margin below 70% | Founder + Finance; normally decline or re-scope |
| Custom development or integration | Engineering estimate + fixed SOW + Finance margin check + Legal |
| New SLA, uptime, response-time, or security commitment | Engineering + Security + Legal |
| Supabase Team/Enterprise or another compliance-driven upgrade | Security/procurement need documented and cost included in customer economics |
| New recurring vendor over $100/month | Founder + Finance |
| New recurring vendor over $500/month | Founder + Finance with annual budget impact |

## 6. Operating cadence

### Weekly

- Review cash balance and accounts receivable.
- Review cost alerts and unusual vendor usage.
- Review open proposals, procurement blockers, and expansion requests.

### Monthly close — target by business day 10

- Reconcile bank and card accounts.
- Collect and attach vendor invoices.
- Categorize infrastructure, COGS, sales/marketing, product development, and G&A separately.
- Reconcile booked, billed, collected, deferred, and overdue revenue.
- Compare actuals with budget and explain material variances.
- Refresh a rolling 12-month cash forecast.
- Report gross margin by tenant when enough usage data exists.

### Quarterly

- Review price realization, support hours, vendor utilization, and runway.
- Reforecast customer count and cash needs.
- Review security/compliance requirements that could change vendor plans.
- Review tax and filing obligations with the CPA.
- Revalidate package scope and expansion prices.

### 60–90 days before renewal

- Confirm scope, active domains, named staff, assets, support use, and pending integrations.
- Prepare renewal economics and procurement timeline.
- Identify expansion, re-scope, or non-renewal risk.

## 7. Chart-of-accounts minimum

Keep these categories distinct:

- Subscription revenue
- Implementation and onboarding revenue
- Professional services / custom development revenue
- Tenant-variable infrastructure COGS
- Tenant support and success COGS
- Payment processing fees
- Product development tools, including Codex/OpenAI
- General cloud/platform expense not allocable to one tenant
- Sales and marketing software
- Advertising and campaign spend
- Legal and compliance
- Accounting and tax
- Insurance
- Domain and app-store fees
- General and administrative expense

## 8. Immediate 10-business-day launch plan

| Due | Owner | Deliverable |
|---|---|---|
| Day 1 | Founder | Place the signed Ashtabula MOU in the controlled contract repository and authorize Legal/Finance review |
| Day 2 | Bookkeeper / Founder | Collect the last three invoices or dashboard exports for every known vendor |
| Day 3 | Engineering / FinOps | Export monthly Google Maps SKU use, Supabase use, Worker requests, emails, storage, MAU, and support hours |
| Day 4 | Legal | Summarize MOU scope, price restrictions, term, branding/reference rights, data duties, termination, and procurement path |
| Day 5 | Finance | Replace estimated vendor rows with actual plan, invoice, and trailing usage data |
| Day 6 | Founder + Finance | Approve Ashtabula pilot economics and founding-city discount policy |
| Day 7 | Legal + Sales | Prepare pilot/order-form language and invoice requirements |
| Day 8 | Bookkeeper | Configure accounting categories, customer record, invoice numbering, and AR aging |
| Day 9 | Engineering | Set vendor budget alerts and a monthly usage export cadence |
| Day 10 | Finance team | Hold the first deal-desk and budget review; record decisions and owners |

## 9. Scale triggers

Add more finance capacity when any of these occur:

- Three or more paying municipalities
- More than `$250,000` ARR
- More than ten monthly invoices or material multi-year deferred revenue
- Payroll or contractor volume that exceeds founder-managed controls
- A government security/compliance requirement materially changes costs
- Collections or close repeatedly take more than ten business days

## 10. Open decisions

- What does the signed Ashtabula MOU permit regarding pilot fees, conversion, publicity, and future pricing?
- Which entity signs contracts and receives revenue?
- Which accounting system and bank account will be the system of record?
- Are any current vendor charges personal expenses that need reimbursement or migration to a company account?
- Does Ohio or another jurisdiction impose any sales/use tax or registration obligation for the contemplated service? CPA and counsel must answer.
- What insurance limits will municipal procurement require?
