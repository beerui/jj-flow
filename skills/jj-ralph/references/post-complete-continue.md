# Continue after complete (agent)

User-facing: `docs/commands/jj-ralph.md` § “done but still need changes”.  
Rollback edges: `rollback.md`.

## Principles

- **Same requirement → same `run_id`** (includes archived, `COMPLETED`, recover from `ABANDONED`).
- **Archive** = map-merge + in-place COMPLETED + inline sha256 ledger; may edit and re-archive (`archive_history`).
- **New run** only when the user clearly states a new requirement / new id.
- Chat does not advance checkpoints.
- **Users do not default to saying `RALPH-…`.** Speech like “tweak the tip again”, “that one from earlier”, “drop this for now” (「再改 tip」「刚才那个」「这个先不做了」) = continue signals; the agent resolves the run.

## Detection

1. **Resolve target run (order):**
   a. User explicitly names `RALPH-…` (optional, uncommon)
   b. Run already in use in this session
   c. Latest `updated_at` whose title/goal/keywords match user speech
   d. `map-find` / directory scan as assist
   e. Still ambiguous → ask with a **title list** (id optional); do not force the user to recite the number
2. Same requirement → **do not init**:
   - `ABANDONED` → `resume`
   - Archived / `COMPLETED` / `phase=ARCHIVE` → `resume` or `rollback-phase` (e.g. →DELIVER)
   - Active → edit directly; if accept already PASS: first `gate accept FAIL` or rollback
3. Truly new requirement (user clearly says “do another thing”, “new run”, or semantic is brand new) → `init` (new optional intent under `task_plan.md` `## 目标`); optional progress notes `parent_run_id` / `supersedes_run_id` (**do not** invent these into run.json). Same-requirement resume keeps the existing intent.

## Fix mistakes

| Stage | Action |
| --- | --- |
| During DELIVER | If approach/MUST changed: move `task_plan.md` `### 当前` → `### 已落地`/`### 已取代`, write new 当前, then change code + progress + re-verify ([artifact-layout.md](artifact-layout.md)) |
| accept wrongly PASS | `gate accept FAIL` or `rollback-phase --to DELIVER` |
| Plan/analyze wrong | Roll back on **adjacent edges** only (no skipping) |
| Already archived | `resume` → same as above → may `finalize` again |
| User correction / path still failing | `resume`; progress records `failed_must`, `failed_evidence_class`, `over_claimed` (if weak evidence once claimed a strong MUST); next loop prioritizes closing the evidence gap — see [must-evidence.md](must-evidence.md) |
| Incident / two-strikes / production miss | Same requirement → `resume`. New requirement → new `init` + new intent. Add a deterministic case under repo `evals/regression/` when the miss is a skill/config invariant (`$jj-evaluated` / `npm run evaluated:check`). Do **not** auto-promote skill text |

## Add requirements

Same run: add REQ under `## 分析` `### 必须项`, add TASK under `## 计划` `### 当前`, expand `scope.in`; one re-acceptance covers all (still-true items stay PASS).
If a prior 当前 is no longer the approach, move it to `### 已取代` first — do not replace the whole `task_plan.md`. Legacy `plan.md` with `## Tasks` and no Current: rename Tasks→Current first. Shape: [artifact-layout.md](artifact-layout.md).
If accept already passed or archived: return to DELIVER first, then edit and re-verify.

## Abandon

```bash
ralph_ops.mjs abandon --run-id RALPH-x --reason "…"
# recover
ralph_ops.mjs resume --run-id RALPH-x --reason "…"
```

`map-merge` / `archive` forbidden on ABANDONED (resume first).  
`close` is deprecated.

## Anti-patterns

| Wrong | Right |
| --- | --- |
| Require “please provide RALPH- id” before continue | Resolve nearest / same-requirement run yourself |
| Default to new init after archive | Same-run resume |
| One-step rollback ACCEPT → ANALYZE | Adjacent edges only |
| Write lineage fields into run.json | Write parent/supersedes in progress.md for a truly new run |
| finalize while ABANDONED | resume first |
| Treat `$jj-end` as task completion | end is Git only |
| New intent on same-requirement resume | Keep the existing `task_plan.md` `## 目标`; new intent only on a truly new run |
| Auto-edit skill text after an incident | Add `evals/regression/` case; promote only with human approval |

## Commands

```bash
ralph_ops.mjs resume --run-id RALPH-x --reason "…"
ralph_ops.mjs abandon --run-id RALPH-x --reason "…"
ralph_ops.mjs rollback-phase --run-id RALPH-x --to DELIVER --reason "…"
ralph_ops.mjs finalize --run-id RALPH-x --lessons "reusable rule"
ralph_ops.mjs knowledge-contribute --run-id RALPH-x --hook   # user: feed knowledge base
```

## Knowledge contribute

When the user says 「投喂知识库 / 补充全局知识」 or “feed knowledge base / contribute global knowledge”, **or** after the completion report they accept the idle offer (**do not** require a run id):

1. Resolve run (same continue detection)
2. `knowledge-contribute --hook` (built-in ingest into `~/.jj-flow/knowledge` for the **current** `project_key`; custom CLI may use `{project}`)
3. Report: `status=degraded` (P1b no longer writes `knowledge-contribution.json`); hot memory already promoted at archive
4. Failures are fail-open; archive unchanged; hint checking `knowledge_root` / `RALPH_KNOWLEDGE_HOOK_CMD`
5. Do **not** hook on finalize unless the user said yes. Map join / first-time KB bootstrap → `$jj-init`.
