---
name: jj-team
description: "Team-mode entry for jj-flow. Provisions a persistent CCteam-style team (roster + planning files + generic review rubric) whose state lives in the main checkout's .workflow/.team/TEAM-<project_key>-<YYYYMMDD>/, sized by a real parallelism measurement; afterwards a plain user turn is a team task with no prefix. Routes to a sibling engine (coordinate / lifecycle / swarm) when the request is a single round. Does NOT advance ralph/dispatch checkpoints. Triggers: /jj-team, $jj-team, Team Mode, 团队模式, 起团队."
---

# jj-team

> **Layer:** execution engine (not a delivery control path)
> **Upstream protocol:** Claude `CCteam-creator` (persistent teammates + planning-with-files)
> **Product id / install dir:** `jj-team`
> **State root:** `<main checkout>/.workflow/.team/TEAM-<project_key>-<YYYYMMDD>/` (`$JJ_FLOW_HOME` moves only the fallback root; resolved by `src/homeLayout.mjs`)
> **Design:** [docs/design-docs/jj-team.md](../../docs/design-docs/jj-team.md)

Team-mode entry. Two jobs: **measure how much work can actually run in parallel**, then **provision the team sized by that number**.

Invoking `/jj-team` always provisions. The measurement sizes the roster — it does not decide whether a team exists.

This skill is the **umbrella**. The three sibling engines stay independent and are not modified by it.

## jj-flow hard boundaries

| MUST | MUST NOT |
| --- | --- |
| Measure parallelism **before** choosing a team size | Pick a roster from a role catalog first, then look for work |
| Keep all team state under `<main checkout>/.workflow/.team/TEAM-<project_key>-<YYYYMMDD>/` | Write team state into the repo outside `.workflow/.team/`, into `.plans/`, or into a linked worktree's own `.workflow/` (that forks the ledger) |
| Keep the operating manual in this skill's `references/` | Create a repo-root `CLAUDE.md` (AGENTS.md is the product SSOT) |
| Stay behind `/jj-team` — load only when invoked | Inject anything into `jj-ralph` / `jj-same` / `jj-review` entries |
| Score review on the generic rubric in [references/review-dimensions.md](references/review-dimensions.md) | Invent repo-specific review dimensions |
| Keep reviewer read-only on source | Let reviewer edit project source |
| Resume an existing live team instead of provisioning a second one | Auto-close a team on a timer, or fabricate a session id you could not read |
| Check `team-snapshot.md` staleness with `scripts/snapshot_stale.mjs` (exit `0`/`1`/`2`/`3`) | Trust a snapshot stamp by eye, or hand-write an mtime into it |
| Resolve the session binding yourself | Ask the user to paste a session id |

**Identity separation:** `TEAM-*` ≠ `TC-*` ≠ `TLV4-*` ≠ `TAS-*` ≠ `RALPH-*` ≠ `DEL-*`.

**Boundary against exclusive assignment:** `jj-ralph` / `jj-same` / `jj-review` dispatch named `agents/` subagents that read only an ASSIGNMENT file. `/jj-team` is a **separate execution line** — never run both on the same task. A team run never advances a ralph/dispatch checkpoint either way.

## Parallelism measurement (sizes the roster — it does not veto)

Upstream CCteam asks "which roles do you want?" This skill asks **"how many lanes of work are genuinely unblocked?"** first. Role count follows the measurement, never the reverse.

Measure in this order:

1. **In-flight work** — what is actually unfinished right now? Read the live trackers, never the plan titles: a business repo keeps live runs at `.workflow/ralph/task-*` (see `skills/jj-ralph/references/artifact-layout.md`) plus any open task folders; this product repo uses `docs/exec-plans/active/`.
2. **Substantively-complete** — items marked active but whose remaining tasks are all done. These are **archive work, not development work**. Count them as 0.
   **Optional-only** is a separate exclusion with a separate reason to report: items whose only remaining work is an optional item that was **deliberately not done** — judged, and found not worth doing. Count it as 0 too, but record it under its own key. The two must not be folded together: "finished, only archiving left" and "deliberately skipped" are different things to tell the user, and `optional_only` is the only place the second survives. They are **not fully orthogonal** — an item can be both optional and gated on a live host, and then it counts in both — which is a reason to write the definitions down, not a reason to merge the buckets.
