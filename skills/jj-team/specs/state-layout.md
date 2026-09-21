# Team state layout

> State root: `~/.jj-flow/team/<project_key>/`, or `$JJ_FLOW_HOME/team/<project_key>/` when that env var is set.

## Why the home directory, not the repo

| Candidate | Verdict |
| --- | --- |
| `~/.jj-flow/team/` | **Chosen.** Keyed by *project*, not by checkout — see the worktree argument below. `~/.jj-flow/` is the documented cross-project state home; its `README.md` already routes `.workflow/dispatch/` and `.workflow/tasks/` the same way. |
| `<repo>/.workflow/` | **No.** The decisive reason is worktrees: `<repo>/.workflow/` inside a worktree is a *different directory* from the one in the main checkout. A team spanning a branch switch, a `jj-end` merge, or a dispatch worktree would fork its ledger, and the Phase 0 glob would find zero-or-two teams depending on cwd. Also forbidden in the product repo — `harness-manifest.json` lists `.workflow` under `forbidden_paths`. |
| `<repo>/.plans/` | **No.** Not a jj-flow convention. `ralph-plans-workspace.md` explicitly ruled out the role/team layer of `.plans` for the task loop. Repo-local state also cannot express a team that spans a project family. |

`<project_key>` is the project's key: the lowercased basename of the project path (`projectKeyFromPath` in `src/projectMap.mjs`), which is also what `~/.jj-flow/memory/<project_key>.md` is named after. Derive it from the map row's `path`, not its Chinese display name.

The **authoritative** `project_key` lives inside `team-session.json`. The directory name is a convenience — if a directory ever gets spelled two ways, the file inside it still says which project it belongs to.

Resolution lives in `src/homeLayout.mjs` (`defaultJjFlowHome()`), which honours `$JJ_FLOW_HOME`.

## Tree

```text
~/.jj-flow/team/<project_key>/
├── team-session.json       -- live binding + roster + parallelism (READ FIRST)
├── task_plan.md            -- navigation map (team-lead owns)
├── findings.md             -- team-level findings, tagged
├── progress.md             -- chronological work log
├── decisions.md            -- decision record
├── team-snapshot.md        -- full onboarding prompts, verbatim
├── archive/
│   └── <team_id>/          -- a superseded or closed team, moved whole
└── <agent-name>/
    ├── task_plan.md        -- that agent's task list
    ├── findings.md         -- pure index → links to task folders
    ├── progress.md         -- that agent's work log
    └── <prefix>-<task>/    -- per-task folder
        ├── task_plan.md
        ├── findings.md     -- the core deliverable
        └── progress.md
```

**Written at provision:** `team-session.json`, `task_plan.md`, `progress.md`, `team-snapshot.md`. `findings.md` and `decisions.md` are created on first write; `<agent-name>/` is created per spawned teammate, so a 0-lane team (team-lead + reviewer) has one agent directory, not a roster of empty ones.

A genuinely concurrent second live team for the same project uses `<project_key>-<n>/`. It is still findable because `project_key` inside the file — not the directory name — is the key.

## File semantics

| File | Nature | Rule |
| --- | --- | --- |
| `team-session.json` | **Live binding** | The join key, the roster and the measured lane count. Read first on every Phase 0. See the field table below. |
| `task_plan.md` | Navigation map | Says *where to look* and *what is next*. Never becomes an encyclopedia — architecture and specifications belong in the referenced sources. |
| `findings.md` (root) | **Pure index** | One entry per task folder: status, report link, one-line summary. If it grows hard to scan, content is leaking — split it out. |
| `findings.md` (task) | **Core deliverable** | Grows with the work. Append, never rewrite in place. |
| `progress.md` | Chronological log | Who did what, when. Archive old sections into `archive/` rather than letting it grow unbounded. Also the landing place for a one-line note when a turn turned out not to be team work. |
| `decisions.md` | Decision record | What was decided, why, and what else was considered. |
| `team-snapshot.md` | Recovery artifact | Full, un-abridged onboarding prompts — **never summarized or truncated**. This file exists so recovery does not have to re-derive them. |

## team-session.json

Reuses the sibling shape at `skills/jj-team-coordinate/SKILL.md:241-273` where it can; deviations are marked.

