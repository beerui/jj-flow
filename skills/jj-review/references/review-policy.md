# Review policy (ralph / jj-review)

Host-agnostic policy for `$jj-review` and `reviews/REV-*.json`. Not a Claude `REVIEW.md`. SSOT for passes, importance, nit cap, and skip rules.

## Passes

Run three passes. Tag each finding with `pass` when known:

| pass | Look for |
| --- | --- |
| `bugs` | Logic errors, broken edges, silent regressions |
| `security` | Injection, auth gaps, secrets/PII in logs, weakened tests on a bugfix |
| `compliance` | Diff does not match `task_plan.md` **## Steps** (leftover: `## 计划 → ### 当前`) |

Untagged host findings default to `bugs`. Style/naming keywords map to nits (`importance=nit`, `severity=info`).

## Important vs nit

- **important**: would break behavior, leak data, or miss `## Steps`. OPEN important cannot sit on `outcome=PASS`.
- **nit**: style, naming, optional cleanup. Nits never block PASS (WAIVED on PASS).

## Nit cap

At most **5** OPEN nits per review. Extra nits are `WAIVED` and summarized as a count. Do not let nit volume bury Important findings.

## Do not report

- Generated paths (`src/gen/`, `*.generated.*`)
- Lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`) and `run.json` / `package.json`
- Style nits on ledger wording in `task_plan.md` (compliance findings may still target `task_plan.md`)
- Anything CI already enforces (`npm test` / `npm run verify` green is **not** a review PASS)

## Compliance vs Steps

When a ralph run exists, compare the implementation diff to `task_plan.md` ## Steps (leftover: ## 计划 → ### 当前). Mismatch → OPEN finding `pass=compliance`, `importance=important`, `file=task_plan.md`. Mechanical helper: `buildPlanComplianceFindings` in `src/ralph.mjs`. Do not ask the fixer to grow 已落地 / Landed in the live plan.

## Test integrity (bugfix)

Bugfix / `failed_must` / NEEDS_CHANGES runs may **add or strengthen** tests. Deleting or emptying `tests/**` / `*.test.*` / `*.spec.*` is Important. `tiny` presentational runs without `failed_must` do not trip this.

## 客服 verdict

Human/subagent SSOT is `findings.md`: HIGH / MEDIUM / LOW + `file:line`, conclusion `[OK]` / `[WARN]` / `[BLOCK]`.

Check dimensions (from 客服 reviewer; put them in `ASSIGNMENT-REVIEW`):

| Dimension | Look for |
| --- | --- |
| Type safety | missing types, wrong unions, unsafe casts |
| Null handling | unguarded null/undefined, empty states |
| API contract | diff vs `task_plan.md` **## Steps** / public API |
| Regressions | broken edges, silent behavior change |
| Security | secrets, injection, auth bypass (CRITICAL) |

Do **not** invoke host `/review`. Parent writes the assignment; spawn one read-only reviewer.

| Verdict | When | Gate `outcome` |
| --- | --- | --- |
| `[OK]` | no CRITICAL/HIGH; dimensions ADEQUATE+ | `PASS` |
| `[WARN]` | MEDIUM only | `PASS` (nits; UAT allowed) |
| `[BLOCK]` | CRITICAL/HIGH or a dimension WEAK | `NEEDS_CHANGES` |

Dual-write `REV-*.json` for accept/archive. Chat uses the verdict, not `通过。`.

## Mapping

Keep ralph finding schema `jj-flow/ralph-review/1.0`. Optional fields: `pass`, `importance`. Do not mix dispatch `P0–P3` severities here.
