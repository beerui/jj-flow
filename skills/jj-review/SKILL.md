---
name: jj-review
description: Task read-only review adapter using 客服 assignment protocol. Write ASSIGNMENT-REVIEW, spawn a read-only reviewer with that file only; never call host /review. Findings are HIGH/MEDIUM/LOW + [OK]/[WARN]/[BLOCK]; dual-write REV-*.json for gates. Small changes skip review. If a ralph run exists, map to reviews/REV-*.json; if not, review the working tree or HEAD and do not init. Use for jj-review, $jj-review, review, code review, 审查, 只读审查, 评审 commit/diff, task/review sessions. Cross-project VERIFIED → jj-dispatch. Does not change business code.
---

# jj-review

Produce a **read-only review** using the 客服 assignment protocol. Do **not** invoke host `/review` / `[reviewer] local changes` (not even for 当前的全部改动). Parent is team-lead: write `ASSIGNMENT-REVIEW-*.md`. **Before the spawn tool call**, one user-visible line: **派遣审查** (e.g. 派遣 reviewer 审查改动代码). Do not wait silently (Grok may hold later text until the worker returns). Then call `spawn_subagent` (`jj-reviewer`; missing → `general-purpose`) this turn — `description` **starts with** `[reviewer]` then names `run_id` and listed files (never `[reviewer] local changes`); exclusive input is that file. Follow-up same cwd: `resume_from` last completed `jj-reviewer` (G-review-5). Do not resume an implementer. Do **not** perform the review in this chat. Saying you will spawn without calling it fails. Do **not** re-read this SKILL or `report-layout.md` / `host-review.md` / `review-policy.md` at startup. Verdict `[OK]` / `[WARN]` / `[BLOCK]`. Bind a ralph run when one exists; otherwise review the working tree or HEAD. **Do not** init a run to hold a review. A live `[reviewer]` still running → do **not** spawn `$jj-same` / RESEARCH over it (G-review-4 / `01a08fa6`).

**One pass** (locate → scope → assignment spawn → persist if bound → finish reply). Pause only on 🔴 CHECKPOINT / 🛑 STOP.

**May** write into soft-archived / `COMPLETED` runs (no terminal freeze).

## Red-light blacklist (never do)

| # | Forbidden | Why |
|---|-----------|-----|
| 1 | Change business code / open fix tasks / enter dispatch | Read-only adapter |
| 2 | Init or hand-build a ralph run to hold a review | Unbound review instead; never init |
| 3 | Call host `/review` / `[reviewer] local changes` | 客服 assignment spawn is the review path (G-review-2) |
| 4 | Treat `npm test` / `npm run verify` / CI green as `[OK]` | Verify ≠ review |
| 5 | Chain multiple full review engines in one invocation | One assignment spawn only |
| 6 | Drop `source` / `host_review` on persist | Need provenance |
| 7 | Advance dispatch VERIFIED / write control-plane manifests | Use `$jj-dispatch` |
| 8 | Bind steps to one host product marketing name | Capability discovery only |
| 9 | Spawn a second full-repo reviewer subagent for the same bound run in the same thread when a prior `REV-*` or findings.md exists | EP-20260907. Follow-up is delta |
| 10 | Bound first `$jj-review` via Grok `/review` | Exclusive `ASSIGNMENT-REVIEW` + `task_paths`, never the dirty tree (G-review-2) |

## Inputs → outputs

| In | Out |
|----|-----|
| optional `run_id` (else currently working from index.md 活跃) | bound run, or unbound (no persist) |
| explicit `run_id` missing | 🔴 `BLOCKED` |
| commit / paths / pasted findings | scope or 🔴 `BLOCKED` |
| assignment spawn **or** user artifact **or** (after 🔴) fallback | bound: `findings.md` + `REV-n.json` + `run.json.review` + events.jsonl; unbound: chat only |
| — | `[OK]` + 一句总结; `[WARN]`/`[BLOCK]`: HIGH/MEDIUM/LOW + `file:line` + 修改意见; STOP template on BLOCKED |

