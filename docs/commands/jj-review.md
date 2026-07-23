# jj-review

Single-repo read-only review linked to an existing ralph run.

## Flow

locate existing run -> review commit/diff -> write `reviews/REV-n.json` -> update `run.json` / `progress.md`

Run selection: explicit `run_id`, else latest by `run.json.updated_at` desc then `run_id` desc.

No run → BLOCKED. Do not init. Do not change business code. Does not replace dispatch VERIFIED gate.

## Report

Copy `.codex/skills/jj-review/references/review-report.skeleton.json`.

Rules:

- PASS / NEEDS_CHANGES require `reviewed_commit`
- PASS has no OPEN findings
- NEEDS_CHANGES has ≥1 OPEN finding
- BLOCKED when evidence is insufficient

## Optional maintenance CLI

`jj ralph review-record` may be used in repo maintenance. Conversation path writes files directly.
