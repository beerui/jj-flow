---
name: jj-team-coordinate
description: "Session multi-role execution engine for jj-flow (vendored team-coordinate). Analyze task → dynamic role-specs → dispatch workers → deliver under .workflow/.team/TC-*. MUST tell user why team / what now / time estimate before spawn. Codex-compatible degraded path. Does NOT advance ralph/dispatch checkpoints. Triggers: /jj-team-coordinate, $jj-team-coordinate, Team Coordinate, multi-role team pipeline."
---

# jj-team-coordinate

> **Layer:** execution engine (not a delivery control path)  
> **Upstream protocol:** Claude `team-coordinate` (dynamic role-specs + team-worker)  
> **Product id / install dir:** `jj-team-coordinate`  
> **Session prefix:** `TC` → `.workflow/.team/TC-<slug>-<date>/`  
> **Design:** [docs/design-docs/jj-team-coordinate.md](../../docs/design-docs/jj-team-coordinate.md)

Universal team coordination: analyze task → generate role-specs → dispatch → execute → deliver.  
Only the **coordinator** is built-in. Worker roles are **dynamically generated** as lightweight role-spec files and spawned via `team-worker` (or host fallback).

## User transparency (mandatory)

**Before spawning workers**, and on every meaningful progress wake, tell the user in chat:

1. **为什么用 team** — concrete reason for *this* task (not generic “better collaboration”)
2. **当前在做** — phase + human step (e.g. “Phase 3 建任务链 / 等待 implementer”)
3. **用时** — estimate range up front; elapsed + next step while running

Full protocol: [references/user-transparency.md](references/user-transparency.md).  
High cost (roles≥3, tasks≥5, or **degraded host**) → confirm before Phase 4.

```text
[team] 即将使用多角色 team 模式
[team] 为什么用：…
[team] 当前在做：…
[team] 预计用时：…（区间；Codex 降级可能更长）
[team] 宿主：… · 模式：full|degraded
```

If no catalog reason fits (`parallel-modules` / `multi-angle-analysis` / …) → **do not** start team.

## jj-flow hard boundaries

| MUST | MUST NOT |
| --- | --- |
| Write session state under `.workflow/.team/TC-*` (business repos) | Advance ralph `run.json` phase/gates by chat alone |
| Produce artifacts / wisdom for humans or parent skills to cite | Create `delivery_id` / durable dispatch `task_key` |
| Prefer this skill when multi-role parallelism helps DELIVER/analyze | Replace `jj-same` / `jj-ralph` / `jj-dispatch` |
| On missing maestro / TeamCreate: degrade to file bus + available subagents | Pretend team completion == ACCEPT PASS |
| Run user-transparency pre-flight + live status | Silent multi-agent work with no time/why notice |

**Identity separation:** `TC-*` ≠ `RALPH-*` ≠ `DEL-*`. See [jj-ralph integrations](../jj-ralph/references/integrations.md).

**When to use:** multi-module implementation, multi-angle analysis, dynamic role pipelines.  
**When not to:** tiny single-point edits (use ralph directly); multi-project schedule (use dispatch); pure review (prefer `jj-review`).

## Architecture

```
+---------------------------------------------------+
|  Skill(skill="jj-team-coordinate")                |
|  args="task description"                          |
+-------------------+-------------------------------+
                    |
         Orchestration Mode (auto -> coordinator)
                    |
              Coordinator (built-in)
              Phase 0-5 orchestration
                    |
    +-------+-------+-------+-------+
    v       v       v       v       v
 [team-worker agents, each loaded with a dynamic role-spec]
  (roles generated at runtime from task analysis)
  Fallback: general-purpose when team-worker unavailable

  Optional tools (any worker):
    maestro delegate --mode analysis  - analysis and exploration
    maestro delegate --mode write     - code generation and modification
    (if maestro missing: use Read/Grep/Glob/Edit/Bash directly)
```

## Shared constants

