# review report layout

## Paths

```text
.workflow/ralph/<task_key>/          # leftover nest: tasks/<task_key>/
  task_plan.md
  progress.md                        # dated human narrative; do not dump review ISO lines here
  .state/run.json
  .state/events.jsonl                # machine review line (CLI review-record)
  .state/reviews/REV-n.json
```

## Selecting a run

- Explicit `run_id` → use that run; missing → BLOCKED (do not init).
- Unspecified → **currently working** run from `.workflow/ralph/index.md` first (one file; do not glob the tree yet):
  1. Read `## 活跃` (CLI heading `## 活跃（根目录 \`task-*\`)`). Skip the `（无）` placeholder.
  2. One `` `task-*` `` → bind it. Confirm `.state/run.json` at live `.workflow/ralph/<id>/` (leftover nest: `tasks/<id>/`). Missing file → ignore that row.
  3. Several → prefer status `IN_PROGRESS`; still several → `updated_at` desc then `run_id` desc among **those ids only**.
  4. No 活跃 row / no `index.md` → fallback glob: live `.workflow/ralph/<task_key>/.state/run.json`, then leftover `tasks/*/`, `completed/`, `archive/**/run.json`, unmigrated `RALPH-*/run.json` (read-only). Same sort: `updated_at` desc, then `run_id` desc. Live root and leftover must each be locatable.
- No runs at all → **unbound** review of working tree / HEAD; do not init / hand-build an empty run; do not persist `REV-*.json`.

## Review source (priority)

1. User-provided review result → map → persist if bound (`source=user_provided`)
2. Host built-in review → map → persist if bound (`source=host_builtin`)
3. Only when 1/2 unavailable: minimal inline review (`source=fallback_inline`)

Details: [host-review.md](host-review.md). Passes / nit cap / Steps: [review-policy.md](review-policy.md). **Do not** run a second parallel self-review that overwrites a host verdict already given (unless the user explicitly requests re-review).

Maintenance path and conversation path share the same schema: `jj ralph review-record --source … [--host-review-json …]` writes provenance fields; do not assume the CLI drops provenance.

## REV report fields

| Field | Rule |
| --- | --- |
| schema_version | `jj-flow/ralph-review/1.0` |
| review_id | `REV-<n>`, n starting at 1 and increasing |
| run_id | target ralph run |
| outcome | `PASS` / `NEEDS_CHANGES` / `BLOCKED` |
| reviewed_commit | required ≥7 chars for PASS/NEEDS_CHANGES; may be null for BLOCKED |
| task_thread_id | optional |
| review_thread_id | optional |
| summary | one sentence (may include host verdict summary) |
| findings | array; see table below |
| evidence_refs | optional path list; prefer including host review artifacts |
| recorded_at | ISO-8601 |
| source | recommended: `host_builtin` \| `user_provided` \| `fallback_inline` |
| host_review | recommended object: method / entry / artifact_paths / note |

### finding

| Field | Rule |
| --- | --- |
| id | e.g. `F-1` |
| severity | `high` / `medium` / `low` / `info` |
| file | relative path |
| line | positive integer |
| description | problem statement |
| status | `OPEN` / `RESOLVED` / `WAIVED` |
| acceptance | close condition |
| pass | optional: `bugs` / `security` / `compliance` |
| importance | optional: `important` / `nit` |

### outcome validation

- `PASS`: no OPEN finding, and `reviewed_commit` present (OPEN nits are WAIVED on PASS; OPEN important flips to `NEEDS_CHANGES`)
- `NEEDS_CHANGES`: ≥1 OPEN finding, and `reviewed_commit` present (nit cap 5; extras WAIVED)
- `BLOCKED`: insufficient evidence; state missing explicit `run_id` / diff / context (not “no ralph run”)

## Write back run.json

```json
{
  "artifact_refs": { "latest_review_ref": "reviews/REV-1.json" },
  "review": {
    "latest_review_id": "REV-1",
    "task_thread_id": "019f8c85-8c32-72c3-b62b-ee9f0753a9e7",
    "reviews": [
      {
        "review_id": "REV-1",
        "path": "reviews/REV-1.json",
        "outcome": "PASS",
        "reviewed_commit": "abcdef1234567",
        "task_thread_id": "019f8c85-8c32-72c3-b62b-ee9f0753a9e7",
        "review_thread_id": "019f8cb8-14e9-79b3-bf40-30ba6c89ef2c",
        "recorded_at": "2026-07-23T08:00:00.000Z"
      }
    ]
  }
}
```

`jj ralph review-record` appends the machine line to `.state/events.jsonl` (not `progress.md`):

```text
- <iso> review REV-1 PASS commit=<sha> source=host_builtin task_thread=<id> review_thread=<id>
```

Do not copy that ISO line into `progress.md`. Optional human note: a dated `## YYYY-MM-DD` bullet such as “review REV-1 NEEDS_CHANGES”.

## Boundaries

- Does not replace dispatch’s formal VERIFIED review gate.
- Does not replace the host review engine; this skill binds the run and persists the contract.
- Maintenance may use existing `jj ralph review-record`; conversation execution may write files directly by default.