| Field | Provenance | Notes |
| --- | --- | --- |
| `schema_version` | new | `jj-flow/team-session/1.0`. The sibling has none; this file is read across sessions, so it needs one. |
| `team_id` | new (≙ sibling `session_id`) | `TEAM-<project_key>-<YYYYMMDD>`, suffixed `-<n>` if taken. **Deliberately not named `session_id`** — this identity outlives any session, and the name would collide with `host.session_id`. |
| `project_key` | new, **authoritative** | Not derived from the directory name. |
| `project_path` | new | The path the key was derived from. |
| `task_description` | reused | The invoking request; `(none — provisioned as ledger)` for a bare provision. |
| `status` | reused + 1 | `active \| paused \| completed \| abandoned`. |
| `skill_id` | reused | `"jj-team"`. |
| `host_mode` | reused | `full \| codex-degraded \| generic-degraded` — same enum, same paths as the sibling. |
| `host` | new | `{host_id, session_id, session_id_source, bound_at, previous_session_ids[]}`. |
| `parallelism` | new | `{measured, measured_at, lanes[], excluded{substantively_complete, blocked_on_decision, blocked_on_live_host, owner_is_team_lead}}`. Drives the roster and proves the number was actually taken. |
| `roles` | reused container | The sibling's entries are `name/prefix/responsibility_type/inner_loop/role_spec`; this skill uses only `name` / `role` / `model` / `lane`. Container name kept, fields trimmed. |
| `tasks` | new (≙ sibling `pipeline`) | `[{task_id, description, status, created_at, closed_at}]`. The sibling's `pipeline` is a dependency DAG; this is a ledger. **Do not treat them as the same thing.** |
| `why_team` | reused + 1 | The sibling enum (`parallel-modules \| multi-angle-analysis \| role-isolation \| capability-split \| resume-team`, per `skills/jj-team-coordinate/roles/coordinator/role.md:186`) plus `persistent-ledger`, which is for a team provisioned as a ledger rather than for concurrency — that is, whenever no implementer was spawned (`implementers == 0`). A team at 1 lane whose lane is genuinely assignable is `parallel-modules`, not `persistent-ledger`. |
| `completion_action` | reused | `"interactive"`. |
| `created_at` / `updated_at` / `last_seen_at` | reused + new | `last_seen_at` is what makes staleness detectable at all. |
| `close_reason` | new | `user-closed \| superseded \| stale`; written only on close. |
| `review_rubric` | new | `["RD-1","RD-2","RD-3","RD-4"]` — pins the dimensions so a recovering reviewer reads the right ones. |

**Why a fourth `status`.** Reusing the sibling's three values literally would mean recording an abandoned team as `completed` — a claim every downstream consumer (archive decisions, stale notices, `close_reason` conditionals) would then have to be taught to see through. One added value with a written rationale is cheaper and more honest than that conditional in every reader.

## Session binding

The join key is `host.session_id`. Phase 0 resolution, first match wins:

```text
Step 0 — identity
  host_id, host_mode            = detect (once per session)
  session_id, session_id_source = per the host table below
  project_key                   = lowercased basename of the git root walked up from cwd;
                                  if ~/.jj-flow/map.md has a row whose `path` prefixes cwd,
                                  prefer that row's path

Step 1 — read <home>/team/<project_key>/team-session.json   (home = $JJ_FLOW_HOME || ~/.jj-flow)

R1  live (active|paused) AND host.session_id == mine
      -> RESUME silently. No prompt, no re-provision. This is the point of the whole file.
R2  live AND session_id_source == "unknown" AND host.session_id is null
    AND it is the only live unbound team for this project_key
      -> RESUME silently; print one line: 绑定降级（本宿主读不到会话 id）
R3  live AND both ids known AND host.session_id != mine
      -> AskUserQuestion, never silent:
         [ adopt — rebind host.session_id, push the old id into previous_session_ids ]
         [ start alongside — directory <project_key>-2, both stay live ]
         [ close (archive) then provision fresh ]
R4  status is completed|abandoned
      -> move the whole file set into <project_key>/archive/<team_id>/ , then provision
R5  more than one live team under this project_key
      -> AskUserQuestion
R6  nothing found -> provision
Step 3 — always bump last_seen_at / updated_at
```

**Reading the session id, per host.** This table has exactly one copy — it is the SSOT; `SKILL.md` points here rather than restating it.

| Host | Source | `session_id_source` |
| --- | --- | --- |
| Claude Code | `CLAUDE_SESSION_ID` → `CLAUDE_CODE_SESSION_ID` → `CLAUDE_CONVERSATION_ID` (the ladder `src/claudeHostAdapter.mjs:20-30` already reads — **in that order**) | `env` |
| Claude Code fallback | newest `*.jsonl` by mtime under `~/.claude/projects/<slug>/` | `transcript` (racy with two sessions in one cwd) |
| Codex / Grok / Qoder / generic | usually no local session index | `unknown` |

**When the session id cannot be read, write `null`.** Never fabricate a handle: a guessed id makes the ledger lie in a way that stays invisible until it misroutes. R2 is what carries the binding instead, and `session_id_source: "unknown"` is written down so the degraded state is visible rather than silent.

