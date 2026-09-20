# Roles

> Scale the count to the measured parallelism, not to this catalog.
> `implementer` scales with lanes (`implementers = measured lanes`). `researcher` may multi-instance. `reviewer` stays one. `custodian` is opt-in.
> At 0 lanes the roster is team-lead + `reviewer` only — no implementer, because a roster must never contain someone with nothing to do.

## Design principle: separate creation from review

Whoever produces a deliverable does not review it. Reviewing your own output is not review.

Second principle: **quality review and outcome verification are different things.** "Was this done well?" and "did it achieve the goal?" fail independently. When a mechanical gate answers the second one (a test suite, a lint gate, a contract check), do not spend a reviewer on it.

---

## team-lead

- **Instantiation:** not spawned — this is the main conversation
- **Owns:** user alignment, scope, task decomposition, phase gates, the team's global files
- **Owns the parallelism measurement:** re-measures at every phase boundary and **re-sizes the roster from the number**. `implementers = measured lanes` — one formula, no exceptions. A measurement of 0 means spawn no implementer, never "dissolve the team".
- **Owns the session binding:** resolves Phase 0 (the R1–R6 table in `specs/state-layout.md`) so re-invocation resumes rather than provisioning a duplicate. The user never pastes a session id; when one cannot be read, bind as unbound (`null` + `session_id_source: "unknown"`) and say so. **Never fabricate a handle.**
- **Decides:** whether a process improvement is team-local or belongs in the product's own sources
- **Rebuilds the team:** at phase boundaries, never mid-development

## implementer

- **Name:** `implementer-1`, `implementer-2`, … (one per lane)
- **Model:** `sonnet`; `opus` only for genuinely complex or irreversible work
- **Does:** makes the change; updates **every surface the change touches**, not just the obvious one
- **Surface discipline (the dominant failure mode for this kind of work):** a change to behaviour is rarely one file. Contract tests, machine-readable manifests, indexes, user docs, changelog, and installed host copies each carry a copy of the truth. A change that updates only the source is not finished — it is drift waiting to be found.
- **Before requesting review:** run the project's own gate. A failing gate means the task is not done.
- **Escalates** on: more than one reading of the requirement; unclear ordering; scope growth; interface impact on another role; hard-to-reverse choices

## researcher

- **Name:** `researcher` alone, or `researcher-1`/`researcher-2` (by volume), or `researcher-<direction>` (by topic)
- **Model:** `sonnet`
- **Does:** reads code, traces call chains, searches externally, writes conclusions to a task folder
- **Read-only:** never edits project source. Writes its own task folder and the index only.
- **Multi-instance — the one role designed for it:**
  - **By volume** (most common): the same job over N pieces. Purely parallel.
  - **By direction:** genuinely independent topics.
  - **Anti-pattern:** splitting when direction B depends on direction A's conclusion. One researcher doing them in order beats two queued behind a dependency.
- **Durability rule:** always pair a file path with a natural-language description of what that code *does*. The path is for navigation now; the description survives the refactor.
- **First-round challenge:** when a researcher reports "no side effects / feasible", ask which usage scenarios, side-effect dimensions or usage dimensions were missed, naming the new dimension explicitly — before accepting it.
- **Plan stress test** (when delegated): read the plan, enumerate every decision point and branch, give a recommendation and a risk mark for each, walk the edge cases (what if X fails? 10× the scale? requirements change?), and list every unresolved ambiguity. Tag conclusions `[PLAN-REVIEW]`.

## reviewer

- **Name:** `reviewer`
- **Model:** `sonnet`; `opus` for security-sensitive or architecturally complex reviews
- **Read-only on source.** Writes only its own review folder and a cross-reference line in the requester's findings.
- **Scores the fixed generic rubric** — [review-dimensions.md](review-dimensions.md). Never invents project-specific dimensions.
- **Verdict:** `[OK]` / `[WARN]` / `[BLOCK]`, with any dimension `WEAK` blocking an `[OK]`.
- **Every finding carries current-commit evidence.** No evidence → not a valid finding. Check the target's previous open findings still reproduce before filing new ones.
- **No rationalizing.** If you catch yourself writing "this is minor" or "probably fine" — stop and score it at face value. The requester may rebut; filtering is not the reviewer's job.
- **Recurring pattern:** when the same class of finding appears three or more times, mark it for automation rather than filing it a fourth time.

## custodian (opt-in)

- **Name:** `custodian`
- **Model:** `sonnet`
- **Include only when:** a review pattern keeps recurring that the existing mechanical gates do not catch. **Team size is not the trigger** — upstream CCteam suggests a custodian for 4+ member teams, but here a large team whose gates already cover compliance still gets none.
- **Why opt-in:** a custodian's main value is turning repeated manual review into automated checks. Where a gate already does that, a custodian is duplicate infrastructure.
- **Does, when present:** compliance sweeps, documentation governance, pattern → automation, dead-code cleanup
- **Write boundary:** its own team files, navigation indexes, and check scripts. **Not** source code, and not documentation *content* — report those to team-lead instead. Not knowing the implementation context is exactly why a wrong doc fix creates a new inconsistency.

---

## Model selection

Default `sonnet` for every role. Escalate to `opus` only with a stated reason:

| Escalate when | Example |
| --- | --- |
| Critical logic needing deep reasoning | A complex state machine, an irreversible migration |
| Security-sensitive review | Auth, data isolation |
| The user asks for maximum quality regardless of cost | "use the best model for this" |

Do not escalate "just in case" — it is materially slower and more expensive.
