---
name: jj-team-lifecycle
description: "Fixed SDLC session execution engine for jj-flow (vendored team-lifecycle-v4). Fixed roles: analyst/writer/planner/executor/tester/reviewer/supervisor; pipelines spec-only|impl-only|full-lifecycle under .workflow/.team/TLV4-*. Nested under ralph/review/dispatch: one-line notice only; direct invoke has no mandatory banner. Codex-compatible degraded path. Does NOT advance ralph/dispatch checkpoints. Triggers: /jj-team-lifecycle, $jj-team-lifecycle, team-lifecycle-v4, team lifecycle, SDLC pipeline, full lifecycle team."
---

# jj-team-lifecycle

> **Layer:** session execution engine (not a delivery control path)  
> **Upstream:** Claude `team-lifecycle-v4` (fixed-role SDLC pipeline + CHECKPOINT supervisor)  
> **Product id / install dir:** `jj-team-lifecycle`  
> **Session prefix:** `TLV4` → `.workflow/.team/TLV4-<slug>-<date>/`  
> **Sibling:** dynamic multi-role → [`jj-team-coordinate`](../jj-team-coordinate/SKILL.md); ACO search → [`jj-team-swarm`](../jj-team-swarm/SKILL.md)  
> **Design:** [docs/design-docs/jj-team-lifecycle.md](../../docs/design-docs/jj-team-lifecycle.md)

Fixed-role software lifecycle: **specification → planning → implementation → testing → review**.  
Coordinator-driven beat model; roles are **pre-defined** (not dynamic role-specs).

## User notice (nested jj-flow only)

- **Direct** `/jj-team-lifecycle` / `$jj-team-lifecycle`: **no** mandatory notice; just run.
- **Nested** under **jj-ralph / jj-review / jj-dispatch**: **one sentence** before spawn:  
  `开启 lifecycle 模式，开始任务<简述> 约 20-45分钟`

Full rules: [references/user-transparency.md](references/user-transparency.md).  
Catalog gate still applies (no weak reason → do not start lifecycle).

## jj-flow hard boundaries

| MUST | MUST NOT |
| --- | --- |
| Write session state under `.workflow/.team/TLV4-*` (business repos) | Advance ralph `run.json` phase/gates by chat alone |
| Produce `spec/` / `plan/` / `artifacts/` for humans or parent skills to cite | Create `delivery_id` / durable dispatch `task_key` |
| Prefer this skill when a **fixed SDLC document + gate chain** helps | Replace `jj-same` / `jj-ralph` / `jj-dispatch` |
| On missing maestro / TeamCreate / team-worker: degrade to file bus + available subagents | Pretend lifecycle completion == ACCEPT PASS |
| When nested in ralph/review/dispatch: one-line notice before spawn | Spam multi-line banners on direct use |

**Identity separation:** `TLV4-*` ≠ `TC-*` ≠ `TAS-*` ≠ `RALPH-*` ≠ `DEL-*`.

**When to use:** need standard engineering pipeline (brief/PRD/architecture/epics and/or plan→impl→test→review) with CHECKPOINT consistency gates.  
**When not to:** tiny single-point edits (direct or light ralph); dynamic multi-module parallel without fixed docs (**jj-team-coordinate**); multi-hypothesis search (**jj-team-swarm**); multi-project schedule (**jj-dispatch**).

### vs jj-team-coordinate

| | **jj-team-lifecycle** | **jj-team-coordinate** |
| --- | --- | --- |
| Roles | **Fixed** registry | **Dynamic** role-specs (≤5) |
| Pipeline | Prefab `spec-only` / `impl-only` / `full-lifecycle` | Task-analysis graph |
| Best for | Spec document chain + SDLC gates | Flexible multi-role implement/analysis |

## Architecture

```text
Skill(skill="jj-team-lifecycle", args="task description")
                    |
         SKILL.md (this file) = Router
                    |
     +--------------+--------------+
     |                             |
  no --role flag              --role <name>
     |                             |
  Coordinator                  Worker
  roles/coordinator/role.md    roles/<name>/role.md
     |
     +-- analyze → dispatch → spawn → STOP
                                 |
                    +--------+---+--------+
                    v        v            v
             [team-worker]  ...    [supervisor]
              per-task               resident (CHECKPOINT)
              lifecycle              message-driven / file bus
```

