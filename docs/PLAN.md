# Countdown Timer + Analytics — Master plan

Product and rules: [`../CLAUDE.md`](../CLAUDE.md). Run one plan at a time; the owner verifies and commits before the next starts.

## Module execution order
| Plan | Title | Requires |
| --- | --- | --- |
| 01 | [Repository and Shopify scaffold](plans/01-scaffold/00-README.md) | none |
| 02 | [Backend core](plans/02-backend-core/00-README.md) | 01 |
| 03 | [Shopify auth, tenancy, webhooks](plans/03-auth-tenancy/00-README.md) | 02 |
| 04 | [Timer domain and admin API](plans/04-timer-api/00-README.md) | 03 |
| 05 | [Admin dashboard](plans/05-admin-dashboard/00-README.md) | 04 |
| 06 | [Timer create/edit form](plans/06-admin-form/00-README.md) | 05 |
| 07 | [Storefront timer API](plans/07-storefront-api/00-README.md) | 04 |
| 08 | [Widget and theme extension](plans/08-widget/00-README.md) | 07 |
| 09 | [Impression analytics](plans/09-analytics/00-README.md) | 06, 08 |
| 10 | [Operations and delivery](plans/10-ops-delivery/00-README.md) | 09 |
| 11 | [Live form validation](plans/11-form-validation/00-README.md) | 06 |