3. **Blocked-on-decision** — items waiting on a product decision. Count as 0 until the decision lands.
4. **Blocked-on-live-host** — items needing a real Grok/Codex session or manual acceptance. These are **human-serial**, not agent-parallel. Count as 0 for team sizing.
5. **Owner-is-team-lead** — in-flight work the team-lead owns itself. It is not assignable to an implementer, so counting it would size a roster with someone idle on it — the exact failure the anti-drift clause below exists to catch. Count it as 0 and name it in the report.
6. **File-set collisions** — items that touch the same file cannot run in parallel. Group by file set; each group is 1 lane.

`parallelism = number of lanes with genuinely unblocked work`

**A lane owned by team-lead is not an assignable lane.** The count exists to size implementers, so a lane nobody can be dispatched to is excluded from it exactly like a blocked one. `implementers = measured lanes` then holds without an exception: the team-lead's own in-flight change costs zero implementers, not one idle seat.

The number picks the roster. **It never decides whether a team exists.**

| Measured | Roster |
| --- | --- |
| 0 | **Still provision.** Roster is team-lead + `reviewer`, `implementers = 0` — **never spawn an idle implementer**. Report the number and every blocker by name. |
| 1 | **Still provision.** Roster is team-lead + 1 `implementer` + `reviewer`. |
| 2–3 | N implementers + `reviewer`, plus `researcher` if the work needs one. |
| 4+ | Scale implementers to the lane count. Re-measure at each phase boundary. |

**One sizing formula, no exceptions:** `implementers = measured lanes`. `researcher` and `reviewer` are added because the work needs them, **not** derived from the lane count.

**Do not let this become decorative.** Two rules keep it honest: the number must still determine the roster size, and the roster must never contain an implementer with nothing to do. If either slips, the gate has stopped paying for itself — see the falsifiable condition in design doc §5.

**Worked example** (this repo, 2026-09-18): 7 active exec-plans + 1 in-flight change measured to **parallelism 1** — 3 plans were substantively complete, 3 remaining items were all optional and needed a live Grok session, and the in-flight change was the team-lead's own, already committed. Step 5 applies to that lane: it has nobody to be dispatched to, so the roster sizes off **0** — team-lead + reviewer, `implementers = 0` — and the 3 blocked items are reported as blockers, not padded into roles. Re-measuring against the design-doc backlog gave 3 lanes, but 2 of the 3 were gated on a product decision.

**Report the measurement before proposing a roster.** The report always leads with the number, then the blockers, then the roster it implies.

## Session contract (why later turns need no prefix)

Once Phase 4–5 have run, **the team-lead is this conversation**. For the rest of the session a plain user turn is a task for the team.

```text
A bare user turn -> classify, then act:
  new lane      -> measure once; append a task to team-session.json tasks[];
                   spawn an implementer (roster rebuild only at a phase boundary)
  existing lane -> SendMessage the whole task to that implementer
  not team work -> answer directly; append one line to progress.md; spawn nothing
```

The **`not team work`** branch is load-bearing. Without it the team becomes a tax on every unrelated turn — the failure mode that makes people abandon this kind of entry point.

This is a promise about **context**, not a trigger. There is no hook and no injection; the roster survives in this conversation because it is in the conversation. After a compaction, or in a new session, the roster may be gone from context — recover it by reading `team-session.json`, then `team-snapshot.md`. **Do not re-derive the roster from the transcript.** Re-invoking `/jj-team` is the one-word repair path: in the same session it hits R1 and resumes silently; in a new session it hits R3 and asks (see [specs/state-layout.md](specs/state-layout.md)).

## Host detection (once per session)

Detect the host **once per session** and store the result in `team-session.json` as **two independent booleans**, not one mode.

| Probe | Records |
| --- | --- |
| The host spawns teammates that persist across turns (`Agent` + `SendMessage`, `TeamCreate`) | `teammates: true` |
| No such spawn primitive — every lane is a single-shot dispatch | `teammates: false` |
| A shared task list exists (`TaskList`) | `task_board: true` |
| No task list; state lives only in the state files | `task_board: false` |

Probe for **capability, not brand**. Do not report `degraded` merely because the host is Grok — that skips the entire full path on a host that may well have the APIs. Re-detect and overwrite when the file was written by a different `host_id`.

**Why bits and not a mode.** The retired three-value `host_mode` (`full` / `codex-degraded` / `generic-degraded`) could not say "teammates but no task board" — and this repo's host is exactly that, since `TeamCreate` and `TaskList` are absent while `Agent` + `SendMessage` persist teammates across turns. A fourth enum value would only move the shortage onto the next host. Record `teammates` and `task_board` separately and let each answer its own question.

