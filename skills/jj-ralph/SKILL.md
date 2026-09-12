---
name: jj-ralph
description: "Task requirement loop ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE; artifacts under .workflow/ralph/{task_key}/ + business-map; handoff in run.handoff. Same requirement → same run_id, including resume after archive. Triggers: $jj-ralph, /jj-ralph, 任务闭环, resume, 继续, 改坏了, 按审查改, 先不写代码. Cross-repo → jj-same; multi-project → jj-dispatch. Conversational path never uses --lite."
---

# jj-ralph

Complete one requirement in one business repo. Facts live in `.workflow/ralph/` documents (客服), verification artifacts, and Git; chat and memory cannot advance checkpoints.
Same requirement → same `run_id`, including COMPLETED/ABANDONED. Archive remains resumable. Users describe the work; resolve ids yourself.

Parent chat is **team-lead** (客服): align with the user, slice, write the assignment, spawn, take the report, write documents. **Do not** implement business code in this chat. **Do not** run `ralph_ops.mjs` / `jj ralph` / `review-record` / `context --review` / `deliver-attempt` / `gate` / `finalize` CLI.

## Entry decision

| User intent / evidence | Action |
| --- | --- |
| 「继续 / 修完 / 按审查改 / 改坏了」 | Resume the session-linked run; rewrite the current contract when the approach changes. |
| 「审查修复 / review-fix」 | Resume the live feature task; findings are not a new requirement. |
| Same goal, including archived work | Resume; only a truly new confirmed requirement gets a new `task-<slug>/` folder (documents). Never `jj ralph init` CLI. |
| `## 同需求提示`, including `host.thread_id` / review task binding | Resolve candidates; do not auto-merge or abandon. |
| Review-only request | `$jj-review` stays read-only; wait for the user to say 「按审查改」 before editing. |
| 「先不写代码 / 先理解需求 / 先分析」 | Write Goal + `## 存疑`, then STOP at ANALYZE. |
| Drop this work | Mark ABANDONED in `index.md` + `run.json`; later resume is allowed. |
| 「交接到…」 | Handoff via `$jj-same` only when ready. |
| Multi-project scheduling | `$jj-dispatch` in the control project. |
| Map join / first-time knowledge bootstrap | `$jj-init`; home is `~/.jj-flow`. |
| Git closeout | `$jj-end` is Git-only, separate from Ralph archive. |

Conversational path never uses --lite: no `--lite`, `gate brief`, or `gate close`. ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE stay as documents.

## Immediate actions

Do **not** re-read this SKILL. Do **not** open skill `references/` from this entry. Do **not** run CLI.

1. Unique 活跃 row in `.workflow/ralph/index.md` → that id; read that folder’s `task_plan.md`. 0 or >1 活跃 → **询问用户**. Never `jj ralph locate`. Confirm Goal/scope from `task_plan.md`. `## 归档提示` is prompt-only: uncertain → **询问用户**, never auto-archive. Leftover `RALPH-*` is read-only here.
2. **Screenshot / `[Image]` / 「这里」:** read the image before searching; use visible UI and the session-linked run.
3. For confirmed work, write `assignments/ASSIGNMENT-TASK<n>.md` in the 客服 shape (来自 team-lead / 读这些 / 交付 / **不要改** / 先确认再开工 / 短句汇报，等 Task n+1). `## 读这些` / `## 交付` = **exact paths** (never「以现有代码为准」; never sample session/commit ids — workers `git show` them). **Before the spawn tool call**, one user-visible line naming who and what (e.g. **派遣前端开发实现任务** / **派遣开发实现**; 「按审查改」→ **派遣按审查改**). Do not wait silently (Grok may hold later text until the worker returns). **Call `spawn_subagent` (`jj-implementer`; missing → `general-purpose`) in this turn** — `description` starts `[implementer]`; exclusive input is that file, not the chat. Same thread, last completed `jj-implementer` in this cwd → `resume_from` that id (G-ralph-5). Different persona/cwd → new spawn (`resume_from` inherits cwd). Do not `send_subagent_message` a different slice. Prompt first paragraph = 人设提示词: 你不是 team-lead；只读 exclusive 派单；不要读 parent 聊天；第一条回复一句话确认理解与第一步；只改「交付」文件；不要 Start broad / 全仓 grep / list_dir / 再 spawn；短句汇报；Idle ≠ 完成. Saying you will spawn without calling it fails. First reply = one-line confirm; last action = report with evidence. This turn does the **next unchecked Step** only. Parent: no business Edit/Write, no whole-repo grep, no reading cited source to plan. After the report, append `progress.md` (what / paths / verify); stop; do not start Task n+1. 「按审查改」→ `ASSIGNMENT-FIX` from findings, same `run_id`. Do not Read `business-map.json`; empty CAP hits are valid. 改坏了 / rollback = rewrite live Goal / 验收 / Steps and append progress. A live `[reviewer]` still running → **do not spawn** (incl. `$jj-same`); announce 审查还在跑 (G-ralph-4).
4. 大功能 / non-`tiny`: `$jj-review` (ASSIGNMENT-REVIEW spawn; persist findings.md + REV json). **Before spawn: 派遣审查** (e.g. 派遣 reviewer 审查改动代码). `description` starts `[reviewer]` (never `[reviewer] local changes`). Spawn `jj-reviewer` (missing → `general-purpose`). Never host `/review`. Never `review-record`. 本轮只有文案/样式 → skip review. 小改 (`tiny`) skip review. After `[OK]`/`[WARN]` wait for 用户验收. `[BLOCK]` → reply and wait 「按审查改」. `commit-scoped-review` = another REV json with `review_scope=commit` (documents).
5. After 用户验收: **MUST finalize** as documents — move the live dir to `completed/`, update `index.md`, dual-write `.state/run.json` (status COMPLETED, gates, handoff). Never finalize CLI.

