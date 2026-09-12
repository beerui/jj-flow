---
name: jj-review
description: Adapter — 客服 ASSIGNMENT-REVIEW spawn; never host /review. Bind findings.md + REV-*.json when a run exists; otherwise review working tree/HEAD. No init. No business-code changes.
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

Parent is team-lead. Do not re-read this command or jj-review references at startup. Locate a ralph run if present (explicit `run_id`, else `.workflow/ralph/index.md` **活跃** first). Write `ASSIGNMENT-REVIEW` (this-round files). Before spawn, one user-visible line **派遣审查** (e.g. 派遣reviewer审查改动代码); do not wait silently. Then `spawn_subagent` (`jj-reviewer`; missing → `general-purpose`) this turn with `description` starting `[reviewer]` (never `[reviewer] local changes`); do not review in this chat; **do not** call host `/review`; **do not** run `review-record` / `context --review`. A live `[reviewer]` still running → do not spawn `$jj-same`. Follow-up on a bound run with `REV-*` is a **delta** + `resume_from` last completed `jj-reviewer` (G-review-5). Bound: findings.md + `REV-n.json` files (`HIGH`→`high`); reply `[OK]`/`[BLOCK]` this turn. Unspecified and no run → unbound; do not init. Full rules: skill `jj-review`. G-review-1 / G-review-2 / G-review-3 / G-review-4 / G-review-5.
