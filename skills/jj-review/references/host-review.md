# Prefer host built-in review

`jj-review` is an **adapter**: prefer the review engine already available on the current host; persist `REV-*.json` only when a ralph run is bound.

Policy SSOT: [review-policy.md](review-policy.md) (passes, importance, nit cap, skip generated, compliance vs `task_plan.md` ## Steps).

Do not hard-code a product name (Codex / Claude / Grok / Qoder, etc.) in skill prose. Choose the entry via **capability discovery**.

## Discovery order (first match wins)

1. **User-specified**  
   User gives a review artifact path, pastes findings, or names a completed review session → parse and map directly, `source=user_provided`.

2. **Host-callable review skill / command**  
   Among skills / slash / commands loaded or callable in this session, **match only explicit review entries**:
   - name or description contains `review`, `code-review`, `code review` (prefer these)
   - read-only reviewer subagent / review persona (see next)

   **Do not** treat the following as code review by default:
   - `verify`, `npm test`, `npm run verify`, CI/lint/typecheck green
   - pure “fix until pass” `check-work` / self-verify loops (those are verification/rework, not a review engine)

   Use such an entry only when the user **explicitly** asks to review with it **and** it outputs **structured findings** (file/line/severity/description). If it is a “fix until pass” loop, take only the **first-round read-only review verdict**; do not auto-start fixes inside jj-review. Tests passing ≠ `outcome=PASS`.

3. **Read-only reviewer subagent / role**  
   When the host provides a read-only reviewer / review persona / read-only subagent, use it to produce findings for the agreed diff/commit.  
   Constraint: subagent is read-only; it must not change business code.

4. **Unavailable → fallback**  
   None of the above, or the call failed and the user asks to continue → `source=fallback_inline` for minimal inline review (see SKILL.md).  
   Note: `user_provided` is step 1, **not** fallback.

One `$jj-review` invocation runs **only one** host review path; do not chain multiple full review engines.

## Host discovery matrix (Codex / Grok / Claude)

Discover entries by **capability name**, not marketing product pages. Search tools / skills / slash / agents already loaded in the session:

| Host | Prefer (capability / entry shape) | How to confirm available | Typical artifact or output |
| --- | --- | --- | --- |
| **Codex** | skill / command name or description contains `review`, `code-review`, `code review`; read-only reviewer agent | session callable list / skill dirs; user `@` or `$` review entry | structured findings text or review artifact path |
| **Grok** | installed skill with review/code-review; Build read-only subagent / reviewer role | current session skill list; role-spec declaring read-only reviewer | findings list, session attachment paths |
| **Claude** | slash or skill: `/review`, commands named with review/code-review; read-only subagent | `.claude/commands` / loaded Skill; `/help` or tool list | report Markdown / structured findings |

Shared rules (all hosts):

1. **Match only explicit review entries**; `verify` / `npm test` / CI green are **not** a review engine.
2. Prefer **user-provided** artifacts (discovery step 1 above the matrix).
3. Subagents must be **read-only**; they must not change business code.
4. No discoverable entry → only after SKILL.md 🔴 fallback checkpoint (user OK or paste) → `source=fallback_inline`; record the reason in `host_review.note`.
5. 🔴 Discovery hard-stop: if the user requires “must use host review” and no entry exists → `BLOCKED`, name the missing entry; do not silent-fallback; do not init ralph.

## Context to pass when invoking host review

At minimum provide:

| Item | Content |
| --- | --- |
| Scope | ralph `run_id`, Goal / 验收 / Steps (from `task_plan.md`; leftover 分析/计划) |
| Target | `reviewed_commit` or working tree / specified paths |
| Constraints | read-only; do not fix code; do not init ralph |
| Expectation | structured findings (file/line/severity/description) + overall verdict |

Host review’s target diff should cover ralph-related changes; reduce whole-repo noise via plan `scope.in` when helpful.

## Verdict mapping → outcome

| Host signal (any) | This schema `outcome` |
| --- | --- |
| No OPEN issues; approve / PASS / LGTM / “no issues” | `PASS` |
| Issues that need changes; request changes / FAIL / NEEDS_CHANGES | `NEEDS_CHANGES` |
| Explicit `run_id` missing, missing diff, cannot locate commit, insufficient context | `BLOCKED` |

After mapping, still satisfy report-layout validation:

- `PASS`: no finding with `status=OPEN`, and `reviewed_commit` present
- `NEEDS_CHANGES`: ≥1 OPEN finding, and `reviewed_commit` present
- Style nits only, and host marks them optional: may set `status=WAIVED` or `severity=info` and still allow PASS (if none remain OPEN)

## Severity mapping

| Host wording (case-insensitive) | This schema |
| --- | --- |
| blocker / critical / high / bug (real defect) / security | `high` |
| major / medium / important | `medium` |
| minor / low / suggestion (worth fixing) | `low` |
| nit / style / info / note / optional | `info` |

Default `medium` when unclear. Default `status` is `OPEN`; host-closed/ignored items → `RESOLVED` / `WAIVED`.

## Finding field fill

| Field | Source |
| --- | --- |
| `id` | `F-1`… in order; or keep host id (normalized to a safe string) |
| `severity` | table above |
| `file` | path relative to repo root; `unknown` if unknown |
| `line` | positive integer; `1` if unknown |
| `description` | problem statement (may include host excerpt) |
| `status` | `OPEN` / `RESOLVED` / `WAIVED` |
| `acceptance` | close condition; if none, write “fix per description and re-review” |
| `pass` | optional: `bugs` / `security` / `compliance` ([review-policy.md](review-policy.md)) |
| `importance` | optional: `important` / `nit`; untagged `severity=info` maps to nit |

## Report provenance fields (recommended on REV JSON)

```json
{
  "source": "host_builtin",
  "host_review": {
    "method": "skill|command|subagent|user_provided|fallback_inline",
    "entry": "short discovered entry name; not vendor marketing names",
    "artifact_paths": ["host artifact relative or absolute paths"],
    "note": "optional: mapping notes or fallback reason"
  }
}
```

| `source` | Meaning |
| --- | --- |
| `host_builtin` | produced by host built-in review |
| `user_provided` | user pasted/pointed at an existing review result |
| `fallback_inline` | minimal self-review in this session |

`evidence_refs` should include host review artifact paths (when present) plus related test/diff refs.

## Relation to persistence

```text
host built-in review (or user artifact / fallback self-review)
        │
        ▼
  map outcome + findings
        │
        ├── bound run → reviews/REV-n.json  +  run.json.review  +  events.jsonl
        └── unbound   → chat only (do not init; do not invent REV-*.json)
```

- **Bound fact source** is `REV-*.json` and `run.json`, not chat body. Unbound: chat only.
- Host review files may stay in their default locations; jj-flow only requires a normalized report under the contract path when bound.
- accept/archive product-consistency still reads the latest REV outcome (see jj-ralph phases).
