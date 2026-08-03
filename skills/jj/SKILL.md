---
name: jj
description: Compatibility entry; routing layer for the jj-flow project-family orchestration workflow. Routes $jj / /jj to jj-same, jj-ralph, jj-review, jj-end, jj-dispatch (when the host supports it), or experimental jj-evaluated.
---

# jj

## Role

`jj` is a compatibility entry, not a terminal-command entry. Prefer the native skills in production:

| Host | Entry |
| --- | --- |
| Codex / Qoder / Grok | `$jj-same` / `$jj-ralph` / `$jj-review` / `$jj-end` / `$jj-dispatch`; experimental `$jj-evaluated` |
| Claude Code | `/jj-same` / `/jj-ralph` / `/jj-review` / `/jj-end` (**no** `/jj-dispatch`, **no** `/jj-evaluated` — intentional) |

## Pre-route checks (read-only)

Before choosing a target skill, probe when available (read if present, skip if missing — do not invent):

1. User’s original intent and scope (single-repo / multi-repo / closeout / review / schedule)
2. If present: `.workflow/handoff/`, current or latest ralph `run.json` (including `run.handoff`)
3. If present: control-project manifest / approval snapshot (**read-only**; without control, do not fake a dispatch)
4. Whether branch / commit / workspace dirtiness matches the intent

## Routing priority

```text
1. Same-origin multi-repo migration / handoff consume / sync_key / continuous sync  → $jj-same  (Claude: /jj-same)
2. Multi-target approval / delivery_id / task_key / control-project schedule         → $jj-dispatch (Codex/Qoder/Grok; no Claude slash)
3. Single-repo ANALYZE→ARCHIVE loop / capability map / accept+archive / **post-archive continue·abandon** → $jj-ralph (Claude: /jj-ralph)
4. Single-repo read-only review / write REV-*.json (includes latest soft-archived run) → $jj-review (Claude: /jj-review)
5. Single-repo git closeout: commit → push work → merge integration                 → $jj-end   (Claude: /jj-end; does **not** kill ralph)
6. Offline episode evaluation (experimental)                                       → $jj-evaluated (no Claude command)
7. Unclear                                                                         → clarify intent first (do not default to same)
```

Decision hints:

- Migration/family/handoff → same; multi-project approval/dispatch → dispatch; single-repo through acceptance **or post-archive continue/abandon** → ralph (**same-run resume first**); review-only → review; closeout merge → end (Git only); offline retrospective → evaluated
- `jj-dispatch`: install on **Codex / Qoder / Grok**; **no Claude slash = intentional** (do not write “Codex only”)
- `jj-evaluated`: experimental; **do not** invent a `/jj-evaluated` Claude command

## Execution contract

1. Preserve the user’s original requirement and motive; do not rewrite the request into fixed CLI parameters.
2. Prefer project materials, `.workflow` state, session, handoff, ralph map, branch and commit evidence.
3. Locate code with Read, Glob, Grep, Bash, or an approved skill.
4. Do not shell-exec conversation commands like `jj-same`; use `npx`/`jj` for installing assets or `jj ralph *` mechanical steps.
5. When evidence is insufficient keep `PENDING`/`BLOCKED`; only ask the user where the answer would change delivery outcomes.
