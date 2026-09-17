---
name: jj-ralph
description: "Task requirement loop ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE; artifacts under .workflow/ralph/{task_key}/ + business-map; handoff in run.handoff. Same requirement → same run_id, including resume after archive. Triggers: $jj-ralph, /jj-ralph, 任务闭环, resume, 继续, 改坏了, 按审查改, 先不写代码. Cross-repo → jj-same; multi-project → jj-dispatch. Conversational path never uses --lite."
---

# jj-ralph

Complete one requirement in one business repo. Facts live in `.workflow/ralph/` documents (客服), verification artifacts, and Git; chat and memory cannot advance checkpoints.
Same requirement → same `run_id`, including COMPLETED/ABANDONED. Archive remains resumable. Users describe the work; resolve ids yourself.

Parent chat is **team-lead** (客服): align with the user, slice, write the assignment, spawn, take the report, write documents. **Do not** implement business code in this chat.

## Entry decision

| User intent / evidence | Action |
| --- | --- |
| 「继续 / 修完 / 按审查改 / 改坏了」 | Resume the session-linked run; rewrite the current contract when the approach changes. |
| 「审查修复 / review-fix」 | Resume the live feature task; findings are not a new requirement. |
| Same goal, including archived work | Resume; only a truly new confirmed requirement gets a new `task-<slug>/` folder (documents). Never `jj ralph init` CLI. |
| `## 同需求提示`, including `host.thread_id` / review task binding | Resolve candidates; do not auto-merge or abandon. |
| Review-only request | `$jj-review` stays read-only; wait for the user to say 「按审查改」 before editing. |
| 「先不写代码 / 先理解需求 / 先分析」 | Write Goal + `## 存疑`, then STOP at ANALYZE until 「开始做吧 / 我认可 / 继续改」. |
| Unasked extra | Do not commit / push / review / handoff / dispatch unless the user asked. |
| Drop this work | Mark ABANDONED in `index.md` + `run.json`; later resume is allowed. |
| 「交接到…」 | Handoff via `$jj-same` only when ready. |
| Multi-project scheduling | `$jj-dispatch` in the control project. |
| Map join / first-time knowledge bootstrap | `$jj-init`; home is `~/.jj-flow`. |
| Git closeout | `$jj-end` is Git-only, separate from Ralph archive. |

Conversational path never uses --lite: no `--lite`, `gate brief`, or `gate close`. ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE stay as documents.

## Immediate actions

This skill's `references/` are file shapes for CLI and docs, not a startup checklist. Spawn protocol (Announce / Occupancy / Resume / Description / exact paths): [assignment-spawn.md](../jj/references/assignment-spawn.md).

1. Unique 活跃 row in `.workflow/ralph/index.md` → that id; read that folder’s `task_plan.md`. 0 or >1 活跃 → **询问用户**. Never `jj ralph locate`. Confirm Goal/scope from `task_plan.md`. `## 归档提示` is prompt-only: uncertain → **询问用户**, never auto-archive. Leftover `RALPH-*` is read-only here.
2. **Screenshot / `[Image]` / 「这里」:** read the image before searching; use visible UI and the session-linked run.
3. For confirmed work, write `assignments/ASSIGNMENT-TASK<n>.md` in the 客服 shape (来自 team-lead / 读这些 / 交付 / **不要改** / 先确认再开工 / 短句汇报，等 Task n+1). `## 读这些` / `## 交付` = **exact paths** (assignment-spawn.md).
   - Follow assignment-spawn.md, then **Call `spawn_subagent` (`jj-implementer`; missing → `general-purpose`) in this turn** — exclusive input is that file, not the chat.
   - Named `jj-implementer` already has 人设. Missing → spawn-prompt first paragraph: 你不是 team-lead；只读独占派单文件；不要读父会话聊天；第一条回复一句话确认理解与第一步；只改「交付」文件；不要 Start broad / 全仓 grep / list_dir / 再 spawn；短句汇报；空闲不等于完成.
   - This turn does the **next unchecked Step** only. Parent: no business Edit/Write, no whole-repo grep, no reading cited source to plan. After the report, append `progress.md` (what / paths / verify); stop; do not start Task n+1.
   - 「按审查改」→ `ASSIGNMENT-FIX` from findings, same `run_id`. Do not read whole `business-map.json`. 改坏了 / rollback = rewrite live Goal / 验收 / Steps and append progress.
4. 大功能 / non-`tiny`: `$jj-review` — write `ASSIGNMENT-REVIEW`; Spawn `jj-reviewer` (missing → `general-purpose`); persist findings.md + REV json as documents. 本轮只有文案/样式 → skip review. 小改 (`tiny`) skip review. After `[OK]`/`[WARN]` wait for 用户验收. `[BLOCK]` → reply and wait 「按审查改」. `commit-scoped-review` = another REV json with `review_scope=commit` (documents).
5. After 用户验收: **MUST finalize** as documents — move the live dir to `completed/`, update `index.md`, dual-write `.state/run.json` (status COMPLETED, gates, handoff).

Never `ralph_ops.mjs`. Never `review-record` / `context --review` / `deliver-attempt` / `gate` / `finalize` / `jj ralph` CLI. Conversational path writes documents only. Conversational full has no lifetime iteration stop; **STAGNATION** still: same strategy twice → change approach (write `instruction-correction.md`).

## Red checkpoints

- **CHECKPOINT (multiple candidates):** list candidate titles when the intended run is unclear.
- **CHECKPOINT (unconfirmed requirement):** Unconfirmed requirement — **ask first** when a requirement / MUST / scope / acceptance cannot be confirmed. Do not invent, do not pick a side, do not treat a guess as the spec. Record `## 存疑`; stay in the current phase (or BLOCKED); do not rollback-phase to ANALYZE. Do not implement or `gate` analyze/plan/deliver/accept/archive until a written answer; never ACCEPT/ARCHIVE the guess. Once files are located and the requirement is confirmed, continue.
- **CHECKPOINT (analyze-hold):** Entry 「先不写代码」.
- **CHECKPOINT (irreversible):** push / merge / release / delete data require existing explicit authorization; prepare the result before asking if authorization is missing.
- **CHECKPOINT (user UAT):** Immediate 用户验收.

## Conversational documents

| File | Purpose |
| --- | --- |
| `task_plan.md` | Goal / 验收 / Steps (ANALYZE / PLAN / DELIVER contract) |
| `progress.md` | dated narrative; verify evidence (not `deliver-attempt` CLI) |
| `findings.md` | 改动摘要 / 踩坑 |
| `assignments/` | TASK / REVIEW / FIX |
| `index.md` | 活跃 / 已完成 |
| `.state/run.json` | dual-write status / gates / handoff (documents, not CLI) |

ledger is documents too.
