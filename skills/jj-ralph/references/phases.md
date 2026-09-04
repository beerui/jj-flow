# Phases and checkpoints

Chat text cannot advance checkpoints. Facts come from `run.json`, phase artifacts, and Git evidence.

| Stage (gloss) | phase | Required artifacts | gates.* PASS conditions |
| --- | --- | --- | --- |
| Requirements analysis | `ANALYZE` | `task_plan.md` `## Goal` (+ optional `## 存疑`) | Goal + 验收 checklist; `write-then-read`/`cross-path` still need a real write→read verify (see [must-evidence.md](must-evidence.md)); analyze-hold keeps `## 存疑` open |
| Implementation plan | `PLAN` | `task_plan.md` `## Steps` | Every Step names a file in backticks; 验收 items stay current |
| Implement & verify | `DELIVER` | Code, dated `progress.md` section, focused verification | Steps done and verification not FAIL; rework loops allowed; `deliver-attempt` (events.jsonl) matches the verify you ran |
| Acceptance | `ACCEPT` | `task_plan.md` `## 验收` | Checklist items checked with real evidence; ban write-then-read PASS via diff only; **product-consistency**: deliver already PASS; latest review must not be `NEEDS_CHANGES`/`BLOCKED`; `## Steps` paths vs current diff |
| Archive | `ARCHIVE` | live run dir + `run.json` `archive` / `archive_history`; map merge | In-place COMPLETED (resumable); sha256 ledger inline; no `archive-manifest.json`; leftover `.workflow/ralph/archive/` snapshots are read-only; product-consistency + if a PASS review exists then commit-scoped review SHA required; COMPLETED ≠ committed (report honestly lists dirty / commit-prep); **re-archive allowed** (appends `archive_history`) |

## status

| status | Meaning |
| --- | --- |
| `IN_PROGRESS` / `READY_FOR_USER_TEST` / `BLOCKED` / `PAUSED` | Active or clock stopped |
| `COMPLETED` | After the latest archive; **may** `resume` same run to edit again |
| `ABANDONED` | Abandoned; no map/archive; can `resume` to recover |

Same requirement always prefers the same `run_id`. New run only for a truly new requirement.

## Autonomy loop

```text
Read run.json + last 30 lines of progress.md + Git (map-find CLI, not the JSON)
  → do next Step
  → append a dated progress section
  → verify FAIL and iteration < max → stay in DELIVER
  → needs human decision → BLOCKED / READY_FOR_USER_TEST (stop clock)
  → accept PASS → finalize (map-merge + in-place archive) → COMPLETED (can resume)
  → drop mid-flight → abandon → ABANDONED (can resume)
```

`max_iterations` defaults to 20; on ceiling write `intervention_needed.kind=MAX_ITERATIONS`.

## Intensity

`init --intensity tiny|standard|strict` writes `run.intensity` plus default `budget` / `stagnation` / `accept_layers`. Missing intensity and legacy runs = `standard`.

| intensity | max_iterations | PLAN | DELIVER | ACCEPT judgment layer |
| --- | --- | --- | --- | --- |
| `tiny` | 8 | Shortest (see tiny-example) | Single track; early stop on stagnant `deliver-attempt` | Default SKIPPED allowed |
| `standard` | 20 | Normal short plan | Same | Honor review if present; else SKIPPED |
| `strict` | 12 | Prefer 2–3 options in `plan_options` | Tighter budget | **Must** `accept_layers.judgment=PASS` (review/recheck) |

Mechanical steps:

```bash
ralph_ops.mjs deliver-attempt --run-id … [--improved true|false|auto] [--signal "verify:…"]
# omit --improved / auto: compare workspace diff fingerprint + signal; blocks fake improved
ralph_ops.mjs accept-layer --run-id … --layer judgment --status PASS --mode review|recheck
ralph_ops.mjs gate --run-id … --gate accept --status PASS
```

- **Layer 1 mechanical**: existing product-consistency (deliver PASS, paths, review not NEEDS_CHANGES…)
- **Layer 2 judgment**: required for strict; error-level `gate_issues` always block accept (unless waived/`--force`)
- Consecutive `improved=false` reaching `stagnation.patience` (default 2) and/or `budget.max_same_strategy_failures` → `BLOCKED` + `intervention_needed.kind=STAGNATION`, and write run-local `instruction-correction.md`. Reviewer stays read-only; Developer may later land a durable rule under business-repo `AGENTS.md` ## Agent corrections
- Soft hint only: `deliver-attempt --improved false` or `rollback-phase` may print `这次失败的原因记下来了吗（ralph_ops finding）`. **Does not block** the gate. Record a pitfall only when you have a 对策.
- `jj ralph metrics` / `ralph_ops metrics` derives clocks from progress timestamps; missing clocks stay `null` and **never** block ACCEPT
- Hit `max_iterations` / `budget.max_deliver_loops` → `MAX_ITERATIONS`
- `review-record` outcome=PASS/NEEDS_CHANGES → auto-write `accept_layers.judgment` (strict may gate accept directly)
- `map-merge` / finalize auto-write STAGNATION, strict, etc. into capability `lessons` (weak pheromone for map-find)
- **ABANDONED** forbids `map-merge` / `archive` (resume first)

## Gate set (deprecated)

Conversational `$jj-ralph` **never** uses `--lite` / `brief` / `close`. Always ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE. Ignore init `gate_set?` text. `tiny` only shortens the plan.

CLI `--lite` may still exist for leftover runs. Do **not** start a new conversational run with it. If you load `gate_set=lite`, walk the five gates (or let any FAIL / `scope --in` promote to full). Do not teach the user a second tier.

## MUST evidence (generic, anti false-green)

Contract SSOT (English): [must-evidence.md](must-evidence.md). Summary:

