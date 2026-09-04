---
name: jj-review
description: Single-repo read-only review adapter. Prefer host built-in review/code-review; map to ralph reviews/REV-*.json and write back run.json. Use for jj-review, $jj-review, review, code review, 审查, 只读审查, 评审 commit/diff, task/review sessions, or recording a review on the latest ralph run (incl. after soft-archive). Cross-project VERIFIED → jj-dispatch. Does not replace the host review engine; does not change business code.
---

# jj-review

Produce a **read-only review record** for an existing ralph run. Prefer the **host built-in** review engine; this skill binds scope, maps results, and persists artifacts.

**Happy path in one pass** (locate → scope → user/host map → persist → report). Pause only on 🔴 CHECKPOINT / 🛑 STOP.

**May** write into soft-archived / `COMPLETED` runs (no terminal freeze). **Do not** init a run only to “add a review.”

## Red-light blacklist (never do)

| # | Forbidden | Why |
|---|-----------|-----|
| 1 | Change business code / open fix tasks / enter dispatch | Read-only adapter |
| 2 | Init or hand-build a ralph run to hold a review | No run → `BLOCKED` |
| 3 | Skip host review for parallel self-review when host exists | Host-first; chat ≠ fact source |
| 4 | Treat `npm test` / `npm run verify` / CI green as `PASS` | Verify ≠ review |
| 5 | Chain multiple full review engines in one invocation | One host path only |
| 6 | Drop `source` / `host_review` on persist | Need provenance |
| 7 | Advance dispatch VERIFIED / write control-plane manifests | Use `$jj-dispatch` |
| 8 | Bind steps to one host product marketing name | Capability discovery only |

## Inputs → outputs

| In | Out |
|----|-----|
| optional `run_id` (else latest) | bound run or 🔴 `BLOCKED` |
| commit / paths / pasted host result | scope or 🔴 `BLOCKED` |
| host entry **or** user artifact **or** (after 🔴) fallback | `REV-n.json` + `run.json.review` + `progress.md` line |
| — | brief: `review_id`, `outcome`, `source`, paths, rework? |

Schema: [report-layout.md](references/report-layout.md). Discovery/maps: [host-review.md](references/host-review.md). Passes / nit cap / Current compliance: [review-policy.md](references/review-policy.md).

## Immediate actions

1. **Locate the run** — **In:** `run_id`? `.workflow/ralph/`. **Out:** `run.json`.  
   Prefer `jj ralph locate` (or `ralph_ops locate`). Scan active `.workflow/ralph/task-*/.state/run.json`, then `completed/task-*/.state/run.json`. Still glob leftover `tasks/*/`, `archive/**/run.json` and unmigrated `RALPH-*/run.json` (read-only). Explicit `run_id` wins; else latest (`updated_at` desc, then `run_id` desc). New and leftover layouts must each be locatable.

   🔴 CHECKPOINT · 🛑 STOP — **no run** (do not init):

   ```text
   status: BLOCKED
   reason: no_ralph_run
   next: complete $jj-ralph init in this repo first, or pass run_id; this skill must not init
   ```

2. **Determine scope** — **In:** run artifacts + user target. **Out:** commit and/or paths.  
   Read `task_plan.md` (`## 分析` / `## 计划` / `## 验收`) and `progress.md`. Resolve `reviewed_commit` / working-tree diff / user paths.

   🔴 CHECKPOINT · 🛑 STOP — **no commit/diff/scope**: `BLOCKED`; list missing evidence; do not invent SHA; do not call host.

3. **User-provided first** (`source=user_provided`) — artifact path / pasted findings / named review session → map → step 5 (no host call).  
   Discovery step 1: [host-review.md](references/host-review.md).

4. **Else host built-in** — [host-review.md](references/host-review.md). **Out:** verdict + findings + paths → `source=host_builtin`.  
   - Invoke explicit **review / code-review** only (not test/CI verify).  
   - Do not full self-review first then “compare” to host.  
   - Collect verdict, findings, summary, artifact paths.

   🔴 CHECKPOINT · 🛑 STOP — **must-use-host but no entry**: `BLOCKED`; name missing capability; **no silent fallback** (user may paste findings or allow fallback).

