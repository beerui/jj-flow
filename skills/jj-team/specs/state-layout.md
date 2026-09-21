# Team state layout

> State root: `<main checkout>/.workflow/.team/TEAM-<project_key>-<YYYYMMDD>/`. A repo that declares `.workflow/` a forbidden path lands in `~/.jj-flow/team/TEAM-<project_key>-<YYYYMMDD>/` instead, and says so out loud.

## Where the team lives

The root is resolved once, in Step 0, and it is the **main checkout** — never the checkout the session happens to be sitting in.

| Candidate | Verdict |
| --- | --- |
| `<main checkout>/.workflow/.team/` | **Chosen.** Same root as the three sibling engines (`TC-*`, `TLV4-*`, `TAS-*`), so one convention covers all four. It also changes the failure mode of a wrong key: the Phase 0 glob finds nothing, so the team is provisioned fresh — instead of silently landing in a legitimate-looking home directory that belongs to another project. |
| `<current checkout>/.workflow/.team/` | **No.** The decisive reason is worktrees: a linked worktree's `.workflow/` is a *different directory* from the main checkout's. A team spanning a branch switch, a `jj-end` merge, or a dispatch worktree would fork its ledger, and the Phase 0 glob would find zero-or-two teams depending on cwd. Moving into the repo without this rule would move the bug back in. |
| `~/.jj-flow/team/` | **Fallback only**, for repos that declare `.workflow/` in `harness-manifest.json` → `record_system.forbidden_paths`. Such a repo cannot use the project-internal root: `scripts/check-harness.mjs` (`HNS-STATE-001`) fails `harness:check` as soon as the path exists. This product repo is one of them, so it is the one that falls back. The fallback is executed by the repo's own gate, not by a hand-written exception. |
| `<repo>/.plans/` | **No.** Not a jj-flow convention. `ralph-plans-workspace.md` explicitly ruled out the role/team layer of `.plans` for the task loop. |

### The main checkout, not the current one

```text
common = git rev-parse --git-common-dir
main   = path.resolve(cwd, common, '..')
fallback (not a git repo, or jj is not on a git backend): git rev-parse --show-toplevel
```

Two commands that already exist — **no new CLI**.

**Use `resolve` on the common dir, never `dirname`.** From the main checkout the command prints the *relative* `.git`, so `dirname` yields `.` — which resolves back to the main checkout here by luck, and points somewhere else under a different shell, a different `--git-dir` spelling, or a path containing `..`. `resolve` is correct for both the relative and the absolute output, at no cost. The command line above is the rule; this paragraph is only the reason, and it deliberately does not repeat it — a restatement here is what used to feed a file-level assertion while the line above was wrong.

This is one rule, not a second directory: every team of a project has exactly one root, whichever checkout it was invoked from.

`<project_key>` is the project's key. The **authoritative** value is the `project_key` field inside `team-session.json` — it is written to disk, so a directory spelled two ways still finds its own history. When a key has to be *computed*, the product has exactly one implementation: `resolveProjectKeyFromCwd(cwd)` in `src/projectMap.mjs`. It is also what names `~/.jj-flow/memory/<project_key>.md`, and that is the hard reason to stay consistent with it. It is **not** "the team calls it too": no code on the jj-team path calls it, so nothing here may claim it does.

**`$JJ_FLOW_HOME` moves only the fallback root.** It no longer relocates the whole team state — a repo that may use its own `.workflow/.team/` ignores the env var entirely. Say that plainly wherever the variable is mentioned, or a reader keeps believing it can move a project-internal ledger.

## Tree

```text
<main checkout>/.workflow/.team/
├── TEAM-<project_key>-<YYYYMMDD>/   -- one live team
│   ├── team-session.json       -- live binding + roster + parallelism (READ FIRST)
│   ├── task_plan.md            -- navigation map (team-lead owns)
│   ├── findings.md             -- team-level findings, tagged
│   ├── progress.md             -- chronological work log
│   ├── decisions.md            -- decision record
│   ├── team-snapshot.md        -- full onboarding prompts, verbatim
│   └── <agent-name>/
│       ├── task_plan.md        -- that agent's task list
│       ├── findings.md         -- pure index → links to task folders
│       ├── progress.md         -- that agent's work log
│       └── <prefix>-<task>/    -- per-task folder
│           ├── task_plan.md
│           ├── findings.md     -- the core deliverable
│           └── progress.md
└── archive/
    └── <team_id>/          -- a superseded or closed team, moved whole
```

