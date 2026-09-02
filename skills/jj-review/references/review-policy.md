# Review policy (ralph / jj-review)

Host-agnostic policy for `$jj-review` and `reviews/REV-*.json`. Not a Claude `REVIEW.md`. SSOT for passes, importance, nit cap, and skip rules.

## Passes

Run three passes. Tag each finding with `pass` when known:

| pass | Look for |
| --- | --- |
| `bugs` | Logic errors, broken edges, silent regressions |
| `security` | Injection, auth gaps, secrets/PII in logs, weakened tests on a bugfix |
| `compliance` | Diff does not match `task_plan.md` **## 计划 → ### 当前** (fallback `当前` → `Current` → `Tasks`) |

Untagged host findings default to `bugs`. Style/naming keywords map to nits (`importance=nit`, `severity=info`).

## Important vs nit

- **important**: would break behavior, leak data, or miss Current. OPEN important cannot sit on `outcome=PASS`.
- **nit**: style, naming, optional cleanup. Nits never block PASS (WAIVED on PASS).

## Nit cap

At most **5** OPEN nits per review. Extra nits are `WAIVED` and summarized as a count. Do not let nit volume bury Important findings.

## Do not report

- Generated paths (`src/gen/`, `*.generated.*`)
- Lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`) and `run.json` / `package.json`
- Style nits on ledger wording in `task_plan.md` (compliance findings may still target `task_plan.md`)
- Anything CI already enforces (`npm test` / `npm run verify` green is **not** a review PASS)

## Compliance vs Current

When a ralph run exists, compare the implementation diff to `task_plan.md` ## 计划 → ### 当前 (not 已落地 / 已取代). Mismatch → OPEN finding `pass=compliance`, `importance=important`, `file=task_plan.md`. Mechanical helper: `buildPlanComplianceFindings` in `src/ralph.mjs`.

## Test integrity (bugfix)

Bugfix / `failed_must` / NEEDS_CHANGES runs may **add or strengthen** tests. Deleting or emptying `tests/**` / `*.test.*` / `*.spec.*` is Important. `tiny` presentational runs without `failed_must` do not trip this.

## Mapping

Keep ralph finding schema `jj-flow/ralph-review/1.0`. Optional fields: `pass`, `importance`. Do not mix dispatch `P0–P3` severities here.