5. **Map schema** — outcome only `PASS` / `NEEDS_CHANGES` / `BLOCKED`.
   Findings: `id` / `severity` / `file` / `line` / `description` / `status` / `acceptance`; optional `pass` (`bugs`|`security`|`compliance`) and `importance` (`important`|`nit`).
   Compare the diff to `task_plan.md` **## 计划 → ### 当前**. Skip generated paths. Nit cap 5; OPEN important cannot sit on PASS (nits WAIVED on PASS).
   Record `source` + `host_review` (provenance; does not advance other gates).
   `PASS`/`NEEDS_CHANGES` need `reviewed_commit` ≥7 chars. Unstructured text → severity tables; missing file/line → `unknown`/`1`; still undecidable → `BLOCKED`.

6. **Persist** — copy [review-report.skeleton.json](references/review-report.skeleton.json):  
   - `reviews/REV-n.json` (n = max+1 or 1)  
   - `run.json.review` + `artifact_refs.latest_review_ref`  
   - one `progress.md` line with `source=`  
   Prefer CLI (same schema; **keep provenance**):

   ```bash
   jj ralph review-record --run-id task-login-reminder \
     --outcome NEEDS_CHANGES --source host_builtin \
     --reviewed-commit abcdef1 \
     --finding-json '{"id":"F-1","severity":"high","pass":"bugs","importance":"important","file":"src/a.js","line":1,"description":"broken","status":"OPEN","acceptance":"fix"}' \
     --host-review-json '{"method":"skill","entry":"code-review","artifact_paths":[]}'
   # fallback script (jj-flow tree): node skills/jj-ralph/scripts/ralph_ops.mjs review-record ...
   ```

   CLI fails → direct-write skeleton. Write fails → 🔴 `BLOCKED` + paths.

7. **Completion report** — `run_id`, `review_id`, `outcome`, `source`, report path, host refs, rework?

## Fallback (host unavailable only)

`source=fallback_inline` only when: no discoverable review entry; **or** host failed **and** user explicitly continues.

🔴 CHECKPOINT · 🛑 STOP — **before fallback**: no explicit continue → stop; report why host unused; offer (a) paste → `user_provided` or (b) allow fallback. Never auto-fallback.

Still read-only; still persist `REV-*.json`; explain in `summary` / `host_review.note`.  
`user_provided` ≠ fallback.

## Failure and recovery

🔴 STOP or bounded recover. Happy path does **not** pause before host review or persist.

| Trigger | First fix | Still fails / must stop |
|--------|-----------|-------------------------|
| 🔴 no ralph run | `no_ralph_run` template | STOP; never init |
| 🔴 no commit/diff/scope | `BLOCKED` + missing list | STOP; no invent SHA |
| 🔴 must-use-host, no entry | Name capability | STOP; no silent fallback |
| host call fails | Surface error; ask fallback? | No user OK → `BLOCKED` |
| 🔴 fallback without user OK | Offer paste or continue | STOP until user chooses |
| unstructured host output | Map via tables; `unknown`/`1` | Undecidable → `BLOCKED` |
| `review-record` CLI fails | Direct-write skeleton | Write fails → `BLOCKED` |
| PASS/NEEDS_CHANGES, commit <7 | Resolve SHA from scope/user | Still missing → `BLOCKED` |
| OPEN findings vs PASS | Force `NEEDS_CHANGES` | No soft-PASS; nits may be WAIVED |
| Write `AGENTS.md` / `instruction-correction.md` from this skill | Stay read-only; report only | Developer / ralph writes corrections |

## Examples

```text
$jj-review run=task-login-reminder
$jj-review 评审当前 commit 的登录提醒改动
$jj-review record the host review result on the latest ralph run
$jj-review 把刚才宿主审查结论记到最新 ralph run
```
