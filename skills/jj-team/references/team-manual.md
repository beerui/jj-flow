# Team operating manual

> Loaded on demand when `/jj-team` is invoked. This is the content upstream CCteam would write into a repo-root `CLAUDE.md` — kept here instead so there is no second source of truth beside `AGENTS.md`.
> After a context compaction, re-invoke `/jj-team` or read the team's `team-snapshot.md`.

## Team-lead is the control plane

Team-lead = this main conversation. Not a spawned agent.

Responsibilities: align with the user on scope; decompose work into tasks with explicit inputs, outputs, dependencies and acceptance criteria; own the team's global files (`task_plan.md`, `decisions.md`); hold the phase gates (research → develop → review → verify → clean); decide which team-rules changes are team-local versus product-level.

Team-lead also owns two things the rest of the team cannot do for it:

- **The parallelism measurement** — re-measuring at every phase boundary and **re-sizing the roster from the number**. The measurement never dissolves the team; at 0 lanes it means "spawn no implementer", not "stop".
- **The session binding** — resolving Phase 0 (the R1–R6 table in `specs/state-layout.md`) so a re-invocation resumes instead of provisioning a second team. The user never pastes a session id; if one cannot be read, bind as unbound and say so.

## After provisioning: bare turns are tasks

Once Phase 4–5 are done, **team-lead is this conversation**. For the rest of the session the user says a task in plain words — no `/jj-team`, no prefix, no session id.

Classify each bare turn before acting:

| Classification | Action |
| --- | --- |
| **New lane** | Measure once. Append a task to `team-session.json` → `tasks[]`. Spawn an implementer. Roster rebuild only at a phase boundary. |
| **Existing lane** | `SendMessage` the whole task to that implementer — front-load it, because you cannot correct a running agent. |
| **Not team work** | Answer directly. Append one line to `progress.md`. Spawn nothing. |

The **not team work** branch is load-bearing. Without it the team becomes a tax on every unrelated turn, which is how users end up abandoning this kind of entry point.

At the end of Phase 5, print this banner verbatim:

```text
团队已就位：TEAM-<project_key>-<date> ｜后续直接给任务（无需 /jj-team）
```

This is a promise about **context**, not a trigger — there is no hook. After a compaction the roster may be gone; recover it by reading `team-session.json`, then `team-snapshot.md`. Never re-derive the roster from the transcript.

## Closing a team

`pause` and `close` are always explicit. **No team is ever auto-closed**: the only automatic signal available without a hook is wall clock, and wall clock is exactly what would destroy the only record of a half-finished task. A live team with `now - last_seen_at > 14d` and no live teammates gets **one line of notice** at Phase 0 and an offer to close — not a close.

## Roster

Filled in per team. Default shape:

| Name | Role | Model | Core capability |
| --- | --- | --- | --- |
| implementer-1 … N | Implementer | sonnet | Writes and changes artifacts; syncs every surface the change touches |
| researcher | Research | sonnet | Read-only investigation; may multi-instance by volume or direction |
| reviewer | Review | sonnet | Read-only on source; scores the generic rubric |

**One sizing formula, no exceptions:** `implementers = measured lanes`. `researcher` and `reviewer` are added because the work needs them, not derived from the lane count. Never scale to a catalog.

**What the count excludes.** A lane the team-lead owns itself is not an assignable lane, so it is excluded from the count exactly like a blocked one — otherwise the formula would size a roster with someone idle on it. Record it under `parallelism.excluded.owner_is_team_lead`.

At **0 lanes** the roster is team-lead + `reviewer` and no implementer directories are created. The reviewer is there because review separation is real work even with nothing in flight — that is what makes a 0-lane team a team rather than a folder of documents. Never spawn an implementer with nothing to do.

## Task assignment

### Front-load everything (message delivery constraint)

`SendMessage` lands only when the recipient is **idle** — you cannot correct a running agent. The initial assignment must carry the whole task.

Before sending a large task, check all four are present:

1. **Scope and acceptance** — what to do, and what "done" means
2. **Documentation reminder** — create `<prefix>-<task>/` with `task_plan.md` + `findings.md` + `progress.md`, and add an index entry to the root `findings.md`
3. **Dependencies** — which findings/decisions it relies on, with file paths
4. **Review expectation** — whether it needs review before it counts as done

Task-folder prefixes: implementer `task-`, researcher `research-`, tester `test-`, reviewer `review-`, custodian `audit-`.

### Small tasks

Direct message, no task folder, no review:
`SendMessage(to: "implementer-1", message: "Fix the XSS in the login form, see src/auth/login.tsx:42")`

## Communication

| Operation | Command |
| --- | --- |
| Assign to one teammate | `SendMessage(to: "<name>", message: "...")` |
| Broadcast (use sparingly — still delivered one idle-turn at a time) | `SendMessage(to: "*", message: "...")` |
| Request review | Implementer messages reviewer directly, not through team-lead |

**Files carry continuous state; messages carry intent at turn boundaries.** To learn current status, read `progress.md` / `findings.md` — never send "how's it going?".

## Status checks

| Want | How |
| --- | --- |
| Global view | `TaskList` |
| Fast scan | Read each teammate's `progress.md` |
| Deep dive | Read their `findings.md` index → then the specific task folder |
| Direction | Read the team's `task_plan.md` |
| Recover | Read `team-snapshot.md` → check staleness (`scripts/snapshot_stale.mjs --team-dir <team dir>`; exit `0` = fresh, `1` = regenerate first, `2` = cannot verify, `3` = the command itself was mistyped so nothing was checked) → resume or spawn → read each `findings.md` index → rebuild tasks |

