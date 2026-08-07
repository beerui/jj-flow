# Codex (and degraded host) compatibility

jj-team-lifecycle must remain usable on **Codex** without Claude-only primitives. Prefer **degraded full pipeline** over hard fail.

## Capability matrix (Codex focus)

| Capability | Claude full | Codex typical | Action |
| --- | --- | --- | --- |
| Skill entry | `/jj-team-lifecycle` | `$jj-team-lifecycle` / skill id | Same SKILL.md |
| `team-worker` / `team-supervisor` | Often available | Often **missing** | Spawn **general-purpose** (or host default) with same role-assignment prompt |
| `TeamCreate` / `TeamDelete` | Yes | Often **no** | Skip; identity = `session_id` + folder only |
| `TaskCreate` / `TaskUpdate` / `TaskList` | Yes | Often **no** | File task board: `<session>/tasks.json` |
| `SendMessage` team bus | Yes | Often **no** | Coordinator chat + `.msg/messages.jsonl` |
| `mcp__maestro__team_msg` | Optional | Usually **no** | File bus only |
| `maestro` CLI | Optional | Usually **no** | Direct Read/Grep/Glob/Edit/Bash |
| Parallel background agents | Yes | Limited / sequential | Spawn ready workers **one-at-a-time** if parallel unsafe |
| AskUserQuestion | Yes | May be plain prompt | Yes/no text is enough |

## File task board (`tasks.json`)

When host Task* APIs are unavailable, maintain:

```json
{
  "tasks": [
    {
      "id": "RESEARCH-001",
      "subject": "RESEARCH-001: Domain research",
      "status": "pending|in_progress|completed|failed",
      "owner": "analyst",
      "blocked_by": [],
      "artifact": null
    }
  ]
}
```

Coordinator rules:

1. Create all tasks in dispatch phase from [specs/pipelines.md](../specs/pipelines.md) for selected pipeline.
2. Workers claim: set `in_progress` only for own prefix; write artifact path on complete.
3. Resume/reconcile from `tasks.json` + `team-session.json` (not host TaskList).
4. CHECKPOINT tasks: run supervisor role **inline or serial** on degraded hosts (no resident SendMessage wake required).

## Message bus (file)

Append JSON lines to `.msg/messages.jsonl`:

```json
{"ts":"<iso>","from":"coordinator","type":"state_update","summary":"…","data":{}}
```

`meta.json`: roles, pipeline_mode, host_mode (`codex-degraded`), last_status_user_text.

## Nested notice (Codex)

Only when nested under ralph/review/dispatch — one sentence, e.g.:

```text
开启 lifecycle 模式，开始任务规格流水线 约 30-50分钟
```

Direct `$jj-team-lifecycle` on Codex: no mandatory notice.

## What still must work

- Session dir under `.workflow/.team/TLV4-*`
- Fixed role registry + prefab pipelines
- Nested one-line notice only under ralph/review/dispatch ([user-transparency.md](user-transparency.md))
- No checkpoint writes to ralph/dispatch

## What is OK to drop on Codex

- Real-time multi-agent chat between workers
- Team UI / TeamDelete
- Resident supervisor + SendMessage wake (run CHECKPOINT as serial supervisor turn)
- Fast-advance via SendMessage (coordinator polls `tasks.json` on `resume` instead)
