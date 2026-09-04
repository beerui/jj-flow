---
name: jj-end
description: Task closeout — fetch/sync work + integration, commit (Chinese Conventional Commits), push work, merge into integration (dev/develop/main), push integration, return. Not for mid-task checkpoints or commit-only.
argument-hint: "[integration=dev|develop|main] [return_to=work|integration] [dry_run=true]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Skill
---

# /jj-end

User: $ARGUMENTS

Run the **full** jj-end closeout (do not stop after commit-only). Authoritative procedure: skill `jj-end` under the package/repo SSOT (`skills/jj-end/SKILL.md`). This file is a thin Claude entry only.

**Boundary:** end is **Git only** — does not write ralph `run.json` / does not set COMPLETED / does not kill the task. Soft-archive resume and abandon stay under `/jj-ralph`.

Mandatory order:

1. `git fetch` and resolve `work_branch` + `integration` (`dev` → `develop` → `main` unless overridden)
2. Commit this task only if needed (Chinese Conventional Commits)
3. Sync **work** with remote (ff-only, else merge pull) then `git push` work
4. Checkout **integration**, sync it, `git merge --no-edit` work (skip merge only if work == integration, and say so)
5. Push integration
6. Return per `return_to` (default work)

On conflict: default self-merge — inventory both parents and keep both. Never merge `dev` into the work branch. Never `--ours/--theirs`. Unclear task / merge / requirement → ask first (do not invent or pick a side). Abort only if unhandleable. Do not abort because it “looks complex”. Do not resolve a subset then abort. No force push.

Finish reply: two Chinese lines — `合并状态：已合并到：<integration>` or `合并状态：已回退：<reason>`, then `当前分支：<HEAD>`. Classify table / blockers only on STOP / dry_run / unhandleable abort.