**Re-invocation is `resume, do not init`** — the same guard as `findRalphInitConflict` (`src/ralph/state.mjs:718-743`). A second invocation appends to `tasks[]` and re-measures; it never provisions a duplicate team.

**Concurrent degraded sessions are not serialized.** Two sessions in one project on a host that cannot read a session id are *indistinguishable* — both have `session_id: null` and `session_id_source: "unknown"`, so both match R2 and both resume the same team. R2's single-unbound condition does **not** force the second one to adopt or to start `<project_key>-2`; nothing in the file can tell the two apart, so there is no mechanism to appeal to. This is a stated limitation, not a handled case. What it costs: two sessions writing one ledger can interleave `progress.md`. What it does not cost: silent data loss — `team-session.json` is small and rewritten whole, and `progress.md` is append-only. A host that *can* read a session id never reaches R2 and is unaffected.

## Staleness and closing

`last_seen_at` is bumped on every Phase 0 touch. When a live team has `now - last_seen_at > 14d` and no live teammates, Phase 0 prints **one line** and offers `close`. It does not close it.

**No team is ever auto-closed.** The only automatic signal available without a hook is wall clock, and wall clock is exactly the signal that would destroy the only record of a half-finished task. `pause` and `close` are always explicit acts; `close` writes `close_reason` and moves the file set into `archive/<team_id>/`.

## team-snapshot.md

Written once every teammate is spawned. Contains:

- Generation time, project, language
- A staleness stamp: the modification time of each file of the **loaded skill** (`SKILL.md`, plus everything under `references/`, `specs/` and `scripts/`) at snapshot time. Record the host path the skill was actually loaded from, not a repo-relative guess — a business-repo team has no `skills/jj-team/` in its own tree.
- The roster (name, role, model) and the measured lane count
- Every onboarding prompt, complete

### The staleness stamp, exactly

One fenced block, fence label `stamp`. Nothing else in the file may use that label.

````text
```stamp
staleness-stamp v1
skill_root: /absolute/path/the/skill/was/loaded/from
generated_at: 2026-09-20T04:00:00.000Z
SKILL.md	2026-09-20T03:12:44.123Z
references/roles.md	2026-09-19T22:01:07.000Z
specs/state-layout.md	2026-09-20T03:12:44.123Z
```
````

The header line is the format version; `skill_root` and `generated_at` are `key: value`; every remaining line is a relative path, a tab, and that file's mtime in ISO-8601. **Never hand-write an mtime** — emit the block with `node scripts/snapshot_stale.mjs --stamp` (run from the loaded skill copy, so the recorded `skill_root` is the host path) and paste it in. A guessed mtime is a ledger lie that stays invisible until it misroutes.

**Checking it is mechanical, not editorial.** `node scripts/snapshot_stale.mjs --team-dir <team dir>` re-reads every stamped path and exits:

| Exit | Meaning |
| --- | --- |
| `0` | fresh — every stamped file unchanged, and no source file unaccounted for |
| `1` | stale — a file is newer than its stamp, or a file appeared / disappeared since |
| `2` | unverifiable — no snapshot, no parseable stamp, or the stamped `skill_root` is gone |

Exit `2` is a separate code on purpose: "cannot tell" is not "changed", and folding the two together would make a missing stamp read as a pass. A file that appeared since the snapshot counts as stale even though no mtime moved — a pure mtime comparison cannot see it.

Run it at Phase 0, on `check`, and on `resume` — anywhere the snapshot would otherwise be trusted by eye.

**Regenerate when** anything under the skill changed after the snapshot. The check tells you that with an exit code and the name of each offending file; the fix is a new stamp from `--stamp`, then tell the user whether the cached prompts or the current sources won.

## Archiving

Completed task folders stay where they are and are marked `Status: complete` in the index. Do not rename, move, or prefix them — the index is the navigation layer, and moving a folder breaks every cross-reference into it.

A **closed team** is a different thing: the whole file set moves into `archive/<team_id>/`, because a new team will take the root paths. Snapshot supersession goes to `archive/` too.

## Recovery

After a context compaction, in order:

1. `team-session.json` — the binding, the roster, the measured lanes
2. `team-snapshot.md` — roster and prompts, verbatim
3. `task_plan.md` — the goal and the current phase
4. `findings.md` — what has been learned
5. `progress.md` — where things stopped

Then reconcile: re-read each agent's index rather than trusting remembered state. **Do not re-derive the roster from the transcript** — the transcript is what got compacted. Between sessions another agent may have changed a file; `progress.md` records where things *were*, not what the files *are*.
