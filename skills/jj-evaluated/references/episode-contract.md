# Episode contract

`jj-evaluated` treats an episode as a bounded unit of work, not as a single
conversation message. An episode may join a source analysis, a handoff snapshot,
one or more target adaptations, a ralph run, and the resulting commits and
verification artifacts.

## Episode identity

Record stable identifiers without inventing them:

| Field | Meaning |
| --- | --- |
| `episode_id` | Local evaluation case id. |
| `thread_id` / `export_id` | Source conversation or export reference. |
| `run_id` / `task_key` | Ralph or dispatch identity, when present. |
| `role` | One of product labels `项目A`, `项目B`, `项目C`; keep roles distinct (do not rename). |
| `project_path` | Absolute path captured at ingestion time. |
| `branch` / `commit` | Git fact used for the episode baseline. |
| `artifact_refs` | Relative/absolute paths plus SHA-256 where possible. |

## Normalized event

Each event should have the following shape (additional fields are allowed):

```json
{
  "event_id": "evt-…",
  "episode_id": "ep-…",
  "kind": "user_request|user_correction|agent_turn|tool_call|subagent|artifact_write|handoff_created|handoff_superseded|commit|verification|review|wait|escalation",
  "phase": "intake|analyze|plan|deliver|accept|archive|dispatch|sync",
  "role": "项目A",
  "started_at": "2026-07-24T00:00:00Z",
  "ended_at": "2026-07-24T00:01:00Z",
  "timestamp_provenance": "thread|artifact|git|filesystem|user_export",
  "clock_quality": "exact|derived|inconsistent|unknown",
  "parent_event_id": null,
  "status": "completed|blocked|superseded|unknown",
  "artifact_refs": [],
  "input_hash": null,
  "output_hash": null,
  "labels": ["handoff_reuse"],
  "cost": {
    "active_seconds": null,
    "wait_seconds": null,
    "tokens": null,
    "tool_calls": null
  },
  "notes": ""
}
```

Null is preferable to false precision. Keep raw source offsets or line numbers
in `notes`/`artifact_refs` so a reviewer can reproduce the derivation.

## Time accounting

Derive and report these separately:

- `active_duration`: model/human work interval supported by the thread export;
- `wall_span`: first event to last event, including pauses;
- `idle_duration`: wall span not attributable to active work;
- `handoff_wait`: waiting for a usable snapshot, branch, or target;
- `tool_wait`: build, lint, browser, endpoint, or subprocess wait;
- `human_attention`: user corrections, approvals, and decisions;
- `artifact_write_span`: filesystem mtime interval, diagnostic only.

`artifact_write_span` must never overwrite a stronger thread or user-export
timestamp. If sources disagree, set `clock_quality: inconsistent`, retain both
values, and explain the disagreement.

## Behavioral labels

Use a small controlled vocabulary and allow multiple labels:

`requirement_recovery`, `role_mapping`, `handoff_reuse`,
`redundant_analysis`, `target_native_adaptation`, `branch_correction`,
`stale_snapshot`, `clock_inconsistency`, `validation_wait`, `user_correction`,
`regression`, `tool_unavailable`, `subagent_overhead`, `evidence_gap`.

Labels describe observed behavior, not blame. Keep an evidence reference for
each high-impact label.
