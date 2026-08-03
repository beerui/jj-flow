---
name: jj-review
description: Adapter — prefer host built-in review/code-review, map findings into ralph reviews/REV-*.json and update run.json. No init. No business-code changes.
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

Locate an existing ralph run (explicit `run_id`, else latest by `run.json.updated_at` then `run_id`). **Prefer the host built-in review / code-review entry** (Skill or Task/subagent); do not invent a parallel full self-review when the host can review. Map verdict + findings into `reviews/REV-n.json` and update `run.json` / `progress.md`. Set `source` to `host_builtin` | `user_provided` | `fallback_inline`. No run → BLOCKED; do not init. PASS/NEEDS_CHANGES require `reviewed_commit`. Full rules: skill `jj-review` references (`host-review.md`, `report-layout.md`).
