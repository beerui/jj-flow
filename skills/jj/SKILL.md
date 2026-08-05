---
name: jj
description: "Compatibility entry for jj-flow. Routes $jj / /jj to jj-same, jj-ralph, jj-review, jj-end, jj-dispatch (when supported), optional jj-team-coordinate / jj-team-swarm (explicit multi-role or ACO search only; never default delivery path; do not advance checkpoints), or experimental jj-evaluated."
---

# jj

## Role

`jj` is a compatibility entry, not a terminal-command entry. Prefer the native skills in production:

| Host | Entry |
| --- | --- |
| Codex / Qoder / Grok | `$jj-same` / `$jj-ralph` / `$jj-review` / `$jj-end` / `$jj-dispatch`; optional `$jj-team-coordinate` / `$jj-team-swarm`; experimental `$jj-evaluated` |
| Claude Code | `/jj-same` / `/jj-ralph` / `/jj-review` / `/jj-end` / `/jj-team-coordinate` / `/jj-team-swarm` (**no** `/jj-dispatch`, **no** `/jj-evaluated` — intentional) |

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
7. Explicit multi-role team pipeline / “Team Coordinate” / dynamic role-specs      → $jj-team-coordinate (Claude: /jj-team-coordinate)
8. Explicit ACO / adversarial swarm / multi-hypothesis search / 蚁群                 → $jj-team-swarm (Claude: /jj-team-swarm)
9. Unclear                                                                         → clarify intent first (do not default to same)
```

Decision hints:

- Migration/family/handoff → same; multi-project approval/dispatch → dispatch; single-repo through acceptance **or post-archive continue/abandon** → ralph (**same-run resume first**); review-only → review; closeout merge → end (Git only); offline retrospective → evaluated
- **Multi-role execution** (explicit “team coordinate”, dynamic roles, TC session) → `jj-team-coordinate`; nested under ralph DELIVER when useful — **does not** replace ralph/dispatch facts
- **Search / ACO / adversarial multi-hypothesis** → `jj-team-swarm` (TAS-*); not for tiny edits; not a substitute for coordinate implement pipelines
- `jj-dispatch`: install on **Codex / Qoder / Grok**; **no Claude slash = intentional** (do not write “Codex only”)
- `jj-evaluated`: experimental; **do not** invent a `/jj-evaluated` Claude command

## Execution contract

1. Preserve the user’s original requirement and motive; do not rewrite the request into fixed CLI parameters.
2. Prefer project materials, `.workflow` state, session, handoff, ralph map, branch and commit evidence.
3. Locate code with Read, Glob, Grep, Bash, or an approved skill.
4. Do not shell-exec conversation commands like `jj-same`; use `npx`/`jj` for installing assets or `jj ralph *` mechanical steps.
5. When evidence is insufficient keep `PENDING`/`BLOCKED`; only ask the user where the answer would change delivery outcomes.