**What `teammates: false` costs is concurrency, not the team.** Such a host still provisions and still runs the team: run the roster **serially** through the state files, dispatching each lane as a single-shot Agent, and say `模式：degraded` up front. Without a task board there is no global view to read — the state files *are* the board, so read them.

## Session binding

The join key is `host.session_id`. Invoking `/jj-team` resolves Phase 0 against `team-session.json` before anything else.

**The resolution order (R1–R6), the per-host session-id sources, and the no-fabrication rule have exactly one copy** — in [specs/state-layout.md](specs/state-layout.md). Read them there; do not restate them here, because two copies of a decision table drift.

What matters at the call site:

- **R1/R2 resume silently.** Re-invoking never provisions a duplicate team — `resume, do not init`. This is `findRalphInitConflict` (`src/ralph/state.mjs:718-743`) applied at project scope.
- **A session id you could not read is `null`, never a guess.** Write `host.session_id: null` with `session_id_source: "unknown"` and let R2 carry the binding. A fabricated handle makes the ledger lie in a way that stays invisible until it misroutes — the same rule as `skills/jj-dispatch/references/agent-write-plane.md:51,58`, which keeps an unreadable handle PENDING rather than invented.
- **The user never pastes a session id.** Resolving it is this skill's job.

## Routing

`/jj-team` provisions by default. It delegates to a sibling engine only when the request is genuinely a single round.

| Mode | When | Where |
| --- | --- | --- |
| **ccteam** (this skill) | Persistent team across multiple tasks; planning files + roster + generic review rubric; long-running work | `.workflow/.team/TEAM-*` (main checkout) |
| coordinate | Session-scoped multi-role pipeline; dynamic role-specs; one task | `/jj-team-coordinate` → `.workflow/.team/TC-*` |
| lifecycle | Fixed SDLC document chain (spec → design → tasks) | `/jj-team-lifecycle` → `.workflow/.team/TLV4-*` |
| swarm | Multi-hypothesis adversarial search | `/jj-team-swarm` → `.workflow/.team/TAS-*` |

Delegate by naming the sibling and stopping — do not reimplement its pipeline. A single lane whose shape matches a sibling is delegated to it by name; that is routing, not reimplementation.

## Team state layout

```text
<main checkout>/.workflow/.team/
├── TEAM-<project_key>-<YYYYMMDD>/   -- one live team
│   team-session.json     -- live binding + roster + parallelism (read FIRST on resume)
│   task_plan.md          -- navigation map (team-lead owns)
│   findings.md           -- team-level findings log
│   progress.md           -- chronological work log
│   decisions.md          -- decisions + rationale
│   team-snapshot.md      -- full un-abridged onboarding prompts (recovery)
│   <agent-name>/
│     task_plan.md / findings.md / progress.md
│     <prefix>-<task>/    -- per-task folder: task_plan / findings / progress
└── archive/<team_id>/    -- superseded teams and logs
```

The root is the **main checkout**, not the one you are sitting in. How that is resolved — the two existing git commands, why `resolve` and not `dirname` on the common dir, and the two-repo fallback table — has exactly one copy, in [specs/state-layout.md](specs/state-layout.md); read it there rather than trusting a restatement here.

`<project_key>` is the project's key. The **authoritative** value is the `project_key` field inside `team-session.json`, so a directory spelled two ways still finds its own history. When a key has to be computed, the product has exactly one implementation — `resolveProjectKeyFromCwd` in `src/projectMap.mjs`, the same function that names `~/.jj-flow/memory/<project_key>.md`. Pick it once and keep it stable.

**Why the main checkout.** Three reasons, in order of hardness. First, the root is the same one the three sibling engines already use (`.workflow/.team/TC-*`, `TLV4-*`, `TAS-*`), so one convention covers four engines. Second, a wrong key now **fails loudly**: the Phase 0 glob finds nothing and a team is provisioned fresh, instead of silently landing in a legitimate-looking home directory that belongs to another project. Third, the ledger travels with the repo. The worktree correctness that used to argue *for* home is preserved by the main-checkout rule above — a linked worktree resolves to the same root, so the ledger cannot fork.