## Immediate actions

1. **Locate the run** — **In:** `run_id`? `.workflow/ralph/index.md` + `.workflow/ralph/`. **Out:** bound `run.json`, or unbound.
   Read `index.md` / `task_plan.md`. Do **not** run `ralph_ops` / `context --review` / `review-record` on this path.
   Unspecified: read `index.md` **活跃** first (currently working); do not glob until that table is empty or the file is missing. Unique 活跃 row → that id. 0 or >1 活跃 → **询问用户** (never `jj ralph locate` / `ralph_ops`). Then scan active `.workflow/ralph/task-*/.state/run.json`, then `completed/task-*/.state/run.json`. Still glob leftover `tasks/*/`, `archive/**/run.json` and unmigrated `RALPH-*/run.json` (read-only). Explicit `run_id` wins; else latest (`updated_at` desc, then `run_id` desc). New and leftover layouts must each be locatable.

   Explicit `run_id` named but missing → 🔴 `BLOCKED` (do not init).
   Unspecified and no run → **unbound**; continue. Do not init.

2. **Determine scope** — **In:** this-round ASSIGNMENT-TASK 交付 files (if bound) + user target. **Out:** commit and/or paths.
   Bound: list **this-round** assignment files in `ASSIGNMENT-REVIEW-*.md`. Do **not** generate `review-context.json` via CLI. Do **not** review other live tasks' dirty files. For committed work, diff those paths against HEAD's first parent. Do **not** invoke Grok `/review`.
   Unbound: dirty working tree, else `HEAD`, else user paths. Skip `## Steps` compliance when there is no `task_plan.md`.
   Small skip (bound `tiny`, **or** this-round 交付 is copy/CSS-only, no prior `NEEDS_CHANGES`/`BLOCKED`, user did not ask to review): report skip, do not spawn. 大功能 / 新模块 / 行为或格式契约 must review.

   🔴 CHECKPOINT · 🛑 STOP — **no commit/diff/scope**: `BLOCKED`; list missing evidence; do not invent SHA; do not call host.

3. **User-provided first** (`source=user_provided`) — artifact path / pasted findings / named review session → map → step 5 (no spawn).

3b. **Follow-up / delta** (same thread + same bound run) — **In:** prior `reviews/REV-*.json` or `reviews/review-*/findings.md` from this conversation. **Out:** delta assignment → step 4, or map → step 5.

   This invocation is a **follow-up** when a bound run already has a `REV-*` / findings from this thread (typical: user said 「按审查改」 then `$jj-review` again).

   - Scope = files changed since last `reviewed_commit` (or current dirty vs that commit). Do **not** re-scan the whole tree.
   - Re-check prior OPEN findings against the new diff. Do not rubber-stamp.
   - Do **not** spawn a fresh full-repo reviewer subagent (`[reviewer] local changes` or equivalent) with empty context.
   - Same cwd last completed `jj-reviewer` → `resume_from` that id (G-review-5). Do not resume an implementer as reviewer.
   - Write a new `ASSIGNMENT-REVIEW` that lists only the delta + OPEN items. Do **not** re-call `/review`. Fresh whole-tree assignment only when the user explicitly asks 重新全量审查 (still spawn; never `/review`).
   - First review of this run in this thread (no prior REV/findings): go to step 4.