A repo that declares `.workflow/` forbidden uses the same tree one level down under its fallback root (`~/.jj-flow/team/TEAM-<project_key>-<YYYYMMDD>/`), with `archive/` beside it.

**Written at provision:** `team-session.json`, `task_plan.md`, `progress.md`, `team-snapshot.md`. `findings.md` and `decisions.md` are created on first write; `<agent-name>/` is created per spawned teammate, so a 0-lane team (team-lead + reviewer) has one agent directory, not a roster of empty ones.

A genuinely concurrent second live team for the same project appends `-<n>` to the directory name (`TEAM-<project_key>-<YYYYMMDD>-2`). It is still findable because `project_key` inside the file — not the directory name — is the key.

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
| `capabilities` | new, **replaces the sibling's `host_mode`** | `{teammates, task_board}` — two independent booleans, not one mode. `teammates` is whether the host can spawn teammates that persist across turns; `task_board` is whether it has a shared task list (`TaskList`). A host can have one without the other, and that is precisely what one enum cannot say: this repo's host has `teammates: true` + `task_board: false`, so neither `full` (which requires the Team/Task APIs) nor `generic-degraded` (which describes a host running the roster serially) is true of it. **A fourth enum value was the rejected fix** — it would only move the shortage to the next host. |
| `host` | new | `{host_id, session_id, session_id_source, bound_at, previous_session_ids[]}`. |
| `parallelism` | new | `{measured, measured_at, lanes[{lane_id, description, unblocked, owner, files[]}], excluded{substantively_complete, optional_only, blocked_on_decision, blocked_on_live_host, owner_is_team_lead}}`. `lanes[]` is the evidence `measured` is read off — one element per lane, `unblocked` a boolean, `owner` the lane's owner or `null`, `files[]` the collision group that decides whether two lanes can run at once. `measured` is the number of `unblocked` lanes, and it must equal that count: a number without the lanes behind it is not a measurement. `excluded` counts by reason. Drives the roster and proves the number was actually taken. |
| `roles` | reused container | The sibling's entries are `name/prefix/responsibility_type/inner_loop/role_spec`; this skill uses only `name` / `role` / `model` / `lane`. Container name kept, fields trimmed. |
| `tasks` | new (≙ sibling `pipeline`) | `[{task_id, description, status, created_at, closed_at}]`. `status` is `in_progress \| landed \| done`: `landed` means the change is committed, `done` means finished with nothing to commit (a review, a measurement, a decision). `closed_at` is required for `landed` and `done` — the sibling's `pipeline` is a dependency DAG, this is a ledger. **Do not treat them as the same thing.** |
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
  project_key                   = authoritative: the field in team-session.json;
                                  to compute one there is exactly one implementation,
                                  resolveProjectKeyFromCwd(cwd) (src/projectMap.mjs)
  team root                     = main checkout's .workflow/.team/ (rule above);
                                  a repo declaring .workflow/ forbidden falls back to
                                  $JJ_FLOW_HOME || ~/.jj-flow, then team/

Step 1 — read <team root>/TEAM-<project_key>-*/team-session.json
         (home = $JJ_FLOW_HOME || ~/.jj-flow, only on the fallback path)

R1  live (active|paused) AND host.session_id == mine
      -> RESUME silently. No prompt, no re-provision. This is the point of the whole file.
R2  live AND session_id_source == "unknown" AND host.session_id is null
    AND it is the only live unbound team for this project_key
      -> RESUME silently; print one line: 绑定降级（本宿主读不到会话 id）
