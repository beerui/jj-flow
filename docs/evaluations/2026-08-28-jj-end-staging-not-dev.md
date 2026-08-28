# Evaluation: EP-20260828 — jj-end merged staging instead of dev

**Date:** 2026-08-28
**Episode:** `EP-20260828-jj-end-staging-not-dev`
**Full report:** `docs/evaluations/EP-20260828-jj-end-staging-not-dev.md`

## Verdict

**Confirmed.** `/jj-end` on `trade-exhibition-mobile` locally merged `feat/custorm-accesses-users` into **`staging`** although `origin/dev` existed and the user did not set `integration=`. Remote staging was **not** updated (pre-receive rejected). Corrected to `origin/dev` `3343c0fd`.

## Root cause

Agent treated `Merge #N into staging` git history as family convention (priority 2) and overrode the `dev` heuristic (priority 3). Skill text only allows convention when **docs or user config name the integration branch**. Git log is neither.

## Promoted

**C-end-integration-no-gitlog-v1** (plus Conflict classify / G-end-2) approved 2026-08-28 into `skills/jj-end/SKILL.md` + user docs/pitfalls. Evaluated report: `docs/evaluations/EP-20260828-jj-end-staging-not-dev-report.md`.