## Role registry

| Role | Path | Prefix | Inner Loop |
| --- | --- | --- | --- |
| coordinator | [roles/coordinator/role.md](roles/coordinator/role.md) | — | — |
| analyst | [roles/analyst/role.md](roles/analyst/role.md) | RESEARCH-* | false |
| writer | [roles/writer/role.md](roles/writer/role.md) | DRAFT-* | true |
| planner | [roles/planner/role.md](roles/planner/role.md) | PLAN-* | true |
| executor | [roles/executor/role.md](roles/executor/role.md) | IMPL-* | true |
| tester | [roles/tester/role.md](roles/tester/role.md) | TEST-* | false |
| reviewer | [roles/reviewer/role.md](roles/reviewer/role.md) | REVIEW-*, QUALITY-*, IMPROVE-* | false |
| supervisor | [roles/supervisor/role.md](roles/supervisor/role.md) | CHECKPOINT-* | false |

## Role router

Parse `$ARGUMENTS`:

- Has `--role <name>` → Read `roles/<name>/role.md`, execute Phase 2–4
- No `--role` → load `roles/coordinator/role.md`, execute entry router

Pipeline selection (coordinator Phase 2+): keywords or explicit flags:

| Flag / keywords | Pipeline |
| --- | --- |
| `--pipeline spec-only` / spec, design, requirements, PRD | `spec-only` |
| `--pipeline impl-only` / implement, build, code (spec already exists) | `impl-only` |
| `--pipeline full-lifecycle` / full, lifecycle, end-to-end | `full-lifecycle` |
| Ambiguous | Ask user |

Also honor: `-y` / `--yes` (skip confirmations), `--continue` / `resume`, `--no-supervision` (skip CHECKPOINT tasks).

## Shared constants

| Constant | Value |
| --- | --- |
| Session prefix | `TLV4` |
| Session path | `.workflow/.team/TLV4-<slug>-<date>/` |
| Worker agent | `team-worker` ([agents/team-worker.md](agents/team-worker.md)); fallback `general-purpose` |
| Supervisor | Prefer `team-supervisor` if host has it; else `team-worker` / `general-purpose` with supervisor role_spec |
| CLI tools | `maestro delegate --mode analysis\|write` (optional) |
| Message bus | Prefer `mcp__maestro__team_msg`; else `.msg/messages.jsonl` + `meta.json` |

### skill_root resolution (multi-host)

Do **not** hardcode `.claude/skills/team-lifecycle-v4`. Resolve in order:

1. Directory that contains this `SKILL.md` (installed skill root)
2. Repo dev path: `skills/jj-team-lifecycle/`
3. Host installs: `~/.claude|/.codex|/.grok|/.qoder/skills/jj-team-lifecycle`
4. Legacy read-only fallback: `…/skills/team-lifecycle-v4` (not SSOT)

## Worker spawn template

