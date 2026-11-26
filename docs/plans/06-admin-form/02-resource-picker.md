# 06/02 — Resource picker

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: 06/01 · Parallel with: none

## Decisions you need
F2, F9: run `grep -E '^\| F(2|9) ' docs/plans/06-admin-form/00-README.md`.

## Read first
- `docs/ui/timer-form.png`, `## Result` of `01-form-save.md`, `## Result` of `docs/plans/05-admin-dashboard/01-shell-api-client.md` (React 18 + web component pitfalls)
- Current App Bridge docs on shopify.dev for the Resource Picker and Direct API access

## Scope (files you own)
`web/frontend/{components,utils}/**`, `web/test/**`.

## Tasks
1. "Browse products" / "Browse collections" opens `shopify.resourcePicker` (multiple, max 100, current IDs preselected). Cancel keeps the selection.
2. Selected items show as removable chips with their titles. Switching between products and collections clears the selection; at least one item is required.
3. **Titles on edit:** only IDs are stored. Look the titles up through App Bridge Direct API (`shopify:admin/api/graphql.json`, `nodes(ids:)`) only if it works with the current configuration and `read_products`; otherwise, or on failure, show "Product <number>" / "Collection <number>" and say so in Result.
4. Keep selection and ID logic in plain modules with tests.

## Done when
- `tools/verify-slice.sh` and `CI=true npm run build` pass.
- Append `## Result`.