- Tag every MUST with `evidence_class`: `diff-only` | `behavior-local` | `write-then-read` | `cross-path` | `runtime-env`
- **Claims must not exceed evidence**: `write-then-read` needs a write→read trace (mock allowed); ban PASS on diff alone
- `tiny` + pure presentational defaults to `diff-only`; **no** mandatory lifecycle / dual-path ceremony
- Business API names and dual-write recipes live in the business-repo knowledge, **not** this skill
- User-correction resume: append a dated progress section; close the evidence gap; do not dump `failed_must` machine lines into progress.md

## Lean execution

- Single-point / single-file: shortest Goal + file list + 验收; follow [tiny-example.md](tiny-example.md); prefer `intensity=tiny`.
- Once files are located, go DELIVER; do not re-search the whole tree for completeness theater.
- Batch independent reads; `offset`/`limit`; do not re-read injected files; do not Read `business-map.json`.
- Same tool/strategy fails twice → change approach; record `deliver-attempt` after every verify; second unchanged attempt writes `instruction-correction.md`.
- Parallel capacity: one person, **2–3** independent streams (separate worktrees). Shared files stay serial. Stop adding streams when review cannot keep up. `$jj-review` reports only.
- All steps are done by the current session reading/writing the agreed paths (host-agnostic).
- When commit/push not requested: give commit-prep suggestions or a completion report; if still dirty after finalize, say so in the report.
- `$jj-end` is **Git only**, orthogonal to run status, and may run multiple times.

## Code exploration (optional accelerator)

Host-level only — not a jj-flow dependency. Same pattern as optional team engines: use when present, never block a phase.

| When | Action |
| --- | --- |
| Host has CodeGraph MCP (e.g. `codegraph_explore`) **and** workspace index is usable (`.codegraph/` or healthy `codegraph status`) | Prefer graph for **ANALYZE** (and impact-heavy PLAN): call paths, blast radius, cross-file entry points, “where used / what breaks” |
| Known path, pure presentational `tiny`, reading `run.json`/gates, git/workflow mechanics | Skip graph; use Read / Glob / Grep / Bash / `rg` |
| CodeGraph missing, errors, stale banner without recovery, or empty/irrelevant | Fall back immediately to Read/Grep family; do not retry graph as STAGNATION filler |

- Do **not** invent CodeGraph availability or require the user to install it mid-run.
- Graph snippets are exploration aid only: they **do not** advance gates, replace verification, or count as MUST evidence by themselves.
- Install/index (host-side, outside this skill): `codegraph install` once per agent; `codegraph init` once per project ([colbymchenry/codegraph](https://github.com/colbymchenry/codegraph)).

## User intervention (only these)

1. Affects MUST/acceptance/scope and cannot be safely inferred
2. Irreversible ops (push, merge, release, delete data) — prepare only, do not execute
3. Missing secrets/permissions
4. Human UAT required and static evidence insufficient
5. Dirty workspace would overwrite user edits
6. User said 先不写代码 / 先理解需求 / 先分析 — stay ANALYZE; no `gate analyze PASS` until 「开始做吧 / 我认可 / 继续改」
7. Screenshot / 「这里」 / `[Image]` — read the image before searching; it is the spec

After a phase PASS, auto-advance to the next phase by default; do not ask “continue?”. **Exception:** analyze-hold (item 6).

## Closeout

- After accept PASS, prefer `finalize` = map-merge + in-place archive (re-archive allowed; appends `archive_history`).
- Stepwise: `map-merge` then `archive`; do not archive without map.
- Further edits: `resume` same run → re-verify → may `finalize` again.
- Drop mid-flight: `abandon`; can `resume` later. Conversational `close` is deprecated.
- Truly new requirement only → `init` a new run.

## Rollback

See [rollback.md](rollback.md). Adjacent phases only; ARCHIVE→ACCEPT is legal; `resume` / `abandon` write progress; gate FAIL needs a log entry.

## gate

- Prefer `ralph_ops.mjs gate --run-id … --gate analyze|plan|deliver|accept|archive --status PASS`. Do not use `brief`/`close` on the conversational path.
- PASS advances phase by default; `--no-advance` only flips the gate.
- `accept`/`archive` PASS run product-consistency:
  - `gates.deliver` must already be `PASS` or `N/A` (forbid code landed while ledger still on PLAN)
  - progress/diff shows DELIVER evidence but `deliver` not PASS → reject (deliver-outside-ledger)
  - Latest review = `NEEDS_CHANGES` or `BLOCKED` → reject PASS
  - Implementation paths in `task_plan.md` **## Steps** (leftover: `## 计划 → ### 当前`), active `## 验收` rows, and `scope.in` vs current diff (or explicit `diff_paths`) mismatch → reject PASS
  - Bugfix / `failed_must` / latest `NEEDS_CHANGES` runs must not delete or empty tests; `tiny` presentational without those signals is exempt
  - **ARCHIVE** with latest `PASS` review: must have `review_scope=commit` and `fix_commit`/`reviewed_commit`; `working_tree` PASS is temporary evidence only and cannot archive as landed
  - When policy changes mid-run, rewrite Goal / 验收 / Steps before accepting; do not only change code ([artifact-layout.md](artifact-layout.md))
  - Ops override: `force: true` (library API / finalize force); default conversational path must not use force
- Host metadata (optional, does not advance checkpoints): `run.host.host_id` / `thread_id` / `model_id` / `export_path`; write via `jj ralph host-record` or init for evaluation and session replay
- Optional review fields: `--review-scope working_tree|commit`, `--fix-commit <sha>`

Continue decision tree (after archive / abandon / sub-requirements): [post-complete-continue.md](post-complete-continue.md).
