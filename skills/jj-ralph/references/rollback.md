# Ralph rollback (agent)

Implementation: `src/ralph.mjs` — `setGate` / `rollbackPhase` / `setRunStatus` / `resumeRun` / `abandonRun` / `archiveRun`.

## Actions

| Intent | Command | Notes |
| --- | --- | --- |
| Flip gate | `gate --status FAIL` | Must write progress / updated_at |
| Phase rollback | `rollback-phase --to …` | **Adjacent edges only** (table below) |
| Pause / block | `set-status PAUSED\|BLOCKED` | Reason required |
| Continue after archive | `resume` | Same run; may archive again |
| Drop mid-flight | `abandon` | No map; may resume |
| Truly new requirement | `init` new run | Do not treat “edit same requirement again” as a new run |
| Code rollback | git suggestion | No automatic revert by default |

## Phase adjacent edges

```text
PLAN    → ANALYZE
DELIVER → PLAN
ACCEPT  → DELIVER
ARCHIVE → ACCEPT
```

`rollbackPhase`: validates adjacent edge; when `COMPLETED`/`ABANDONED`, default first return to `IN_PROGRESS`; later gates set PENDING; write progress.

## status

| status | Meaning |
| --- | --- |
| `IN_PROGRESS` etc. | Active / clock stopped |
| `COMPLETED` | Display state after latest archive; **may resume** |
| `ABANDONED` | Abandoned; no map-merge; may resume |

## archive

- Requires accept PASS (or force)
- In-place COMPLETED on the live run dir; inline `run.archive` sha256 ledger; re-archive appends `archive_history` (time + git HEAD + manifest hash)
- Does **not** copy files or write `archive-manifest.json`
- map-merge (forbidden when ABANDONED)
- Records `last_archived_at` / `last_archive_path` (path = live `.workflow/ralph/<run_id>`)
- Leftover `.workflow/ralph/archive/` copies are read-only historical snapshots; do not migrate or delete them. Continue edits the current run directory

Continue decision tree: [post-complete-continue.md](post-complete-continue.md).

## Scripts

```bash
ralph_ops.mjs gate --run-id RALPH-x --gate accept --status FAIL
ralph_ops.mjs rollback-phase --run-id RALPH-x --to DELIVER --reason "…"
ralph_ops.mjs resume --run-id RALPH-x --reason "…"
ralph_ops.mjs abandon --run-id RALPH-x --reason "…"
ralph_ops.mjs set-status --run-id RALPH-x --status PAUSED --reason "…"
```
