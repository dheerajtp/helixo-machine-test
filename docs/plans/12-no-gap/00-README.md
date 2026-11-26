# 12 — No gap on products without a timer

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [07](../07-storefront-api/00-README.md), [08](../08-widget/00-README.md)

## Goal
- Products with no timer show no empty space, and products with one still do not shift

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| L1 | **Owner decision.** A product without a timer has no gap. This replaces the "space stays empty" part of plan 08 H6 and that panel of `docs/ui/widget.png`. |
| L2 | **Targeting data.** App-data metafield (owner = current app installation), namespace `countdown`, key `targets`, type `json`: `{"v":1,"rules":[{"t":"all"\|"products"\|"collections","ids":["123"],"s":1700000000,"e":1700003600}]}`. One rule per enabled, not yet expired timer; `ids` are numeric strings (empty for `all`); `s`/`e` are epoch seconds, `null` for evergreen. At most 100 rules and 60 KB; beyond that store `{"v":1,"rules":[{"t":"all","ids":[],"s":null,"e":null}]}`. |
| L3 | **Sync.** After a successful create, update or delete, rebuild the whole value from the database and write it with `metafieldsSet`, using the request's session. A failure (including a permission error) is logged without data and never fails the timer request. Timeout 3 s, one retry. No new scope or dependency. |
| L4 | **Theme block.** Liquid reads `app.metafields.countdown.targets.value` and adds `cdt-slot--reserve` when a rule matches the product or one of its collections and `s <= now < e` (null means always). If the metafield is missing, reserve (today's behaviour). |
| L5 | **Widget.** Only `cdt-slot--reserve` has height; an unreserved slot takes no space. If a timer arrives for an unreserved slot (stale page), draw it and add the class (one shift). A reserved slot with no timer keeps its space (stale page or a visitor's finished evergreen). |
| L6 | **Owner decision: no past start time.** A fixed timer cannot be created, or have its start changed, to a moment before now. Browser and server both refuse a new or changed `startAt` earlier than the current minute (server grace: 60 seconds), 400 on `startAt`. An unchanged start on an existing timer is always accepted, so running timers can still be edited, disabled and enabled. A new form pre-fills the start as today at the next 5-minute mark (end time stays 11:59 PM, end date empty). |

## Status
- [x] 01 — Targeting sync
- [x] 02 — Theme block and widget (gated while 12/01 in flight)
- [x] 03 — No past start time
- [x] 04 — Acceptance (two MANUAL rows open)

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | 02 | Sonnet | `web/src/{services,controllers,repositories,integrations}/**`, `web/test/**` |
| 02 | none | 01 | Sonnet | `widget/src/**`, `widget/test/**`, `extensions/countdown-timer/blocks/**` |
| 03 | 01 | 02 | Sonnet | `web/src/services/timerService.js`, `web/src/validators/timer*`, `web/frontend/**`, `web/test/**`, `docs/api.md` |
| 04 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and the rules file for the code touched; never commit; never read or change `web/config/` or `web/frontend/.env`; never deploy.

## Acceptance checklist
- [x] Tests show the value is rebuilt after create, update and delete, and a failed write does not fail the request
- [ ] MANUAL: a product without a timer has no gap
- [ ] MANUAL: a targeted product shows the timer without the page jumping
- [x] A past start time is refused by the form and the API, and existing timers stay editable