Read order: **progress** (where it is) → **findings** (what it hit) → **task_plan** (what the goal is).

## Core protocols

| Protocol | Trigger | Action |
| --- | --- | --- |
| Parallelism re-measure | Every phase boundary | Re-run the measurement in `SKILL.md`; **re-size the roster** from the number. A drop to 0 means spawn no implementer, not dissolve the team |
| Plan stress test | Before the architecture is frozen | Delegate to researcher: "walk every branch of this decision tree" |
| 3-Strike escalation | A teammate reports 3 failures | Read their `progress.md`, give a new direction or reassign |
| Review | A large change completes | Implementer writes a change summary in `findings.md`, messages reviewer |
| Phase advance | Phase completes | Research done → update the plan. Development done → wait for the verdict |
| CI gate before review | Any change | The project's own gate must pass before review is requested. A failing gate = the task is not done |
| Taste capture | User states a style preference | Record it; three occurrences of the same preference → worth automating |
| Recovery | Context compaction | `task_plan.md` → `findings.md` → `progress.md`, in that order |

## Completion reports

A completion message must let the lead decide without reading the full report:

1. What was done and the core idea
2. Documentation paths (line ranges for long files)
3. Decisions made, problems found
4. **Verifiable evidence** — grep/diff/test output, not "done"
5. **Environment side effects** — `none` / `already applied (evidence: …)` / `needs team-lead: <what>`. Silence defaults to `none`, and a wrong silence breaks downstream verification.

## Escalation — when a teammate must ask

Default: decide and record the reasoning in `progress.md`. Do not ask about everything, and do not swallow confusion.

Must ask first:

- The requirement has more than one reading, and the readings imply different implementations
- Priority or ordering is unclear across several available tasks
- Scope has grown well past the description
- The decision affects another role's interface
- The choice is hard to reverse — public API shape, data schema, third-party selection

To ask: describe the dilemma, 2–3 options, which you lean toward and why. If you cannot form options, describe where you are stuck and what is missing — raw confusion is itself a signal.

## 3-Strike

1. **1st failure** — read the error carefully, find the root cause, fix precisely
2. **2nd, same error** — change approach; never repeat the same operation
3. **3rd** — re-examine assumptions, search externally, consider changing the plan
4. **After 3** — escalate to team-lead with attempted approaches and the concrete error

Append after every failure: `Tried: <what> → Result: <error> → Next: <new idea>`. Never retry a failing operation silently.

## Self-check (every ~10 tool calls)

1. What phase am I in? → `task_plan.md`
2. Where am I going? → remaining phases
3. What is the goal? → the Goal line at the top of `task_plan.md`
4. What have I learned? → key findings
5. What have I done? → recent `progress.md`

## Documentation discipline

- **Root `findings.md` is a pure index.** Status + report link + one-line summary. If it is getting long, content is leaking — split it into a task folder.
- **Archive long `progress.md`** into `archive/progress-<period>.md` when it stops being scannable.
- **Append, don't rewrite.** Use a shell append rather than reading a log in full and editing it.
- **Verify before you touch.** Between sessions another agent may have changed the file. Check current state (`wc -l`, grep, `git log`) rather than trusting remembered line numbers.

## Harness checklist (phase boundaries, not every task)

- **Docs harness** — are `task_plan.md` and the manual still accurate? Update before the next phase.
- **Observability harness** — grep `progress.md` for `error|fail`. Are failures recorded with enough detail to act on?
- **Invariant harness** — is any Known Pitfall ready to become a reviewer check or an automated assertion?
- **Replay harness** — did this phase produce a reusable pattern?

### Assumption audit

Each mechanism encodes an assumption about model capability, and those go stale. At a model upgrade or a retrospective, ask of each mechanism: did it fire fewer than twice last phase, and would removing it cause an observable quality drop? If yes to both → delete or simplify.

| Mechanism | Assumption it encodes | Check |
| --- | --- | --- |
| Task folders | Without decomposition, the model loses coherence | Are folders used, or is overhead > benefit? |
| 3-Strike | Without a guardrail, the model retries forever | How often did it actually fire? |
| Context recovery | After compaction the model cannot pick up from files | Can it now recover naturally? |
| Reviewer | The model cannot self-assess | Did it find things the author missed, or was it a formality? |
| Dimension scoring | A generic checklist misses project quality | Did scoring drive useful feedback? |
| Gate before review | Without enforcement, verification gets skipped | Did the author run it voluntarily? |

## Known Pitfalls

> Append when a failure pattern recurs. Format: symptom, root cause, fix, prevention.

### KP-1: A gate command masked by a pipe

- **Symptom** — a gate was reported as passing, but the real exit code was never observed. `cmd | tail -N` in a shell returns **`tail`'s** exit code, not `cmd`'s.
- **Root cause** — piping to a pager/trimmer for readability discards the status of the thing being measured.
- **Fix** — capture to a file and read `$?` directly: `cmd > out.txt 2>&1; echo "EXIT=$?"`.
- **Prevention** — any command whose exit code is the point must not be the left side of a pipe. When a gate's output ends at a stage that should not be the last one (e.g. output stops at the test summary when eight more checks follow), the chain stopped there — that is a failure, not a pass.