```text
Agent({
  subagent_type: "team-worker",  // or "general-purpose"
  description: "Spawn <role> worker",
  team_name: <team-name>,
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: <skill_root>/roles/<role>/role.md
session: <session-folder>
session_id: <session-id>
team_name: <team-name>
requirement: <task-description>
inner_loop: <true|false>

## Progress Milestones
session_id: <session-id>
Report progress via team_msg (or append .msg/messages.jsonl) at natural phase boundaries.
Report blockers immediately (type="blocker").
Report completion (type="task_complete") after final coordinator message.

Read role_spec for Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery) -> role Phase 2-4 -> built-in Phase 5 (report).`
})
```

## Supervisor spawn template

Supervisor is a **resident** agent for CHECKPOINT tasks (spawn once; wake per checkpoint).

```text
Agent({
  subagent_type: "team-supervisor",  // or team-worker / general-purpose
  description: "Spawn resident supervisor",
  team_name: <team-name>,
  name: "supervisor",
  run_in_background: true,
  prompt: `## Role Assignment
role: supervisor
role_spec: <skill_root>/roles/supervisor/role.md
session: <session-folder>
session_id: <session-id>
team_name: <team-name>
requirement: <task-description>

Init: load baseline context, report ready, go idle.
Wake: coordinator sends Checkpoint Request (SendMessage or .msg).`
})
```

**Wake (per CHECKPOINT):**

```text
## Checkpoint Request
task_id: <CHECKPOINT-NNN>
scope: [<upstream-task-ids>]
pipeline_progress: <done>/<total> tasks completed
```

**Shutdown (pipeline complete):** send shutdown_request to supervisor (or mark idle in session on degraded hosts).

## User commands

| Command | Action |
| --- | --- |
| `check` / `status` | View execution status graph |
| `resume` / `continue` | Advance to next step |
| `revise <TASK-ID> [feedback]` | Revise specific task |
| `feedback <text>` | Inject feedback for revision |
| `recheck` | Re-run quality check |
| `improve [dimension]` | Auto-improve weakest dimension |

## Completion action

When pipeline completes, coordinator presents Archive & Clean / Keep Active / Export Results (same interaction pattern as coordinate).  
If nested under ralph DELIVER: list `spec/` / `plan/` / `artifacts/` paths for parent to **cite** — **do not** flip ralph gates.

## Specs & templates

| Asset | Purpose |
| --- | --- |
| [specs/pipelines.md](specs/pipelines.md) | Pipeline definitions and task registry |
| [specs/quality-gates.md](specs/quality-gates.md) | Quality gate criteria and scoring |
| [specs/knowledge-transfer.md](specs/knowledge-transfer.md) | Artifact / state transfer |
| [templates/](templates/) | product-brief, requirements, architecture, epics |

## Session directory

```text
.workflow/.team/TLV4-<slug>-<date>/
├── team-session.json
├── tasks.json                 # degraded hosts (optional on full)
├── spec/                      # Spec phase outputs
├── plan/                      # Implementation plan
├── artifacts/                 # Deliverables
├── wisdom/
├── explorations/
├── discussions/
└── .msg/                      # File message bus when maestro missing
```

**jj-flow product repo:** do not commit `.workflow/` (harness forbidden path).

### team-session.json (shape)

```json
{
  "session_id": "TLV4-<slug>-<date>",
  "task_description": "<original user input>",
  "status": "active | paused | completed",
  "team_name": "<team-name>",
  "skill_id": "jj-team-lifecycle",
  "host_mode": "full | codex-degraded | generic-degraded",
  "pipeline_mode": "spec-only | impl-only | full-lifecycle",
  "supervision": true,
  "why_lifecycle": "spec-document-chain | sdlc-gates | impl-from-spec",
  "time_estimate": "20-45min",
  "started_at": "<timestamp>",
  "roles": ["analyst", "writer", "planner", "executor", "tester", "reviewer", "supervisor"],
  "active_workers": [],
  "completed_tasks": [],
  "completion_action": "interactive",
  "created_at": "<timestamp>"
}
```

## Host compatibility

| Host | Expectation |
| --- | --- |
| Claude Code | Full path preferred (Team*/Task*/SendMessage + optional maestro) |
| **Codex** | **First-class degraded**: no Team/Task/maestro → `tasks.json` + `.msg/` + `general-purpose`; often **serial** workers; longer time in nested notice. Details: [references/host-codex.md](references/host-codex.md) |
| Grok / Qoder | Same degraded playbook as Codex unless Team/Task APIs exist |

Detect host once per session; store `host_mode` in `team-session.json`.

## Error handling

| Scenario | Resolution |
| --- | --- |
| Unknown command | Error with available command list |
| Role not found | Error with role registry |
| `team-worker` missing | Spawn `general-purpose` with same prompt |
| maestro missing | File bus + direct tools |
| Supervisor crash | Respawn with `recovery: true` from existing CHECKPOINT reports |
| Completion action fails | Default to Keep Active |

## Invocation

```text
Skill(skill="jj-team-lifecycle", args="task description")
# Claude: /jj-team-lifecycle <task>
# Codex/Grok/Qoder: $jj-team-lifecycle <task>
# Legacy speech: team-lifecycle-v4 / team lifecycle / full lifecycle team
```

Always load and follow [roles/coordinator/role.md](roles/coordinator/role.md).  
Transparency: [references/user-transparency.md](references/user-transparency.md).  
Codex / degraded: [references/host-codex.md](references/host-codex.md).
