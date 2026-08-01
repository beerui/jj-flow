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

Run the **full** jj-end closeout (do not stop after commit-only). Authoritative procedure: skill `jj-end` under the package/repo SSOT (`.codex/skills/jj-end/SKILL.md`). This file is a thin Claude entry only.

**Boundary:** end is **Git only** — does not write ralph `run.json` / does not set COMPLETED / does not kill the task. Soft-archive resume and abandon stay under `/jj-ralph`.

Mandatory order:

1. `git fetch` and resolve `work_branch` + `integration` (`dev` → `develop` → `main` unless overridden)
2. Commit this task only if needed (Chinese Conventional Commits)
3. Sync **work** with remote (ff-only, else merge pull) then `git push` work
4. Checkout **integration**, sync it, `git merge --no-edit` work (skip merge only if work == integration, and say so)
5. Push integration
6. Return per `return_to` (default work)

On conflict: abort merge, return to work, report files — do not claim success. No force push. Unrelated dirty files stay unstaged.

Final report in Chinese: branches, commit, pulls, merge, pushes, blockers.