**A repo that forbids `.workflow/` falls back to `~/.jj-flow/team/TEAM-<project_key>-<YYYYMMDD>/`.** `harness-manifest.json` → `record_system.forbidden_paths` lists `.workflow`, and `scripts/check-harness.mjs` (`HNS-STATE-001`) fails `harness:check` as soon as the path exists — so the repo's own gate decides, not a hand-written exception. This product repo is one of those, and it says so out loud when it falls back. On that path `$JJ_FLOW_HOME` moves the root; on the project-internal path it changes nothing.

**Two costs, stated honestly:** on the fallback path the ledger does not travel with the repo, so a second developer cloning it sees nothing; and one `project_key` holds one live team by default (a genuinely concurrent second team appends `-2` to the directory name).

## Operating manual (no CLAUDE.md)

Upstream CCteam writes a repo-root `CLAUDE.md` so the team roster survives context compaction. **This skill does not** — a second source of truth next to `AGENTS.md` is exactly the drift this product guards against.

Recovery works instead through:

1. `<team root>/team-session.json` — the live binding, roster and lane count
2. `<team root>/team-snapshot.md` — full onboarding prompts, verbatim
3. Re-invoking `/jj-team` — hits R1 and reloads [references/team-manual.md](references/team-manual.md) on demand

The snapshot is only trustworthy if it is not stale, and that is **mechanical, not editorial**: `node scripts/snapshot_stale.mjs --team-dir <team dir>` re-reads every stamped skill file and exits `0` fresh / `1` stale / `2` unverifiable / `3` usage. Run it before trusting the cached prompts — at Phase 0, on `check`, and on `resume`. Exit `2` means "cannot tell" (no snapshot, no parseable stamp, skill root gone); it is not a pass. Exit `3` means the command itself was wrong, so nothing was checked — it is neither of the two verdicts above and must not be read as either. Stamp format and the regeneration procedure: [specs/state-layout.md](specs/state-layout.md).

At the end of Phase 5, print this banner verbatim (a stable string, so it can be found in the transcript later):

```text
团队已就位：TEAM-<project_key>-<YYYYMMDD> ｜后续直接给任务（无需 /jj-team）
```

If the team-lead looks disoriented after a compaction, say:

> 读 `<team root>/team-snapshot.md` 恢复团队状态

## Roles

Roles and their boundaries: [references/roles.md](references/roles.md).
Downstream CCteam protocols to follow: [references/team-manual.md](references/team-manual.md).

Default roster is **not** the full catalog. `custodian` is omitted by default: when a mechanical gate already covers compliance (as `npm run verify` does in this product), a custodian is duplicate infrastructure. Add one only when a review pattern recurs that the existing gates do not catch.

At `lanes == 0` the roster is team-lead + `reviewer` and **no implementer directories are created**. The reviewer is spawned because review separation is real work even with nothing in flight — it is what makes the 0-lane team a team rather than a folder of documents.

Multi-instance `researcher` is the one role designed to scale — split by **volume** (same job, N pieces) or by **direction** (independent topics). Never split when direction B depends on direction A's conclusion.

## Review rubric

Fixed generic dimensions — see [references/review-dimensions.md](references/review-dimensions.md).

| # | Dimension | Weight |
| --- | --- | --- |
| RD-1 | 产品深度 (product depth) | 高 |
| RD-2 | 可测试性 (testability) | 中 |
| RD-3 | 性能 (performance) | 中 |
| RD-4 | API 优雅 (API elegance) | 中 |

Any dimension `WEAK` → verdict cannot be `[OK]`. Calibration anchors live in the reference file; reviewer reads them before each review. The rubric is pinned into `team-session.json` as `review_rubric` so a recovering reviewer reads the right one.

## Message delivery constraint

`SendMessage` reaches a teammate only when it is **idle** (between turns). You cannot interrupt a running agent, and a broadcast has no preemption. Consequences:

- **Front-load the initial assignment.** No mid-flight correction exists.
- **Read files for current truth, send messages for intent.** Files are real-time; messages are not.
- Size tasks by uncertainty: high uncertainty → small tasks (more checkpoints); low uncertainty → large tasks (fewer round-trips).

**Addressing by name is a host capability, not a protocol choice.** A spawn description is not registered as an addressable name on every host, and on one where it is not, `SendMessage(to: "<name>")` cannot reach anyone — the only handle the host will hand back is an opaque agent id. So:

- **Never promise a teammate it can reach a peer directly** when the host cannot address by name. The honest onboarding line is that peer traffic is relayed by team-lead, with the reason stated — a name that does not resolve is a host fact, not a shortcut someone forgot to take.
- **List agent ids when you need a relay.** The team-lead can only forward what it can address.