| Constant | Value |
| --- | --- |
| Session prefix | `TC` |
| Session path | `.workflow/.team/TC-<slug>-<date>/` |
| Worker agent | `team-worker` (see [agents/team-worker.md](agents/team-worker.md)); fallback `general-purpose` |
| Message bus | Prefer `mcp__maestro__team_msg(session_id=…)`; else `.msg/messages.jsonl` + `meta.json` |
| CLI analysis | `maestro delegate --mode analysis` (optional) |
| CLI write | `maestro delegate --mode write` (optional) |
| Max roles | 5 |

### skill_root resolution (multi-host)

Do **not** hardcode `.claude/skills/team-coordinate`. Resolve in order:

1. Directory that contains this `SKILL.md` (installed skill root)
2. Repo dev path: `skills/jj-team-coordinate/`
3. Host installs: `~/.claude|/.codex|/.grok|/.qoder/skills/jj-team-coordinate`
4. Legacy read-only fallback: `…/skills/team-coordinate` (not SSOT)

Worker agent definition ships with the skill: `agents/team-worker.md`. Hosts that load agents from a global agents dir may copy or symlink it; if unavailable, spawn with `general-purpose` and the same role-assignment prompt.

## Role router

This skill is **coordinator-only**. Workers do **not** invoke this skill — they are spawned as `team-worker` (or fallback) agents directly.

### Input parsing

Parse `$ARGUMENTS`. No `--role` needed — always routes to coordinator.

User commands (wake paused coordinator):

| Command | Action |
| --- | --- |
| `check` / `status` | Output execution status graph, no advancement |
| `resume` / `continue` | Check worker states, advance next step |
| `revise <TASK-ID> [feedback]` | Revise specific task with optional feedback |
| `feedback <text>` | Inject feedback into active pipeline |
| `improve [dimension]` | Auto-improve weakest quality dimension |

### Role registry

| Role | File | Type |
| --- | --- | --- |
| coordinator | [roles/coordinator/role.md](roles/coordinator/role.md) | built-in orchestrator |
| (dynamic) | `<session>/role-specs/<role-name>.md` | runtime-generated role-spec |

### Invocation

```text
Skill(skill="jj-team-coordinate", args="task description")
# Claude: /jj-team-coordinate <task>
# Codex/Grok/Qoder: $jj-team-coordinate <task>
# Legacy alias in speech: "Team Coordinate …" → this skill
```

### Lifecycle

```text
User provides task description
  -> Phase 0: resume check (active/paused TC-* sessions)
  -> Detect host mode (full vs degraded; see host-codex.md)
  -> Phase 1: task analysis (capabilities, dependency graph)
  -> USER TRANSPARENCY: why / what-now / time estimate (+ confirm if needed)
  -> Phase 2: generate role-specs + initialize session
  -> Phase 3: create task chain (Task* API or tasks.json on Codex)
  -> Phase 4: spawn first batch (or serial on Codex) -> status to user -> STOP
  -> Worker executes -> callback / resume -> live [team] progress
  -> Loop until pipeline complete -> Phase 5 report (elapsed vs estimate) + completion action
```

Always load and follow [roles/coordinator/role.md](roles/coordinator/role.md).  
Transparency: [references/user-transparency.md](references/user-transparency.md).  
Codex / degraded: [references/host-codex.md](references/host-codex.md).

---

## Coordinator spawn template

### Worker spawn (all roles)

Prefer `team-worker`; if the host has no such agent type, use `general-purpose` with the same prompt.