4. **Else 客服 assignment spawn** — **In:** packet + paths from step 2. **Out:** findings.md + verdict → `source=host_builtin`.

   Same as 客服 `ASSIGNMENT-REVIEW`: explicit file list, read-only source, findings only. Current slice = this-round ASSIGNMENT files + that diff, not the dirty tree — unless the user asked 当前的全部改动 / 重新全量审查, in which case list those files **in the assignment** and still spawn (never `/review`).

   - Write `.workflow/ralph/<id>/assignments/ASSIGNMENT-REVIEW-<n>.md` in the 客服 shape: 来自 team-lead / 范围（只读）/ 检查维度（类型安全、null 处理、API 契约、回归；安全=CRITICAL）/ 产出格式 / 短句回报. Unbound: write under `.workflow/review-assignment.md` (chat-only persist).
   - **Before the spawn tool call:** **派遣审查** (e.g. 派遣 reviewer 审查改动代码; follow-up → **派遣审查（delta）**). Do not wait silently.
   - Spawn **one** read-only reviewer (`jj-reviewer`; missing → `general-purpose`). Description **starts with** `[reviewer]` then names `run_id` and listed files (e.g. `[reviewer] Review task-… files`). Never `[reviewer] local changes`. First review this thread: new spawn. Follow-up: `resume_from` last completed `jj-reviewer` same cwd. `jj-reviewer` pins `reasoning_effort: high` (not inherit/`xhigh`); do not lower parent `high`.
   - **exclusive input** = the `ASSIGNMENT-REVIEW` file (plus listed `task_paths` / that diff). Prompt first paragraph: 只读 listed files；不要 Start broad；不要 grep the whole repo；不要 `list_dir` the tree；不要再 spawn. Direct-import listed files only. Do **not** locate ralph, read jj-review/jj-ralph SKILL, or grep the whole repo. Do not `list_dir` the tree. Read listed files then write findings.
   - Do **not** invoke Grok `/review` (or any host entry that auto-collects the whole dirty tree).
   - Other dirty files are noise; do not review them unless they are direct imports of listed files.
   - Reviewer writes `reviews/review-<slice>/findings.md` (HIGH / MEDIUM / LOW + `file:line`; conclusion `[OK]` / `[WARN]` / `[BLOCK]`). Stop. Do not persist CLI.
   - At most **one** reviewer subagent per `$jj-review`. Follow-ups use step 3b.

   🔴 CHECKPOINT · 🛑 STOP — **must-use-host but no entry**: spawn still available → use it; if the host cannot spawn a read-only reviewer → `BLOCKED`; name missing capability; **no silent fallback** (user may paste findings or allow fallback).

5. **Map schema** — outcome only `PASS` / `NEEDS_CHANGES` / `BLOCKED`.
   `[OK]` → `PASS`. `[WARN]` → `PASS` (MEDIUM as nits / `importance=nit`; 客服 still allows UAT). `[BLOCK]` → `NEEDS_CHANGES` (OPEN CRITICAL/HIGH).
   Findings: `id` / `severity` / `file` / `line` / `description` / `status` / `acceptance`; optional `pass` (`bugs`|`security`|`compliance`) and `importance` (`important`|`nit`).
   Compare the diff to `task_plan.md` **## Steps** when that file exists (leftover: `## 计划 → ### 当前`). Skip generated paths. Nit cap 5; OPEN important cannot sit on PASS (nits WAIVED on PASS).
   Record `source` + `host_review` (provenance; does not advance other gates). `host_review.method=subagent`, `entry=assignment-reviewer`, `artifact_paths` includes findings.md.
   Bound `PASS`/`NEEDS_CHANGES` need `reviewed_commit` ≥7 chars. Unbound uses `HEAD` when present. Unstructured text → severity tables; missing file/line → `unknown`/`1`; still undecidable → `BLOCKED`.

