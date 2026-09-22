# Roles

> Scale the count to the measured parallelism, not to this catalog.
> `implementer` scales with lanes (`implementers = measured lanes`). `researcher` may multi-instance. `reviewer` stays one. `custodian` is opt-in.
> At 0 lanes the roster is team-lead + `reviewer` only — no implementer, because a roster must never contain someone with nothing to do.

## Design principle: separate creation from review

Whoever produces a deliverable does not review it. Reviewing your own output is not review.

Second principle: **quality review and outcome verification are different things.** "Was this done well?" and "did it achieve the goal?" fail independently. When a mechanical gate answers the second one (a test suite, a lint gate, a contract check), do not spend a reviewer on it.

---

## Working method (every role that produces a deliverable)

Five rules, one purpose: **a deliverable that cannot be shown to be right is not a deliverable.** They are methodology, not a roster — the roster below is unchanged.

- **Vertical slicing.** One thin end-to-end slice beats N horizontal layers. A change touching schema, logic and docs is done when the slice runs end to end, not when each layer is "complete" alone — horizontal progress hides the integration risk until the last day.
- **TDD.** Failing test first, then the smallest change that turns it green. Assert **behaviour, not implementation**: a test naming an internal function breaks on every refactor and protects nothing. Assert concrete values, not shapes. Cover boundary cases explicitly. Inject dependencies so the test can reach the branch.
- **Mock boundary.** Mock at a seam you do not own — a network call, a clock, a filesystem you did not write. Never mock the thing under test, and never mock a collaborator so thoroughly that the mock encodes the implementation: that test cannot fail, which is worse than no test.
- **Doc-Code Sync.** Behaviour lives in more than one place: source, contract tests, machine-readable manifests, indexes, user docs, changelog, installed host copies. A change that updates only the source is not finished — it is drift waiting to be found. Update every surface the change touches in the same pass, or name the one you left and why.
- **Anti-illusion protocol.** A claim without the evidence that would falsify it is not a claim. State what was measured, on which tree, at what time. "Wrote the test but did not run it" = did not write the test. A gate's exit code read through a pipe is not the gate's exit code. Self-verification is not a verdict — the reviewer's is.

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
- **Surface discipline** — the dominant failure mode for this kind of work. It is **Doc-Code Sync** under the working method above; read it there rather than a restatement here, because two copies of a rule drift and this repo has already paid for that once.
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
- **Scores the rubric in [review-dimensions.md](review-dimensions.md)** — the fixed floor, plus any project dimensions the Phase 3 probe derived. Never invents a project dimension, never drops or re-weights a floor one.
- **Verdict:** `[OK]` / `[WARN]` / `[BLOCK]`, with any dimension `WEAK` blocking an `[OK]`.
- **Every finding carries current-commit evidence.** No evidence → not a valid finding. Check the target's previous open findings still reproduce before filing new ones. This is the **anti-illusion protocol** above, applied to review.
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

**Fill from what the host can actually reach, then escalate by task.** The reachable surface is a Phase 3 probe signal, not a preference: the model this session runs on, plus the agent-definition files the host reads (`agents/`, `.grok/agents`, `.codex/agents`). A name that is not on that surface is not a roster entry — it is a seat that stays empty, and the team finds out at spawn time, after the ledger has already claimed otherwise.

Default `sonnet` for every role. Escalate to `opus` only with a stated reason:

| Escalate when | Example |
| --- | --- |
| Critical logic needing deep reasoning | A complex state machine, an irreversible migration |
| Security-sensitive review | Auth, data isolation |
| The user asks for maximum quality regardless of cost | "use the best model for this" |

Do not escalate "just in case" — it is materially slower and more expensive.

**An unreachable surface is reported, never silently mapped.** If the probe found no agent-definition files and the session's own model is the only one available, say so and roster that one — the alternative is a `roles[].model` value nothing can dispatch to, which reads as a plan and behaves as an empty chair. Record what was reachable and what was excluded, with the reason; the probe's `excluded` line is where that lives.
