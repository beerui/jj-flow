---
name: jj
description: "Compatibility entry for jj-flow. Routes $jj / /jj to jj-init, jj-same, jj-ralph, jj-review, jj-end, jj-dispatch (when supported), optional jj-team (persistent team, measures parallelism first), optional jj-team-coordinate / jj-team-lifecycle / jj-team-swarm (explicit multi-role, fixed SDLC, or ACO search only; never default delivery path; do not advance checkpoints), or experimental jj-evaluated."
---

# jj

## Role

`jj` is a compatibility entry, not a terminal-command entry. Prefer the native skills in production:

| Host | Entry |
| --- | --- |
| Codex / Qoder / Grok | `$jj-init` / `$jj-same` / `$jj-ralph` / `$jj-review` / `$jj-end` / `$jj-dispatch`; optional `$jj-team-coordinate` / `$jj-team-lifecycle` / `$jj-team-swarm`; experimental `$jj-evaluated` |
| Claude Code | `/jj-init` / `/jj-same` / `/jj-ralph` / `/jj-review` / `/jj-end` / `/jj-dispatch` / `/jj-team-coordinate` / `/jj-team-lifecycle` / `/jj-team-swarm` (**no** `/jj-evaluated` — intentional) |

## Pre-route checks (read-only)

Before choosing a target skill, probe when available (read if present, skip if missing — do not invent):

1. User’s original intent and scope (task / multi-repo / closeout / review / schedule)
2. If present: `.workflow/handoff/`, current or latest ralph `run.json` (including `run.handoff`)
3. If present: control-project manifest / approval snapshot (**read-only**; without control, do not fake a dispatch)
4. Whether branch / commit / workspace dirtiness matches the intent
5. Global home (`~/.jj-flow/map.md`) is read-only on delivery skills; join / KB bootstrap → `$jj-init`

## Routing priority

```text
1. Join global map / 梳理项目 / first-time KB bootstrap                           → $jj-init  (Claude: /jj-init)
2. Same-origin multi-repo migration / handoff consume / sync_key / continuous sync  → $jj-same  (Claude: /jj-same)
3. Multi-target approval / delivery_id / task_key / control-project schedule         → $jj-dispatch (Claude: /jj-dispatch Mode S)
4. Task ANALYZE→ARCHIVE loop / capability map / accept+archive / **post-archive continue·abandon** → $jj-ralph (Claude: /jj-ralph)
5. Task read-only review / write REV-*.json (includes latest soft-archived run) → $jj-review (Claude: /jj-review)
6. Task git closeout: commit → push work → merge integration                 → $jj-end   (Claude: /jj-end; does **not** kill ralph)
7. Offline episode evaluation (experimental)                                       → $jj-evaluated (no Claude command)
8. Persistent team across multiple tasks / team mode / 起团队 / parallel lanes       → $jj-team (Claude: /jj-team)
9. Explicit multi-role team pipeline / “Team Coordinate” / dynamic role-specs      → $jj-team-coordinate (Claude: /jj-team-coordinate)
10. Explicit fixed SDLC / team-lifecycle-v4 / spec-only|impl-only|full-lifecycle    → $jj-team-lifecycle (Claude: /jj-team-lifecycle)
11. Explicit ACO / adversarial swarm / multi-hypothesis search / 蚁群                → $jj-team-swarm (Claude: /jj-team-swarm)
12. Unclear                                                                        → clarify intent first (do not default to same)
```

Decision hints:

- Join map / 梳理项目 / bootstrap KB → init; migration/family/handoff → same; multi-project approval/dispatch → dispatch; task through acceptance **or post-archive continue/abandon** → ralph (**same-run resume first**); review-only → review; closeout merge → end (Git only); offline retrospective → evaluated
- **Multi-role execution** (explicit “team coordinate”, dynamic roles, TC session) → `jj-team-coordinate`; nested under ralph DELIVER when useful — **does not** replace ralph/dispatch facts
- **Fixed SDLC pipeline** (brief/PRD/architecture/epics, CHECKPOINT gates, team-lifecycle-v4) → `jj-team-lifecycle` (TLV4-*); not a substitute for coordinate when roles must be dynamic
- **Search / ACO / adversarial multi-hypothesis** → `jj-team-swarm` (TAS-*); not for tiny edits; not a substitute for coordinate implement pipelines
- `jj-dispatch`: install on **Codex / Qoder / Grok / Claude**; Claude slash is `/jj-dispatch` (Mode S, `host_id=claude-code`; do not write “Codex only”)
- `jj-evaluated`: experimental; **do not** invent a `/jj-evaluated` Claude command
- **Persistent team / team mode / 起团队 / parallel lanes** → `jj-team` (`TEAM-*` state under `~/.jj-flow/team/`); it **measures real parallelism first** and **sizes the roster** from that number — invoking it always provisions, so the count never becomes a refusal. After it provisions, a bare turn in the same session is a team task with no prefix. When a single-round engine fits better it routes onward to the three below

## Execution contract

1. Preserve the user’s original requirement and motive; do not rewrite the request into fixed CLI parameters.
2. Prefer project materials, `.workflow` state, session, handoff, ralph map, branch and commit evidence.
3. Locate code with Read, Glob, Grep, Bash, or an approved skill. If the host exposes **CodeGraph** MCP tools (e.g. `codegraph_explore`) **and** the workspace has a usable index (`.codegraph/` or healthy `codegraph status`), prefer graph queries for call paths, blast radius, and cross-file entry points — not for known single-file paths, `run.json`/gates, or git/workflow mechanics. Missing, error, or empty graph → fall back immediately; do not invent availability; graph output does not advance checkpoints.
4. Do not shell-exec conversation commands like `jj-same`. Conversational ralph / review / same / dispatch never run `jj ralph` / `ralph_ops.mjs`. Use `npx`/`jj` only to install assets.
5. When evidence is insufficient keep `PENDING`/`BLOCKED`; only ask the user where the answer would change delivery outcomes.