6. **Persist** — **bound run only.** Unbound: skip; do not init; do not invent `REV-*.json`. Conversational persist is **documents**, not CLI. **Reply step 7 first**; then write files. Never `review-record`. Never `context --review`. Never Read skill `references/` or grep ralph scripts.
   - `reviews/review-<slice>/findings.md` already written by the reviewer
   - `.state/reviews/REV-n.json` (n = max+1 or 1): `schema_version` `jj-flow/ralph-review/1.0`; `outcome` from step 5; findings `severity` **lowercase** (`HIGH`→`high`, `MEDIUM`→`medium`, `LOW`→`low`); `status` `OPEN`; `acceptance` short close condition; `reviewed_commit` = HEAD ≥7 chars; `review_scope` `working_tree` or `commit`; `source=host_builtin`; `host_review.method=subagent`, `entry=assignment-reviewer`
   - Patch `run.json`: `review.latest_review_id`; `review.reviews[]` (id / path / outcome / reviewed_commit / review_scope); `artifact_refs.latest_review_ref` (`reviews/REV-n.json`); `[OK]`/`[WARN]` → `accept_layers.judgment=PASS`; `[BLOCK]` → `FAIL`; `judgment_mode=review`
   Mechanical `jj ralph review-record` exists for CLI users only. Write fails → still finish step 7; say 门禁 JSON 未写上. Do not grep `FINDING_SEVERITIES`.

7. **Final reply** — Chinese, no `PASS REV-*` / `working_tree` dump, no host/source table. This turn **must** include the verdict even if persist is unfinished.

   `[OK]`:

   ```text
   [OK] <一句总结：审了什么、结论为何通过>
   ```

   `[WARN]` / `[BLOCK]`: list each HIGH/MEDIUM/LOW problem and the suggested fix. No metadata table.

   ```text
   [BLOCK]
   1. <问题：file:line + 现象>
      修改意见：<怎么改>
   ```

   Bound `working_tree` PASS is temporary; archive needs a later REV json with `review_scope=commit` (same documents). `$jj-end` is Git only after ralph `finalize`.
   This adapter stays **read-only**. Do not change business code or start a fix in the same turn. Wait for the user to say 「按审查改」 / `$jj-ralph` before DELIVER.
   `BLOCKED` / host missing / write fail: STOP template + missing evidence.

### Golden Q&A — G-review-1 (must not regress)

**Q:** Same thread, bound run `task-buyer-enter-dynamic` already has `REV-n` from a host `[reviewer]` subagent. User says `/jj-review` again after 「按审查改」. Spawn another `[reviewer] local changes` with empty context?

**A:** No. This is a **delta review** (step 3b). Reuse the latest `REV-*` / findings.md as the checklist; inspect only files changed since last `reviewed_commit`. Re-check prior OPEN items; do not rubber-stamp. `resume_from` last completed `jj-reviewer` same cwd (G-review-5). Do **not** spawn a second full-repo reviewer subagent unless the user explicitly asks for a fresh whole-tree review. Regression: `EP-20260907-grok-review-subagent-waves`.

### Golden Q&A — G-review-2 (must not regress)

**Q:** Bound first `$jj-review` on a dirty tree that also has other tasks' files. Call Grok `/review` so it can collect local changes?

**A:** No. Conversational review is a 客服 assignment (step 4): write `ASSIGNMENT-REVIEW`, exclusive input is that file + listed files. Announce **派遣审查** (e.g. 派遣 reviewer 审查改动代码) then spawn one `jj-reviewer` (missing → `general-purpose`); description **starts with** `[reviewer]` and must not be `[reviewer] local changes`. Prompt first paragraph forbids Start broad / repo grep / list_dir. Do not wait silently. Do **not** invoke Grok `/review` (it always scans the whole dirty tree). 当前的全部改动 / 重新全量审查 still spawn with a wider file list in the assignment — never `/review`. Read listed files then write findings — do not grep the repo. Sample miss: `01a08ea0` reviewer 92 tools / 27 greps; `01a08fa0` spawned with no step line; `01a08fa6` grepped despite the ban.

### Golden Q&A — G-review-4 (must not regress)

**Q:** Reviewer `01a08fc5` still running. User `/jj-same 分发当前任务到 采购商端H5`. Spawn RESEARCH this turn (description `Research buyer H5 port`)?