## Lifecycle

```text
User invokes /jj-team <request>
  -> Phase 0: resolve + bind per specs/state-layout.md (R1-R6, exactly one copy) -> resume silently, or ask
              (the table is total: a state no rule matched asks — never a quiet second team)
  -> Phase 1: measure parallelism -> report the number and the blockers
  -> Phase 2: route — ccteam (this skill) or delegate to a sibling engine
  -> Phase 3: propose the roster the number implies -> ONE confirmation
  -> Phase 4: create team-session.json + planning files -> spawn the roster
              (at 0 lanes: team-lead + reviewer only, no implementer directories)
  -> Phase 5: write team-snapshot.md (staleness stamp emitted by scripts/snapshot_stale.mjs --stamp) -> print the banner -> hand control to team-lead
  -> Bare turns run work directly (see Session contract)
  -> Phase boundary: re-measure parallelism, re-size the roster, run harness checklist
  -> Team complete -> archive the team, update the snapshot
```

## Commands

| Command | Action |
| --- | --- |
| `check` / `status` | Print roster + task state from the state files; run the snapshot staleness check (exit `1` → regenerate before trusting cached prompts; `3` → the command was mistyped, nothing was checked); no advancement |
| `resume` | Reconcile state files with live agents; report drift, including a stale or unverifiable snapshot stamp |
| `remeasure` | Re-run the parallelism measurement at a phase boundary |
| `rebuild` | Rebuild the **same** team's roster at a phase boundary (never mid-development): re-measure, re-spawn, keep the `team_id` and the ledger. It is **not** a second live team — a genuinely concurrent second team for one `project_key` is R5's AskUserQuestion, not this command |
| `pause` | Set `status: paused`; teammates may be reaped |
| `close` | Set `status: completed` + `close_reason`; move the file set into `archive/<team_id>/` under the team root |

`pause` and `close` are always explicit. **No team is ever auto-closed** — the only automatic signal available is wall clock, and wall clock is exactly what would destroy the only record of a half-finished task.

## Error handling

| Scenario | Resolution |
| --- | --- |
| `.workflow/` not writable in the main checkout | Fall back to `~/.jj-flow/team/TEAM-<project_key>-<YYYYMMDD>/`, say so out loud, and name the rule that forced it |
| `$JJ_FLOW_HOME` set | It moves only the fallback root (`~/.jj-flow`); a project that may use its own `.workflow/.team/` ignores it |
| Session id unreadable | Bind as unbound (`null` + `session_id_source: "unknown"`) and say so; never fabricate |
| Live team owned by another session | AskUserQuestion — adopt / start alongside / close |
| Re-invoked with a live team for this session | Resume, do not init |
| Team stale (`now - last_seen_at > 14d`) | Print one line and offer `close` **only when live teammates are decidable and there are none**. Where liveness is **undecidable** on this host, print the staleness line and say liveness could not be determined, and offer nothing. Either way, do not close it yourself — the full rule is in [specs/state-layout.md](specs/state-layout.md) |
| Request fits a sibling engine better | Delegate to it by name and stop |
| `team-snapshot.md` stale vs this skill | The check exits `1` and names each changed file — regenerate the stamp (`scripts/snapshot_stale.mjs --stamp`), never re-type mtimes by hand; tell the user which source won. Exit `3` is a mistyped command: nothing was checked, so regenerate nothing |
| Teammate lost after compaction | Resume from `team-snapshot.md` prompts |

## Host compatibility

| Host | Expectation |
| --- | --- |
| Claude Code, this repo's host | `teammates: true` (persistent teammates via `Agent` + `SendMessage`) + `task_board: false` (no `TeamCreate`, no `TaskList`) — concurrent, but the state files are the only board |
| Claude Code with Team/Task APIs | `teammates: true` + `task_board: true` — the full path |
| Codex / Grok / Qoder without a spawn primitive | `teammates: false` — run the roster **serially** through the state files, dispatching each lane as a single-shot Agent, and say `模式：degraded` up front |

**A host without persistent teammates still provisions and still runs the team.** The state files, planning files, decision trail and snapshot all work exactly the same; what is lost is concurrency, not the team. `capabilities` records which one it was. Delegate to `/jj-team-coordinate` only when the request is itself a single round — not as a blanket fallback.