```
Agent({
  subagent_type: "team-worker",  // or "general-purpose"
  description: "Spawn <role> worker",
  team_name: <team-name>,
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: <session-folder>/role-specs/<role>.md
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
Execute built-in Phase 1 (task discovery) -> role-spec Phase 2-4 -> built-in Phase 5 (report).`
})
```

**Inner loop roles** (2+ serial same-prefix tasks): `inner_loop: true`.  
**Single-task roles:** `inner_loop: false`.

---

## Completion action

When the pipeline completes, present:

```
AskUserQuestion({
  questions: [{
    question: "Team pipeline complete. What would you like to do?",
    header: "Completion",
    multiSelect: false,
    options: [
      { label: "Archive & Clean (Recommended)", description: "Archive session, clean up team" },
      { label: "Keep Active", description: "Keep session for follow-up work" },
      { label: "Export Results", description: "Export deliverables to target directory, then clean" }
    ]
  }]
})
```

| Choice | Steps |
| --- | --- |
| Archive & Clean | `status=completed` → TeamDelete (if available) → summary + artifact paths |
| Keep Active | `status=paused` → "Resume with: Skill(skill='jj-team-coordinate', args='resume')" |
| Export Results | Ask target path → copy artifacts → Archive & Clean |

If this session was nested under a ralph DELIVER, list artifact paths for the parent skill to cite as evidence — **do not** flip ralph gates here.

---

## Specs reference

| Spec | Purpose |
| --- | --- |
| [specs/pipelines.md](specs/pipelines.md) | Dynamic pipeline model, task naming, dependency graph |
| [specs/role-spec-template.md](specs/role-spec-template.md) | Template for dynamic role-spec generation |
| [specs/quality-gates.md](specs/quality-gates.md) | Quality thresholds and scoring dimensions |
| [specs/knowledge-transfer.md](specs/knowledge-transfer.md) | Context transfer protocols between roles |

---

## Session directory

```text
.workflow/.team/TC-<slug>-<date>/
├── team-session.json
├── task-analysis.json
├── role-specs/
│   └── <role>.md
├── artifacts/
├── .msg/
│   ├── messages.jsonl
│   └── meta.json
├── wisdom/
│   ├── learnings.md
│   ├── decisions.md
│   └── issues.md
├── explorations/
└── discussions/
```

### team-session.json (shape)

```json
{
  "session_id": "TC-<slug>-<date>",
  "task_description": "<original user input>",
  "status": "active | paused | completed",
  "team_name": "<team-name>",
  "skill_id": "jj-team-coordinate",
  "host_mode": "full | codex-degraded | generic-degraded",
  "why_team": "parallel-modules | multi-angle-analysis | …",
  "time_estimate": "10-30min",
  "started_at": "<timestamp>",
  "roles": [
    {
      "name": "<role-name>",
      "prefix": "<PREFIX>",
      "responsibility_type": "<type>",
      "inner_loop": false,
      "role_spec": "role-specs/<role-name>.md"
    }
  ],
  "pipeline": {
    "dependency_graph": {},
    "tasks_total": 0,
    "tasks_completed": 0
  },
  "active_workers": [],
  "completed_tasks": [],
  "completion_action": "interactive",
  "created_at": "<timestamp>"
}
```

**jj-flow product repo:** do not commit `.workflow/` (harness forbidden path). Use a business repo or `docs/…/sessions/` for demos.

---

## Session resume

1. Scan `.workflow/.team/TC-*/team-session.json` for active/paused
2. Multiple → AskUserQuestion
3. Reconcile TaskList ↔ session (or file-only status if no Task API)
4. Reset stuck `in_progress` → `pending`
5. Rebuild team / spawn only needed workers
6. Kick first executable task → Phase 4 loop

---

## Error handling

| Scenario | Resolution |
| --- | --- |
| `team-worker` missing | Spawn `general-purpose` with same prompt; log warning |
| maestro MCP / CLI missing | File message bus; direct tools; do not abort pipeline |
| Dynamic role-spec not found | Error; coordinator may regenerate |
| Command file not found | Fallback to inline coordinator role steps |
| Explore cache corrupt | Clear cache, re-explore |
| capability_gap | handleAdapt: new role-spec + tasks + spawn |
| Completion action fails | Default Keep Active |

---

## Host compatibility

| Host | Expectation |
| --- | --- |
| Claude Code | Full path preferred (Team*/Task*/SendMessage + optional maestro) |
| **Codex** | **First-class degraded**: no Team/Task/maestro → `tasks.json` + `.msg/` + `general-purpose` (or host default); often **serial** workers; pre-flight must say `模式：degraded` and longer time. Details: [references/host-codex.md](references/host-codex.md) |
| Grok / Qoder | Same degraded playbook as Codex unless Team/Task APIs exist |

Detect host once per session; store `host_mode` in `team-session.json` (`full` | `codex-degraded` | `generic-degraded`).

See design doc §5. Search/ACO swarm lives in sibling skill **`jj-team-swarm`** (not this skill).
