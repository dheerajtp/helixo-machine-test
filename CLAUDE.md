# Countdown Timer + Analytics — Shopify App

## Mandatory rules

Every change in this repository MUST follow the rule files below. Read the matching one before writing or changing code.

- Backend: [CLAUDE_BACKEND_MONGODB.md](CLAUDE_BACKEND_MONGODB.md)
- Frontend (admin app in `web/frontend/`, and the Preact widget in `widget/` and `extensions/`): [CLAUDE_FRONTEND_REACT.md](CLAUDE_FRONTEND_REACT.md)

@CLAUDE_BACKEND_MONGODB.md
@CLAUDE_FRONTEND_REACT.md

- Those rules are not optional. Skipping one needs explicit approval from the project owner.
- If a request, the PRD, or a template conflicts with a rule, stop and ask. Do not silently pick one.
- Before declaring work done, run the final review of each rules file you touched (backend §21, frontend §15).

## UI approval gate (mandatory)

No UI code (admin pages, components, storefront widget visuals, theme block) may be created or changed until the owner has approved a reference image of it.

1. Show the owner reference image(s) of the screen or widget, with options where the design is open.
2. Wait for the owner to pick one. No reply means no approval.
3. Save the selected image in `docs/ui/` and build to match it.
4. A design change after approval needs a new image and a new approval.

Non-UI work (logic, API client, tests) may proceed without it.

## Docker rules (mandatory)

- **Approval first:** `docker-compose.yml` MUST NOT be created or changed until the owner has approved it. Ask about every setting and rule in it (services, images, ports, volumes, networks, replicas, restart and resource limits, healthchecks), show the proposed file, and wait for approval. No reply means no approval. Any later change needs a new approval.
- **How it runs:** the file is named `docker-compose.yml` and is started with `docker stack deploy -c docker-compose.yml <stack-name>`. It MUST be valid for Swarm mode.
- **MongoDB runs inside Docker**, as part of this stack. Do not install it on the host or use a hosted database such as Atlas.
- **Env files:** supplied to containers by volume mapping only. `docker-compose.yml` MUST NOT use `env_file` or `environment`, or contain any env value. The app reads the mounted file at boot.
- Env files are never committed or built into an image.
- **Never use `docker compose up`** (or `docker-compose up`), in commands, scripts, CI, docs or instructions to the owner. Only `docker stack deploy -c docker-compose.yml <stack-name>`.
- **Env variables live in one place per app:** the Node.js folder (`web/`) and the React folder (`web/frontend/`), each with its own env file and `.env.example`. Do not define, repeat or override them anywhere else: no root env file, and nothing in `docker-compose.yml`, Dockerfiles, scripts or CI.

## Product (from the PRD)

PRD: http://helixo.notion.site/Countdown-Timer-Analytics-Shopify-App-Sample-Project-PRD-bfad1acb2d764be29a2a167aed1305ed

A standalone Shopify app where merchants create countdown timers for promotions and show them on product pages.

### Stack (fixed by the PRD)

- MERN, with JavaScript for at least the backend
- Shopify CLI 3.0, starting from the official Node/Express template (https://github.com/Shopify/shopify-app-template-node)
- Latest Shopify Polaris components and guidelines for the admin UI
- Preact for the storefront widget, delivered by a Theme App Extension (**not** ScriptTag)

### Features

- **Fixed timer:** start and end datetime; every visitor sees the same countdown. Activates automatically.
- **Evergreen timer:** starts on the visitor's first visit, stored in `localStorage`, resets after expiry or session end.
- **Targeting:** all products, specific products, or specific collections, chosen with Shopify Resource Picker.
- **Customization:** colors, position, text.
- **Urgency cue** when a timer is close to expiring.
- **Admin:** dashboard with status (active / scheduled / expired), create/edit form with validation, product/collection picker, impression count per timer.
- **Widget:** shows the timer on the product page; handles expired timers, no active timer, and network failures; efficient polling/caching; smooth animation.

### Requirements

- MongoDB schema covers multi-tenant isolation, targeting rules, and impression counts.
- REST APIs with correct status codes, input validation and sanitization, and a documented rate-limiting approach.
- Widget loads its config with a single API call, with proper cache headers. Response time under 200 ms.
- Widget bundle: aim for 15 KB gzipped, never exceed 30 KB. No layout shift (CLS). It MUST NOT break the storefront.
- Shop ownership validated on all API calls. All user input protected against XSS. No sensitive data in client code.
- ESLint configured. At least 5 meaningful unit tests on critical business logic.

## How the rules apply to this app

- **Tenant isolation:** the shop comes from the verified Shopify session (admin) or a verified Shopify signature (storefront), never from a client-supplied value alone. Every query is scoped by shop, and indexes start with it.
- **Auth:** authentication is Shopify's. The password, OTP and reset-token rules apply only if such a feature is ever added.
- **Public storefront endpoints:** validated with Joi, rate-limited, and return only the fields the widget needs.
- **Webhooks:** Shopify webhooks, including `app/uninstalled` and the privacy webhooks, are signature-verified and idempotent.
- **Not required by the PRD:** Redis, queues, and file uploads. Do not add them without approval; their rules apply if they are added.
- **Frontend:** follows the frontend rules file, plus the UI approval gate and the requirements above.
- **Confirmation modals (owner decision):** use the Polaris modal. It counts as the existing modal system for frontend §4; do not build a custom React Portal modal.
- **Language (owner decision):** English only for now. Do not add a translation library or translation setup.

## Deliverables

- GitHub repository with a clean commit history showing progression.
- README: setup, architecture decisions, assumptions, performance optimizations, rate-limiting approach.
- Brief API endpoint documentation.
- Loom video (10–15 min): walkthrough, architecture, trade-offs and improvements.
- Deadline: 48 hours from assignment.