R3  live AND the team's host.session_id is known AND it is not mine
      -> AskUserQuestion, never silent:
         [ adopt — rebind host.session_id, push the old id into previous_session_ids ]
         [ start alongside — directory TEAM-<project_key>-<YYYYMMDD>-2, both stay live ]
         [ close (archive) then provision fresh ]
    The condition is deliberately not "both ids known". When my own id is
    unreadable it is null, which is certainly not the team's, so R3 fires and
    asks. The old narrower wording left exactly that case matching no rule at
    all — a silent second provisioning.
R4  status is completed|abandoned
      -> move the whole file set into <team root>/archive/<team_id>/ , then provision
R5  more than one live team under this project_key
      -> AskUserQuestion
R6  nothing found -> provision
    The table is total. A state that no rule above matched is NOT a licence to
    provision: print the state that matched and ask. A fall-through used to mean
    "provision a second team", which is the one outcome this entry exists to
    prevent, so it must never be the quiet branch.
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

Staleness is **two conditions**, and only the first is always decidable. Defining one without the other is what left a promise here that no host could keep.

**Condition 1 — the clock.** `now - last_seen_at > 14d`. `last_seen_at` is bumped on every Phase 0 touch and nowhere else, so it records when this skill was last *invoked*, not when anyone last *worked*. That is deliberate and it has a cost, stated rather than hidden: a team whose teammates keep working for three weeks without a re-invocation reads as stale on this clock. The clock is the signal to **ask**, which is why condition 2 exists at all — a working team must not be closed for not being re-invoked.

**Condition 2 — no live teammates.** Decidable only where the host can address a teammate by the name recorded in `roles[]`.

- A host with `teammates: false` has no teammates, so the condition holds **by definition** — not by measurement. This is the one case where the rule is safe without any probe.
- A host that has teammates but cannot address them by name — this one: `Agent` + `SendMessage` exist and teammates persist across turns, but `ListAgents` returns agent ids only, so no name in `roles[]` can be matched to a live process — makes the condition **undecidable**. It must not be guessed either way.

When condition 2 is undecidable, Phase 0 **degrades to report only**: print the staleness line, say in the same breath that liveness could not be determined on this host, and offer nothing. An unverifiable condition must not produce a `close` offer — that would be the same shape of lie as a fabricated session id, one layer down.

**No team is ever auto-closed.** The only automatic signal available without a hook is wall clock, and wall clock is exactly the signal that would destroy the only record of a half-finished task. `pause` and `close` are always explicit acts; `close` writes `close_reason` and moves the file set into `<team root>/archive/<team_id>/`.

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
| `3` | usage — the command itself is wrong; nothing was checked |

Exit `2` is a separate code on purpose: "cannot tell" is not "changed", and folding the two together would make a missing stamp read as a pass. A file that appeared since the snapshot counts as stale even though no mtime moved — a pure mtime comparison cannot see it. Exit `3` is separate from `2` for the same kind of reason: a mistyped command is not a snapshot this script failed to read, and `2` sends the reader off to regenerate a stamp they already have.

Run it at Phase 0, on `check`, and on `resume` — anywhere the snapshot would otherwise be trusted by eye.

**Regenerate when** anything under the skill changed after the snapshot. The check tells you that with an exit code and the name of each offending file; the fix is a new stamp from `--stamp`, then tell the user whether the cached prompts or the current sources won.

## Archiving

Completed task folders stay where they are and are marked `Status: complete` in the index. Do not rename, move, or prefix them — the index is the navigation layer, and moving a folder breaks every cross-reference into it.

A **closed team** is a different thing: the whole file set moves into `<team root>/archive/<team_id>/`, because a new team will take the root paths. Snapshot supersession goes to `archive/` too.

## Recovery

After a context compaction, in order:

1. `team-session.json` — the binding, the roster, the measured lanes
2. `team-snapshot.md` — roster and prompts, verbatim
3. `task_plan.md` — the goal and the current phase
4. `findings.md` — what has been learned
5. `progress.md` — where things stopped

Then reconcile: re-read each agent's index rather than trusting remembered state. **Do not re-derive the roster from the transcript** — the transcript is what got compacted. Between sessions another agent may have changed a file; `progress.md` records where things *were*, not what the files *are*.
