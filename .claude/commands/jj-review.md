---
name: jj-review
description: single-repo review linked to ralph run
argument-hint: run_id/task_thread/review_thread
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
---

# /jj-review

User: $ARGUMENTS

Read-only review on current repo ralph run; persist with jj ralph review-record.
