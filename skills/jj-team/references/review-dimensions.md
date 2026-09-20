# Review dimensions (generic)

> Fixed rubric. Same four dimensions for every project — do **not** invent project-specific ones.
> The reviewer scores each dimension before writing a verdict.
> Read the calibration anchors before every review; they are what keep scoring stable across reviewers and across sessions.

## Why generic

Project-specific dimensions look sharper but drift: every project invents its own vocabulary, the anchors stop being comparable, and scores stop meaning anything across reviews. These four are abstract enough to apply anywhere and concrete enough to argue about.

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

## Scoring rules

- Score every dimension `STRONG` / `ADEQUATE` / `WEAK` with a one-line reason.
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
