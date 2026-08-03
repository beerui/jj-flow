# MUST evidence class (acceptance contract)

> **Status:** protocol guidance for agents (not a mechanical `ralph_ops` hard gate unless product-consistency already fails).  
> **Scope:** generic across business domains. Do **not** encode product APIs, field names, or project-specific dual-write recipes here.  
> **Language:** English is SSOT for this contract.

## Purpose

Prevent **false ACCEPT**: claiming `PASS` with evidence weaker than what the MUST asserts.

Core rule:

> **Evidence level must not be lower than the MUST’s evidence class.**  
> Diff-only proof cannot PASS a write-then-read requirement.

## Evidence classes

Tag each MUST (and each acceptance row that maps to it) with exactly one primary class. If multiple apply, use the **strongest** required class.

| Class | When the MUST means… | Minimum evidence for `PASS` | Typical `N/A` / stop |
| --- | --- | --- | --- |
| `diff-only` | Style, copy, constant, pure presentational binding | Static diff / selector / `rg` showing the intended change | — |
| `behavior-local` | Client-only state or pure UI behavior; **no** durable write/read round-trip | Unit/component test, local state walkthrough, or focused static path that covers the behavior | Runtime-only envs → `READY_FOR_USER_TEST` or `N/A` + reason |
| `write-then-read` | After save/submit/update, a later open/reload/detail still shows the value (or empty) correctly | Trace: **write action → read observation** on the **same semantic field**. Mocked read responses are allowed | Missing mock **and** no runtime → do **not** static-PASS; use `READY_FOR_USER_TEST` or FAIL |
| `cross-path` | Same business meaning must stay consistent across **≥2 entry points** (e.g. list vs dialog, create vs edit) | At least one read-side observation per entry path in scope, or explicit proof paths share one write contract | Same as `write-then-read` when persistence is involved |
| `runtime-env` | Depends on real account, device, or non-reproducible env | User UAT note, recorded session, or explicit env evidence | Default stop: `READY_FOR_USER_TEST`; static-only `PASS` forbidden |

### Strength order (for “pick strongest”)

```text
diff-only < behavior-local < write-then-read ≤ cross-path < runtime-env
```

(`cross-path` often co-occurs with `write-then-read`; require both when the MUST says so.)

## Intensity application

| Intensity | Application |
| --- | --- |
| `tiny` | Default class is `diff-only` or `behavior-local`. **Do not** expand lifecycle questions unless a MUST clearly needs write-then-read / cross-path. Keep artifacts short ([tiny-example.md](tiny-example.md)). |
| `standard` | Classify every MUST. Enforce minimum evidence for `write-then-read` / `cross-path` / `runtime-env`. |
| `strict` | Same as standard **plus** existing `accept_layers.judgment` requirements ([phases.md](phases.md)). |

**Regression guard:** pure style / single-file presentational work must stay lightweight. Never force write-then-read rituals on `diff-only` MUSTs.

## ANALYZE: field lifecycle (conditional)

Expand only when at least one MUST is `write-then-read` or `cross-path`, **or** the plan touches **more than one write entry** for the same meaning.

Answer in `analyze.md` (short bullets, domain-neutral):

1. **Write paths** — How many ways can the user (or system) change this value?
2. **Read paths** — On reopen / reload / list / detail, where does the value come from?
3. **Contract identity** — Do write and read use the same field semantics (including empty / clear)?
4. **Interleaved actions** — Does enable / publish / refresh / restart switch the data source?
5. **Path divergence risk** — If only one write path is fixed, do other paths still diverge?

**Non-goals for ANALYZE:**

- Do not prescribe a specific dual-write API or vendor endpoint.
- Do not require a full dev server or production login.
- Do not run this checklist for pure `diff-only` / `tiny` presentational tasks.

Business-specific lessons (named APIs, product quirks) belong in the **business repo** capability map / knowledge contribution — not in this skill.

## ACCEPT: `acceptance.md` shape

Prefer a table that includes class and evidence ref:

```markdown
| item | must_id | evidence_class | result | evidence |
| --- | --- | --- | --- | --- |
| After save, reopen shows field X | REQ-001 | write-then-read | PASS | submit mock → getInfo asserts X; progress#… |
| Button color token | REQ-002 | diff-only | PASS | styles.css diff + rg |
```

Rules:

1. Every acceptance row that maps to a MUST must state `evidence_class` (or inherit from the MUST list in `analyze.md`).
2. `PASS` requires evidence meeting the class minimum above.
3. **Over-claim is FAIL:** e.g. `write-then-read` MUST marked PASS with only “code contains handler” / raw diff.
4. If evidence cannot be produced in-session:
   - set status `READY_FOR_USER_TEST`, or
   - mark item `N/A` with reason, or
   - `gate accept FAIL` / stay in DELIVER —
   - **never** silent static PASS.
5. Mocked read after write is a first-class way to satisfy `write-then-read` without runtime login.

## DELIVER signals

When recording `deliver-attempt`, prefer signals that match class, for example:

- `diff-only` → `signal=rg_clean` / `signal=diff:styles`
- `write-then-read` → `signal=write_then_read:mock_ok` or `signal=write_then_read:runtime_ok`
- Do not use `signal=static_only` to justify ACCEPT on a stronger class.

## Resume / user correction

On `resume` after user correction or path failure, progress should record:

- `failed_must` (id or short text)
- `failed_evidence_class` (what the MUST required)
- `over_claimed` (what was wrongly used as PASS evidence, if any)
- Next DELIVER prioritizes **closing the evidence gap**, not only adding code.

See also [post-complete-continue.md](post-complete-continue.md).

## ARCHIVE honesty (not “always commit”)

- `COMPLETED` / soft archive means the **run ledger** closed a cycle; it does **not** imply a git commit.
- After finalize, the completion report should state:
  - dirty paths (if any)
  - whether a `produced_commit` / reviewed commit exists
  - `commit-prep` suggestion when implementation is still uncommitted
- Do **not** force commit for every `tiny` or exploratory run.
- Existing rule remains: ARCHIVE with a latest **PASS review** that claims landed code still requires commit-scoped review evidence ([phases.md](phases.md) gate section).

## What this contract is not

| Not this | Why |
| --- | --- |
| Mandatory dual-write for all forms | Overfit; only lifecycle answers decide |
| Mandatory full UI login | Runtime is optional; mock write-then-read is enough when valid |
| Heavier gates for all `tiny` runs | Protects pure-style regression speed |
| Replacement for product-consistency | Mechanical path/review checks in `ralph_ops` still apply |

## Candidate id (eval lineage)

Derived from diagnosis class `false_accept_static` + `incomplete_rootcause_v1` (generic), not from a single business feature:

- **Candidate:** `C-must-evidence-class-v1`
- **Holdout:** other write-then-read / cross-path episodes in different products
- **Regression:** tiny presentational runs must not gain mandatory lifecycle or dual-path ceremony
