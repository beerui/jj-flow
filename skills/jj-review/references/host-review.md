# 客服 assignment review (never host /review)

`jj-review` is an **adapter**: persist `REV-*.json` only when a ralph run is bound.

Review **is** the 客服 assignment path: write `ASSIGNMENT-REVIEW`, spawn a read-only reviewer with exclusive `task_paths` (SKILL.md step 4 / G-review-2). Do **not** call host `/review` / `code-review` / `[reviewer] local changes` (or any entry that auto-collects the dirty tree) — not for bound first, not for unbound, not for 当前的全部改动. 全部改动 = list those files in the assignment and still spawn.

Policy SSOT: [review-policy.md](review-policy.md) (passes, importance, nit cap, skip generated, compliance vs `task_plan.md` ## Steps).

Do not hard-code a product name (Codex / Claude / Grok / Qoder, etc.) in skill prose except to forbid a known dirty-tree entry (Grok `/review`).

## Discovery order

Never first-match host `/review`. Bound first never enters the host-callable `/review` step.

1. **User-specified**  
   User gives a review artifact path, pastes findings, or names a completed review session → parse and map directly, `source=user_provided`.

2. **客服 assignment spawn (G-review-2)** — write `ASSIGNMENT-REVIEW`, announce **派遣审查** (e.g. 派遣 reviewer 审查改动代码) then spawn one `jj-reviewer` (missing → `general-purpose`). description **starts with** `[reviewer]` (never `[reviewer] local changes`). Exclusive input = that file + listed `task_paths` / task diff. Prompt first paragraph forbids Start broad / repo grep / list_dir. Stop here. Do **not** match host `/review` / `code-review` commands. Do not wait silently. A live `[reviewer]` still running → do not spawn `$jj-same` over it (G-review-4 / `01a08fa6`).

3. **Unavailable → fallback**
   Spawn impossible, or the call failed and the user asks to continue → `source=fallback_inline` for minimal inline review (see SKILL.md).
   Note: `user_provided` is step 1, **not** fallback.

One `$jj-review` invocation runs **only one** host review path; do not chain multiple full review engines.

**Across invocations in the same thread for the same bound run:** a follow-up `$jj-review` (typical after 「按审查改」) is a **delta review**. Reuse the latest `REV-*` / host `<review_file>`; inspect files changed since last `reviewed_commit`. `resume_from` last completed `jj-reviewer` same cwd (G-review-5). Do **not** spawn a second full-repo reviewer subagent with empty context (`effective_context_source=new`). Hosts whose review skill always one-shots a new subagent (Grok `/review`: “The reviewer is not resumed; this is a one-shot review”) **must not be re-invoked** for that follow-up. Fresh whole-tree spawn only when the user explicitly asks 重新全量审查 / fresh whole-tree review. Bound first review is exclusive assignment spawn (SKILL.md step 4 / G-review-2), not `/review` local. See SKILL.md step 3b / G-review-1 / EP-20260907.

## Host discovery matrix (Codex / Grok / Claude)

Discover entries by **capability name**, not marketing product pages. Search tools / skills / slash / agents already loaded in the session:

| Host | Prefer (capability / entry shape) | How to confirm available | Typical artifact or output |
| --- | --- | --- | --- |
| **Codex** | Spawn agent `jj-reviewer` (`~/.codex/agents/jj-reviewer.toml`; missing → `general-purpose`) with exclusive `ASSIGNMENT-REVIEW` / `task_paths`. Do **not** call `$review` / host `code-review`. Do **not** use `jj-workflow-reviewer` for this slice. Reviewer pins `model_reasoning_effort = "high"` | session agent list; toml in `~/.codex/agents` | `findings.md` |
| **Grok** | Spawn `jj-reviewer` with exclusive `ASSIGNMENT-REVIEW` / `task_paths`. Do **not** call `/review` (it always fresh-spawns `[reviewer] local changes` on the dirty tree). Follow-up must not re-call `/review`. Agent pins `reasoning_effort: high` (not inherit/`xhigh`) | current session skill list; `jj-reviewer` agent in `~/.grok/agents` | `findings.md`, session attachment paths |
| **Claude** | Spawn `jj-reviewer` (`~/.claude/agents/jj-reviewer.md`; missing → `general-purpose`) with exclusive `ASSIGNMENT-REVIEW`. Do **not** call slash `/review` to collect the dirty tree. Same md as Grok | session agent list; md in `~/.claude/agents` | `findings.md` |

Shared rules (all hosts):

1. **Do not match host `/review` / `code-review`.** Spawn the assignment reviewer. `verify` / `npm test` / CI green are **not** a review.
2. Prefer **user-provided** artifacts (discovery step 1 above the matrix).
3. Subagents must be **read-only**; they must not change business code.
4. No discoverable entry → only after SKILL.md 🔴 fallback checkpoint (user OK or paste) → `source=fallback_inline`; record the reason in `host_review.note`.
5. 🔴 Discovery hard-stop: if the user requires “must use host review” and no entry exists → `BLOCKED`, name the missing entry; do not silent-fallback; do not init ralph.
6. Same-thread follow-up of a bound run that already has `REV-*` / a host review file → delta (SKILL.md 3b). Do not take the fresh-subagent path again.
7. Bound first `$jj-review` (G-review-2): exclusive assignment spawn. Do not invoke a host entry that auto-collects the whole dirty tree.

## Context to pass when invoking host review

客服 assignment is **exclusive**, not a minimum list. Pass only the assignment file:

| Item | Content |
| --- | --- |
| Assignment | `.workflow/ralph/<id>/assignments/ASSIGNMENT-REVIEW-<n>.md` |
| Packet | leftover `review-context.json` is optional; conversational path does **not** generate it via CLI |
| `task_paths` | this-round ASSIGNMENT-TASK 交付 files (or dirty-tree list if the user asked 当前的全部改动) |
| Task diff | diff of those paths only |
| Constraints | read-only; do not fix code; do not init ralph; do not locate ralph; do not read jj-review/jj-ralph SKILL; do not grep the whole repo; read listed files then write findings |
| Expectation | `findings.md`: HIGH/MEDIUM/LOW + `file:line`; conclusion `[OK]` / `[WARN]` / `[BLOCK]` |

Direct-import listed files only. `other_paths` are noise, not review targets.

Grok review **must not call `/review`**. Spawn the read-only reviewer yourself with the exclusive assignment. 当前的全部改动 / 重新全量审查 still spawn with a wider list in the assignment.

## Verdict mapping → outcome

| Host signal (any) | This schema `outcome` |
| --- | --- |
| `[OK]`; no OPEN issues; approve / PASS / LGTM / “no issues” | `PASS` |
| `[WARN]`; MEDIUM only | `PASS` (nits; 客服 still allows UAT) |
| `[BLOCK]`; CRITICAL/HIGH; request changes / FAIL / NEEDS_CHANGES | `NEEDS_CHANGES` |
| Explicit `run_id` missing, missing diff, cannot locate commit, insufficient context | `BLOCKED` |

After mapping, still satisfy report-layout validation:

- `PASS`: no finding with `status=OPEN`, and `reviewed_commit` present
- `NEEDS_CHANGES`: ≥1 OPEN finding, and `reviewed_commit` present
- Style nits only, and host marks them optional: may set `status=WAIVED` or `severity=info` and still allow PASS (if none remain OPEN)

## Severity mapping

| Host wording (case-insensitive) | This schema |
| --- | --- |
| blocker / critical / HIGH / bug (real defect) / security | `high` |
| major / MEDIUM / important | `medium` |
| minor / LOW / suggestion (worth fixing) | `low` |
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
| `host_builtin` | produced by 客服 assignment spawn on this host (not host `/review`) |
| `user_provided` | user pasted/pointed at an existing review result |
| `fallback_inline` | minimal self-review in this session |

`evidence_refs` should include host review artifact paths (when present) plus related test/diff refs.

## Relation to persistence

```text
客服 ASSIGNMENT-REVIEW spawn (or user artifact / fallback self-review)
        │
        ▼
  map [OK]/[WARN]/[BLOCK] → outcome + findings
        │
        ├── bound run → findings.md + reviews/REV-n.json + run.json.review (write files; never conversational `review-record`)
        └── unbound   → chat only (do not init; do not invent REV-*.json)
```

- **Bound fact source** is `REV-*.json` and `run.json`, not chat body. Unbound: chat only.
- Host review files may stay in their default locations; jj-flow only requires a normalized report under the contract path when bound.
- accept/archive product-consistency still reads the latest REV outcome (see jj-ralph phases).
