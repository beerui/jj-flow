---
name: jj-review
description: Single-repo read-only review adapter. Prefer host built-in review/code-review. If a ralph run exists, map to reviews/REV-*.json and write back run.json; if not, review the working tree or HEAD and do not init. Use for jj-review, $jj-review, review, code review, 审查, 只读审查, 评审 commit/diff, task/review sessions, or recording a review on the latest ralph run (incl. after soft-archive). Cross-project VERIFIED → jj-dispatch. Does not replace the host review engine; does not change business code.
---

# jj-review

Produce a **read-only review**. Prefer the **host built-in** review engine; bind a ralph run when one exists, otherwise review the working tree or HEAD. **Do not** init a run to hold a review.

**Happy path in one pass** (locate → scope → user/host map → persist if bound → finish reply). Pause only on 🔴 CHECKPOINT / 🛑 STOP.

**May** write into soft-archived / `COMPLETED` runs (no terminal freeze).

## Red-light blacklist (never do)

| # | Forbidden | Why |
|---|-----------|-----|
| 1 | Change business code / open fix tasks / enter dispatch | Read-only adapter |
| 2 | Init or hand-build a ralph run to hold a review | Unbound review instead; never init |
| 3 | Skip host review for parallel self-review when host exists | Host-first; chat ≠ fact source |
| 4 | Treat `npm test` / `npm run verify` / CI green as `PASS` | Verify ≠ review |
| 5 | Chain multiple full review engines in one invocation | One host path only |
| 6 | Drop `source` / `host_review` on persist | Need provenance |
| 7 | Advance dispatch VERIFIED / write control-plane manifests | Use `$jj-dispatch` |
| 8 | Bind steps to one host product marketing name | Capability discovery only |

## Inputs → outputs

| In | Out |
|----|-----|
| optional `run_id` (else currently working from index.md 活跃) | bound run, or unbound (no persist) |
| explicit `run_id` missing | 🔴 `BLOCKED` |
| commit / paths / pasted host result | scope or 🔴 `BLOCKED` |
| host entry **or** user artifact **or** (after 🔴) fallback | bound: `REV-n.json` + `run.json.review` + events.jsonl; unbound: chat only |
| — | PASS: `通过。` + one-sentence summary; NEEDS_CHANGES: list each problem + 修改意见; STOP template on BLOCKED |

Schema: [report-layout.md](references/report-layout.md). Discovery/maps: [host-review.md](references/host-review.md). Passes / nit cap / Steps compliance: [review-policy.md](references/review-policy.md).

## Immediate actions

1. **Locate the run** — **In:** `run_id`? `.workflow/ralph/index.md`. **Out:** bound `run.json`, or unbound.
   Order: [report-layout.md](references/report-layout.md) Selecting a run. Unspecified: read `index.md` **活跃** first (currently working); do not glob until that table is empty or the file is missing.

   Explicit `run_id` named but missing → 🔴 `BLOCKED` (do not init).
   Unspecified and no run → **unbound**; continue. Do not init.

2. **Determine scope** — **In:** run artifacts (if bound) + user target. **Out:** commit and/or paths.
   Bound: read `task_plan.md` (`## Goal` / `## Steps` / `## 验收`; leftover `## 分析` / `## 计划`) and last 30 lines of `progress.md`.
   Unbound: dirty working tree, else `HEAD`, else user paths. Skip `## Steps` compliance when there is no `task_plan.md`.

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
   Compare the diff to `task_plan.md` **## Steps** when that file exists (leftover: `## 计划 → ### 当前`). Skip generated paths. Nit cap 5; OPEN important cannot sit on PASS (nits WAIVED on PASS).
   Record `source` + `host_review` (provenance; does not advance other gates).
   Bound `PASS`/`NEEDS_CHANGES` need `reviewed_commit` ≥7 chars. Unbound uses `HEAD` when present. Unstructured text → severity tables; missing file/line → `unknown`/`1`; still undecidable → `BLOCKED`.

6. **Persist** — **bound run only.** Unbound: skip; do not init; do not invent `REV-*.json`. Bound: copy [review-report.skeleton.json](references/review-report.skeleton.json):
   - `reviews/REV-n.json` (n = max+1 or 1)  
   - `run.json.review` + `artifact_refs.latest_review_ref`
   - CLI writes the machine `review` line to `.state/events.jsonl` (not `progress.md`)
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

7. **Final reply** — Chinese, no `PASS REV-*` / `working_tree` dump, no host/source table.

   `PASS` (no OPEN findings):

   ```text
   通过。<一句总结：审了什么、结论为何通过>
   ```

   Example: `通过。工作区协议改动未见必须修改项。`

   `NEEDS_CHANGES` (OPEN findings): list each problem and the suggested fix. No metadata table.

   ```text
   1. <问题：file:line + 现象>
      修改意见：<怎么改>
   ```

   Bound `working_tree` PASS is temporary; archive needs a later `review-record --review-scope commit`. `$jj-end` is Git only after ralph `finalize`.
   This adapter stays **read-only**. Do not change business code or start a fix in the same turn. Wait for the user to say 「按审查改」 / `$jj-ralph` before DELIVER.
   `BLOCKED` / host missing / write fail: STOP template + missing evidence.

## Fallback (host unavailable only)

`source=fallback_inline` only when: no discoverable review entry; **or** host failed **and** user explicitly continues.

🔴 CHECKPOINT · 🛑 STOP — **before fallback**: no explicit continue → stop; report why host unused; offer (a) paste → `user_provided` or (b) allow fallback. Never auto-fallback.

Still read-only; persist `REV-*.json` only when bound; explain in `summary` / `host_review.note`.
`user_provided` ≠ fallback.

## Failure and recovery

🔴 STOP or bounded recover. Happy path does **not** pause before host review or persist.

| Trigger | First fix | Still fails / must stop |
|--------|-----------|-------------------------|
| unspecified, no ralph run | Unbound review of working tree / HEAD | Never init |
| 🔴 explicit `run_id` missing | `BLOCKED`; do not init | STOP |
| 🔴 no commit/diff/scope | `BLOCKED` + missing list | STOP; no invent SHA |
| 🔴 must-use-host, no entry | Name capability | STOP; no silent fallback |
| host call fails | Surface error; ask fallback? | No user OK → `BLOCKED` |
| 🔴 fallback without user OK | Offer paste or continue | STOP until user chooses |
| unstructured host output | Map via tables; `unknown`/`1` | Undecidable → `BLOCKED` |
| bound `review-record` CLI fails | Direct-write skeleton | Write fails → `BLOCKED` |
| bound PASS/NEEDS_CHANGES, commit <7 | Resolve SHA from scope/user | Still missing → `BLOCKED` |
| OPEN findings vs PASS | Force `NEEDS_CHANGES` | No soft-PASS; nits may be WAIVED |
| Write `AGENTS.md` / `instruction-correction.md` from this skill | Stay read-only; report only | Developer / ralph writes corrections |

## Examples

```text
$jj-review
$jj-review run=task-login-reminder
$jj-review 评审当前 commit 的登录提醒改动
$jj-review record the host review result on the latest ralph run
$jj-review 把刚才宿主审查结论记到最新 ralph run
```
