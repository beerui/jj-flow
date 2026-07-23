---
name: jj-review
description: single-repo read-only review linked to an existing ralph run; write reviews/REV-*.json and update run.json. No init. No business-code changes.
argument-hint: run_id/task_thread/review_thread/reviewed_commit
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Skill
---

# /jj-review

User: $ARGUMENTS

Locate an existing ralph run (explicit run_id, else latest by run.json.updated_at then run_id). Review read-only. Persist by writing `reviews/REV-n.json` and updating `run.json` / `progress.md`. No run → BLOCKED; do not init. PASS/NEEDS_CHANGES require reviewed_commit.
