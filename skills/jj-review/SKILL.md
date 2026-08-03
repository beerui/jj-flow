---
name: jj-review
description: Single-repo read-only review adapter. Prefer the host's built-in review/code-review, map the result to the ralph run's reviews/REV-*.json, and write back run.json. Use for review, code review, reviewing a commit/diff, linking task/review sessions, or recording a review on the current/latest ralph run (including after soft-archive). For cross-project scheduling and the formal VERIFIED gate, use jj-dispatch. Does not replace the host review engine; does not change business code.
---

# jj-review

Produce a **read-only review record** for an existing ralph run. Prefer the **current host's built-in** review capability for the review itself; this skill binds scope, maps the result, and persists artifacts.

Do not change business code, init a run, create fix tasks, or enter dispatch.  
**May** write into a soft-archived / `COMPLETED` run (ralph has no terminal freeze). **Do not** init a new run only to “add a review.”

## Immediate actions

1. **Locate the run**  
   Read `.workflow/ralph/RALPH-*/run.json`. If the user gave `run_id`, use it; otherwise pick the **latest** run (`updated_at` desc, then `run_id` desc on ties; include authoritative runs under archive dirs). **No run → `BLOCKED`; do not init.**

   No-run output template (stop; do not init):

   ```text
   status: BLOCKED
   reason: no_ralph_run
   next: complete $jj-ralph init in this repo first, or pass run_id; this skill must not init
   ```

2. **Determine review scope**  
   Read `analyze.md` / `plan.md` / `progress.md` / `acceptance.md`.  
   Resolve target: `reviewed_commit` / working-tree diff / user-specified paths.  
   Empty artifacts and no clear commit/diff → `BLOCKED`.

3. **If the user already provided review results, map first** (`source=user_provided`)  
   User supplied a review artifact path, pasted findings, or named a completed review session → **map and persist directly**; do not call host review again.  
   See discovery order step 1 in [host-review.md](references/host-review.md).

4. **Otherwise prefer host built-in review** (see [host-review.md](references/host-review.md))
   - Discover and invoke a built-in **review / code-review** entry available in this session (do not treat test/CI verify as review).
   - Do not run a full parallel self-review first and then “compare” to the host.
   - Collect: verdict (pass / needs changes), findings, summary, artifact paths (if any).
   - After mapping: `source=host_builtin`.

5. **Map to this schema**
   - Outcome only: `PASS` / `NEEDS_CHANGES` / `BLOCKED`.
   - Finding fields: `id` / `severity` / `file` / `line` / `description` / `status` / `acceptance`.
   - Severity / verdict mapping tables: host-review.md.
   - Record `source` and `host_review` on the report (provenance only; does not advance other gates).

6. **Persist** (copy [review-report.skeleton.json](references/review-report.skeleton.json))
   - `reviews/REV-n.json` (n = existing max + 1; or 1 if none)
   - Write back `run.json.review` and `artifact_refs.latest_review_ref`
   - Append one line to `progress.md` (include `source=`)
   - For maintenance paths prefer: `jj ralph review-record` or `ralph_ops.mjs review-record` (same schema as direct file write; **do not drop provenance**). Copyable examples:

   ```bash
   # via CLI
   jj ralph review-record --run-id RALPH-login-reminder-20260722 \
     --outcome NEEDS_CHANGES --source host_builtin \
     --reviewed-commit abcdef1 \
     --host-review-json '{"method":"skill","entry":"code-review","artifact_paths":[]}'

   # or via skill script
   node <resolved>/ralph_ops.mjs review-record --run-id RALPH-login-reminder-20260722 \
     --outcome PASS --source user_provided --reviewed-commit abcdef1
   ```

7. **Completion report** (brief)  
   `run_id`, `review_id`, `outcome`, `source`, report path, host artifact refs, whether rework is needed.

Field and outcome validation: [report-layout.md](references/report-layout.md).

## User-provided results (not fallback)

Whenever the user supplies complete findings / a host review artifact / a review-session conclusion:

- `source=user_provided`
- Map and persist only
- **Does not** count as `fallback_inline`

## Fallback (only when host review is unavailable)

Allow **minimal inline review** in this session (`source=fallback_inline`) only when:

- the current host has no discoverable review / code-review entry; or
- the host entry failed and the user explicitly asks to continue.

Fallback remains read-only, must still persist `REV-*.json`, and must explain in `summary` / `host_review.note` why host review was not used.

## Hard rules

1. **Read-only**: do not change business code, init a run, or create fix tasks.
2. **Host first**: when a built-in review exists, do not skip it for a parallel self-review.
3. **Must persist** `reviews/REV-*.json` (jj-flow fact source; not chat conclusions).
4. `PASS` / `NEEDS_CHANGES` require `reviewed_commit` (≥7 chars); OPEN finding rules: report-layout.
5. Insufficient evidence → `BLOCKED` (commit may be null; state what is missing).
6. Cross-project formal closeout uses `$jj-dispatch` / installed skill / host-equivalent entry (Codex/Qoder/Grok); Claude has **no** dispatch slash (intentional). This skill does not replace the VERIFIED gate.
7. Procedures and examples are **not bound** to a single host product name; discovery uses generic capability names (see host-review matrix).
8. **Do not** treat `npm test` / `npm run verify` / pure CI green as review `PASS`.

## Inputs

- `run_id` (optional; default latest ralph run)
- `reviewed_commit` (required for PASS/NEEDS_CHANGES)
- `task_thread` / `review_thread` (optional)
- optional: existing host review artifact path or pasted conclusion (`source=user_provided`)

## Examples

```text
$jj-review run=RALPH-login-reminder-20260722
$jj-review review the login-reminder changes on the current commit
$jj-review record the host review result on the latest ralph run
```
