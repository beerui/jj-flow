# Review dimensions (floor + project)

> **The floor is fixed: the same four dimensions for every project.** Do **not** invent project-specific ones out of thin air, do not drop one, do not re-weight one.
> A project dimension (`PD-<n>`) is added **only** when a Phase 3 probe signal points at something a floor dimension cannot see — see [项目维度怎么来](#项目维度怎么来-how-project-dimensions-come-to-be) below.
> The reviewer scores each dimension in `review_rubric.all` before writing a verdict.
> Read the calibration anchors before every review; they are what keep scoring stable across reviewers and across sessions.

## Why a floor, and why additions are rare

Project-specific dimensions look sharper but drift: every project invents its own vocabulary, the anchors stop being comparable, and scores stop meaning anything across reviews. The four below are abstract enough to apply anywhere and concrete enough to argue about. That is the floor.

The failure the floor alone cannot see is the one that lives in the *contract* rather than in the code: a second consumer of an SDK, a migration path with a date on it, a host capability that turns "run both lanes" into "run one lane". Those are real and they are scoreable — but they are only real when the probe found them. An invented dimension is worse than a missing one: it costs a review round to argue about, and it teaches the next reviewer that the list is negotiable.

Standard checks (security / correctness / error handling) always apply **on top of** these. They are not dimensions — they are the floor.

---

## RD-1 产品深度 (product depth) — weight 高

Does this work for the cases a real user actually hits, not just the happy path?

| | |
| --- | --- |
| **STRONG** | Boundary cases a real user meets are handled by design: empty state, error recovery, concurrent access, partial failure, first-run vs returning-run. Failure output tells the user what happened and what to do next. |
| **ADEQUATE** | Happy path is solid and the common error paths produce a comprehensible message. Unusual states are unhandled but not misleading. |
| **WEAK** | Works only on the happy path. Error states surface a raw exception, a blank screen, or nothing. A real user is stuck within minutes. |

## RD-2 可测试性 (testability) — weight 中

Can the behaviour be pinned down by a test that survives refactoring?

| | |
| --- | --- |
| **STRONG** | Behaviour is reachable through a public interface; key paths have tests that assert *what* happens, not *how*. Adding a test for a new case is cheap. |
| **ADEQUATE** | Core paths are covered. Some tests touch internals, but a refactor breaks a manageable number. |
| **WEAK** | No tests, or tests that assert implementation details — mocking internal collaborators, asserting call counts, reaching into private state. A refactor that changes no behaviour still breaks them. |

## RD-3 性能 (performance) — weight 中

Is the cost proportional to the work, at the scale this will actually see?

| | |
| --- | --- |
| **STRONG** | Complexity is appropriate to the access pattern. Known hot paths avoid needless repeated work; growth is understood and stated, not hoped for. |
| **ADEQUATE** | No obvious pathology at expected scale. Cost is untuned but not quadratic where it matters. |
| **WEAK** | O(n²) or repeated I/O on a path that will see real volume; an N+1 query; unbounded growth with no cap. Or: performance was changed without any measurement to justify it. |

## RD-4 API 优雅 (API elegance) — weight 中

Would someone use this correctly on first read, without documentation?

| | |
| --- | --- |
| **STRONG** | Small surface, names say what they do, units and defaults are explicit, the common case is the short case, and misuse is hard — invalid states are unrepresentable rather than merely rejected. |
| **ADEQUATE** | Usable and consistent with its surroundings. Some parameters need a look at the docs; nothing is surprising. |
| **WEAK** | Ambiguous names, silent unit mismatches (seconds vs ms, ratio vs percent), required parameters that have one obvious value, or a surface that leaks internals the caller must know about. Callers get it wrong and the failure is silent. |

---

## 项目维度怎么来 — how project dimensions come to be

Six probe signals, and each one may license **at most** a dimension that a floor dimension cannot see. The mapping is deliberately narrow: most projects probe, find nothing the floor misses, and ship `project: []`. That is the normal outcome, not a failure to look.

| Probe signal | May license a dimension when… | May **not** license |
| --- | --- | --- |
| Host primitives (`capabilities`) | a capability bit changes the contract the change must hold — `teammates: false` makes "a lane's state survives a single-shot dispatch" a real requirement, not a nicety | re-weighting a floor dimension because this host is the weaker one |
| Reachable model surface | a model-specific behaviour is part of the contract — a prompt format, a context limit, a tool schema, an agent-definition file the host parses | a dimension about which model is better at writing |
| Project stack | the stack imposes a constraint no floor dimension sees — a framework migration with a date, a lockfile pin, a runtime floor, a breaking upgrade in flight | restating RD-3 with this stack's name in it |
| Product surface | the shipped artifact promises something to an outside consumer — SDK shape, published `files[]`, a cross-repo caller, a documented wire format | a dimension about files nobody imports |
| Existing conventions | **nothing.** This signal decides where state and findings live, not what good work is | any dimension at all — this is the signal most often misread as one |
| Measured parallelism | the measured number is 0 or 1 **and** the change under review claims its lanes are independent | a dimension when nothing in the change asserts parallelism |

**A project dimension is recorded, not improvised.** It goes into `team-session.json` as `review_rubric.project` with an id `PD-<n>`, a name, a weight, and its own `STRONG` / `ADEQUATE` / `WEAK` anchors written the same way the floor's are. Without anchors it cannot be scored, and an unscoreable dimension is a veto nobody can apply or contest.

**It carries the same veto as a floor dimension.** Any `WEAK` on a project dimension blocks `[OK]` exactly as a floor one does — the only reason to add one is to be able to fail a change on it.

**It is re-derived, never accumulated.** At each phase boundary the probe runs again. A dimension whose signal is gone is dropped and said out loud; a dimension that survives is the same dimension, not a re-invented one with a new id. `review_rubric.all` is always `floor` followed by `project`, in that order, so a recovering reviewer reads one list.

---

## Scoring rules

- Score every dimension in `review_rubric.all` — the floor, then the project dimensions — `STRONG` / `ADEQUATE` / `WEAK` with a one-line reason.
- **Any `WEAK` → the verdict cannot be `[OK]`.**
- When a finding is tempting to wave away ("this is minor", "probably fine") — stop and score it at face value. The developer may rebut; the reviewer's job is to present, not to filter.

## Verdict thresholds

| Verdict | Condition |
| --- | --- |
| `[OK]` | No CRITICAL/HIGH findings, all dimensions `ADEQUATE` or above |
| `[WARN]` | Only MEDIUM findings, all dimensions `ADEQUATE` or above |
| `[BLOCK]` | Any CRITICAL/HIGH finding, or any dimension `WEAK` |

## Describing a finding

A finding the developer cannot act on is noise. Each one carries:

- **Severity** — CRITICAL / HIGH / MEDIUM / LOW
- **Location** — `file:line`
- **Evidence** — the current-commit proof that it exists (`grep -n` output, a diff hunk). No evidence → not a valid finding.
- **Fix** — what to change, with the replacement shape when it is short

Before filing a finding against a target that was reviewed before, check the previous open findings on that target still reproduce. Already-fixed ones get closed, not re-filed.
