# review report layout

## Paths

```text
.workflow/ralph/<run_id>/
  run.json
  progress.md
  reviews/REV-n.json
```

## Selecting a run

- Explicit `run_id` → use that run; missing → BLOCKED.
- Unspecified → pick latest among `.workflow/ralph/RALPH-*/run.json`:
  1. `updated_at` descending
  2. on ties, `run_id` descending
- No runs at all → BLOCKED; do not init / hand-build an empty run.

## Review source (priority)

1. User-provided review result → map → persist (`source=user_provided`)
2. Host built-in review → map → persist (`source=host_builtin`)
3. Only when 1/2 unavailable: minimal inline review (`source=fallback_inline`)

Details: [host-review.md](host-review.md). **Do not** run a second parallel self-review that overwrites a host verdict already given (unless the user explicitly requests re-review).

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

### outcome validation

- `PASS`: no OPEN finding, and `reviewed_commit` present
- `NEEDS_CHANGES`: ≥1 OPEN finding, and `reviewed_commit` present
- `BLOCKED`: insufficient evidence; state missing run / diff / context

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

Append one line to `progress.md`:

```text
- <iso> review REV-1 PASS commit=<sha> source=host_builtin task_thread=<id> review_thread=<id>
```

## Boundaries

- Does not replace dispatch’s formal VERIFIED review gate.
- Does not replace the host review engine; this skill binds the run and persists the contract.
- Maintenance may use existing `jj ralph review-record`; conversation execution may write files directly by default.
