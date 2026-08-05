# Codex (and degraded host) compatibility

jj-team-coordinate must remain usable on **Codex** without Claude-only primitives. Prefer **degraded full pipeline** over hard fail.

## Capability matrix (Codex focus)

| Capability | Claude full | Codex typical | Action |
| --- | --- | --- | --- |
| Skill entry | `/jj-team-coordinate` | `$jj-team-coordinate` / skill id | Same SKILL.md |
| `team-worker` agent | Often available | Often **missing** | Spawn **general-purpose** (or host default worker) with same role-assignment prompt |
| `TeamCreate` / `TeamDelete` | Yes | Often **no** | Skip; identity = `session_id` + folder only |
| `TaskCreate` / `TaskUpdate` / `TaskList` | Yes | Often **no** | File task board: `<session>/tasks.json` (see below) |
| `SendMessage` team bus | Yes | Often **no** | Coordinator chat + `.msg/messages.jsonl` |
| `mcp__maestro__team_msg` | Optional | Usually **no** | File bus only |
| `maestro` CLI | Optional | Usually **no** | Direct Read/Grep/Glob/ApplyPatch/Bash |
| Parallel background agents | Yes | Limited / sequential | Spawn ready workers **one-at-a-time** if parallel unsafe; nested notice may mention serial |
| AskUserQuestion | Yes | May be plain prompt | Yes/no text is enough |

## File task board (`tasks.json`)

When host Task* APIs are unavailable, maintain:

```json
{
  "tasks": [
    {
      "id": "IMPL-1",
      "subject": "IMPL-1: …",
      "status": "pending|in_progress|completed|failed",
      "owner": "<role>",
      "blocked_by": [],
      "artifact": null
    }
  ]
}
```

Coordinator rules:

1. Create all tasks in Phase 3 from dependency graph (same IDs as would have been TaskCreate subjects).
2. Workers claim: set `in_progress` only for own prefix; write artifact path on complete.
3. Resume/reconcile from `tasks.json` + `team-session.json` (not host TaskList).

## Message bus (file)

Append JSON lines to `.msg/messages.jsonl`:

```json
{"ts":"<iso>","from":"coordinator","type":"state_update","summary":"…","data":{}}
```

`meta.json`: roles, pipeline_stages, host_mode (`codex-degraded`), last_status_user_text.

## Spawn template (Codex)

```text
// Prefer host-native agent/spawn; do not require subagent_type "team-worker"
spawn worker:
  name: <role>
  prompt: <same Role Assignment block as SKILL.md>
  tools: read/search/edit/shell as host allows
  after finish: append task_complete to .msg/messages.jsonl
                update tasks.json
                surface short [team] progress to user (coordinator turn)
```

If only **one** agent can run: run worker work **inline in the same turn only when** role count is 1; for multi-role, finish one worker prompt fully, update status, then start next (serial pipeline).

## Nested notice (Codex)

Only when nested under ralph/review/dispatch — one sentence, e.g.:

```text
开启 team 模式，开始任务跨模块实现 约 20-40分钟
```

Direct `$jj-team-coordinate` on Codex: no mandatory notice.

## What still must work

- Session dir under `.workflow/.team/TC-*`
- Dynamic role-specs
- Nested one-line notice only under ralph/review/dispatch ([user-transparency.md](user-transparency.md))
- No checkpoint writes to ralph/dispatch

## What is OK to drop on Codex

- Real-time multi-agent chat between workers
- Team UI / TeamDelete
- Fast-advance via SendMessage (coordinator polls `tasks.json` on `resume` / next user message instead)