Never `ralph_ops.mjs`. Mechanical CLI is CLI-users only. Conversational full has no lifetime `max_iterations` stop; **STAGNATION** still: same strategy twice → change approach (write `instruction-correction.md`). Do not start Task n+1 after a successful slice.

## Red checkpoints

- **CHECKPOINT (multiple candidates):** list candidate titles when the intended run is unclear.
- **CHECKPOINT (unconfirmed requirement):** Unconfirmed requirement — **ask first** when a requirement / MUST / scope / acceptance cannot be confirmed. Do not invent, do not pick a side, do not treat a guess as the spec. Record `## 存疑`; stay in the current phase (or BLOCKED); do not rollback-phase to ANALYZE. Do not implement or `gate` analyze/plan/deliver/accept/archive until a written answer; never ACCEPT/ARCHIVE the guess. Once files are located and the requirement is confirmed, continue.
- **CHECKPOINT (analyze-hold):** 「先不写代码」 → Goal + 存疑 only, no gate PASS or implementation until 「开始做吧 / 我认可 / 继续改」.
- **CHECKPOINT (irreversible):** push / merge / release / delete data require existing explicit authorization; prepare the result before asking if authorization is missing.
- **CHECKPOINT (user UAT):** after review `[OK]`/`[WARN]`, wait for 用户验收 before archive.

## Conversational documents

| File | Purpose |
| --- | --- |
| `task_plan.md` | Goal / 验收 / Steps (ANALYZE / PLAN / DELIVER contract) |
| `progress.md` | dated narrative; verify evidence (not `deliver-attempt` CLI) |
| `findings.md` | 改动摘要 / 踩坑 |
| `assignments/` | TASK / REVIEW / FIX |
| `index.md` | 活跃 / 已完成 |
| `.state/run.json` | dual-write status / gates / handoff (documents, not CLI) |

### Golden Q&A — G-ralph-1 (must not regress)

**Q:** Same `run_id`, complex work, `iteration` already 20. Does `deliver-attempt` BLOCK `MAX_ITERATIONS`? Raise the ceiling with `set-status`, or `init` a new run?

**A:** No. Conversational `$jj-ralph` (`gate_set=full`) has no lifetime iteration stop — one requirement, one folder, many assignments (客服). Write `ASSIGNMENT-TASK<n>.md` and spawn; rewrite live Steps and append progress for a new slice. This turn does the **next unchecked Step** only. `STAGNATION` still BLOCKS if the same strategy fails twice **in the current slice**. Do not `set-status` CLI. Sample: `EP-20260910` `task-260911-risk-setting`.

### Golden Q&A — G-ralph-2 (must not regress)

**Q:** User gave `@file:line` CSS. Unique 活跃 run. SKILL already injected. Re-read ops/phases/layout/must, parent-grep, `ralph_ops context`, edit Vue in this chat?

**A:** No. Parent is team-lead. Unique 活跃 row / `task_plan.md`. Write `ASSIGNMENT-TASK` with exact paths. Announce **派遣开发实现** (e.g. 派遣前端开发实现任务) then `spawn_subagent` (`jj-implementer`; missing → `general-purpose`) this turn; `description` starts `[implementer]`; exclusive input is that file; prompt first paragraph forbids Start broad / repo grep / list_dir. Do not wait silently. Do not run CLI. Do not implement in the parent chat. Later TASK same cwd: `resume_from` last implementer. Sample: `01a08e5b`. Miss: `01a08fa0` no 派遣; `01a08fa6` TASK1 grepped at t+4s.

### Golden Q&A — G-ralph-3 (must not regress)

**Q:** Unique 活跃 run. Subagent reported verify PASS. Persist with `ralph_ops deliver-attempt` then `gate deliver`? Locate with `jj ralph locate`? Archive with `finalize` CLI?

**A:** No. Append `progress.md`. Dual-write `.state/run.json`. Locate via unique 活跃 `index.md`. MUST finalize = `completed/` + `index.md` + run.json. Never CLI. Sample: same rule as G-review-3 (`01a08ea0`); ledger is documents too.

### Golden Q&A — G-ralph-4 (must not regress)

**Q:** A `[reviewer]` worker is still running. User `/jj-same`. Spawn research this turn because `work_policy` / G-same-1 say spawn this turn?

**A:** No. Occupancy wins. Announce 审查还在跑; keep `[reviewer]` labeled; do not spawn same until it returns. Miss: `01a08fa6` RESEARCH at 09:28:03 over REVIEW until 09:28:07; both unlabeled General.

### Golden Q&A — G-ralph-5 (must not regress)

**Q:** TASK1 `jj-implementer` completed. TASK2 cold-spawn a new one? Resume the reviewer? `send_subagent_message` the next assignment?

**A:** No. Same type + same cwd + completed → `resume_from` that id with a new exclusive ASSIGNMENT. Different persona or different cwd → new spawn (`resume_from` inherits cwd). Live child: occupancy; `send_subagent_message` only steers that child, never a different slice. Miss: `01a08fa6` 11× cold General.