**A:** No. Occupancy wins. Announce 审查还在跑; keep the `[reviewer]` pager row; do not spawn same until the reviewer returns. `user_cancel` on the review poll is not a license to overwrite the reviewer with an unlabeled General. Miss: `01a08fa6` RESEARCH 09:28:03 vs REVIEW done 09:28:07.

### Golden Q&A — G-review-3 (must not regress)

**Q:** Reviewer wrote `[BLOCK]` in findings.md. `review-record` rejects `HIGH`. Grep ralph scripts / Read skeleton / retry CLI before telling the user?

**A:** No. Conversational persist is findings.md + `REV-n.json` files. Map `HIGH`→`high` in the JSON. Reply `[BLOCK]` this turn. Never `review-record` / `context --review`. Wait 「按审查改」. Sample: `01a08ea0` 06:40 findings done, parent still on CLI at 06:45.

### Golden Q&A — G-review-5 (must not regress)

**Q:** First review `jj-reviewer` completed. User 「按审查改」 then `$jj-review`. Cold-spawn a new reviewer? `resume_from` the implementer?

**A:** No. Follow-up is delta + `resume_from` the completed `jj-reviewer` (same cwd, same type). Do not resume an implementer. Host `/review` is still forbidden. `send_subagent_message` only steers a live reviewer, never a new slice.

## Fallback (host unavailable only)

`source=fallback_inline` only when: spawn is impossible; **or** spawn failed **and** user explicitly continues.

🔴 CHECKPOINT · 🛑 STOP — **before fallback**: no explicit continue → stop; report why unused; offer (a) paste → `user_provided` or (b) allow fallback. Never auto-fallback.

Still read-only; persist `REV-*.json` only when bound; explain in `summary` / `host_review.note`.
`user_provided` ≠ fallback.

## Failure and recovery

🔴 STOP or bounded recover. Do **not** pause before assignment spawn or persist except 🔴 / 🛑.

| Trigger | First fix | Still fails / must stop |
|--------|-----------|-------------------------|
| unspecified, no ralph run | Unbound review of working tree / HEAD | Never init |
| 🔴 explicit `run_id` named but missing | `BLOCKED`; do not init | STOP |
| 🔴 no commit/diff/scope | `BLOCKED` + missing list | STOP; no invent SHA |
| 🔴 must-use-host, no entry | Spawn assignment reviewer; if spawn impossible, name capability | STOP; no silent fallback |
| spawn fails | Surface error; ask fallback? | No user OK → `BLOCKED` |
| 🔴 fallback without user OK | Offer paste or continue | STOP until user chooses |
| unstructured host output | Map via tables; `unknown`/`1` | Undecidable → `BLOCKED` |
| bound persist / `HIGH` vs `high` | Write `REV-n.json` with lowercase severity; still reply `[BLOCK]`/`[OK]` | Do not grep ralph scripts; never `review-record` |
| bound CLI unavailable | Conversational already writes files; CLI is maintenance-only | Write fails → still finish reply |
| bound PASS/NEEDS_CHANGES, commit <7 | Resolve SHA from scope/user | Still missing → `BLOCKED` |
| OPEN findings vs PASS | Force `NEEDS_CHANGES` | No soft-PASS; nits may be WAIVED |
| Write `AGENTS.md` / `instruction-correction.md` from this skill | Stay read-only; report only | Developer / ralph writes corrections |
| Follow-up `$jj-review` on same bound run, prior REV/host artifact exists | Step 3b delta; reuse findings; re-check OPEN | Do not spawn a second full-repo reviewer |
| Bound first `$jj-review` on a dirty tree | Step 4 exclusive assignment; spawn with listed files | Do not invoke Grok `/review` |
| `[BLOCK]` already in findings.md | Step 7 reply this turn; persist JSON files | Do not start FIX; do not retry CLI |

## Examples

```text
$jj-review
$jj-review run=task-login-reminder
$jj-review 评审当前 commit 的登录提醒改动
$jj-review record the host review result on the latest ralph run
$jj-review 把刚才宿主审查结论记到最新 ralph run
```
