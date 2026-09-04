---
name: jj-review
description: Adapter — prefer host built-in review/code-review. Bind ralph REV-*.json when a run exists; otherwise review working tree/HEAD. No init. No business-code changes.
argument-hint: run_id/task_thread/review_thread/reviewed_commit
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Skill
  - Task
---

# /jj-review

User: $ARGUMENTS

Locate a ralph run if present (explicit `run_id`, else `.workflow/ralph/index.md` **活跃** first — currently working; glob only if that table is empty). **Prefer the host built-in review / code-review entry** (Skill or Task/subagent); do not invent a parallel full self-review when the host can review. Bound run: map verdict + findings into `reviews/REV-n.json` and update `run.json` / `.state/events.jsonl`. Compare the diff to `task_plan.md` **## Steps** when that file exists (leftover: `## 计划 → ### 当前`). Set `source` to `host_builtin` | `user_provided` | `fallback_inline`. Unspecified and no run → unbound review of working tree / HEAD; do not init. Explicit `run_id` missing → BLOCKED. Bound PASS/NEEDS_CHANGES require `reviewed_commit`. Happy path (`PASS`): `通过。` + one-sentence summary. `NEEDS_CHANGES`: list each problem + 修改意见. Full rules: skill `jj-review` references (`host-review.md`, `report-layout.md`).
