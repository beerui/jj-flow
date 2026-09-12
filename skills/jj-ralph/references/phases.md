# Phases and checkpoints

Chat text cannot advance checkpoints. Facts come from `run.json`, phase artifacts, and Git evidence.

| Stage (gloss) | phase | Required artifacts | gates.* PASS conditions |
| --- | --- | --- | --- |
| Requirements analysis | `ANALYZE` | `task_plan.md` `## Goal` (+ optional `## 存疑`) | Goal + 验收 checklist; `write-then-read`/`cross-path` still need a real write→read verify (see [must-evidence.md](must-evidence.md)); analyze-hold / unconfirmed requirement keeps `## 存疑` open |
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

Same requirement always prefers the same `run_id`. New run only for a truly new requirement. A review finding / 「审查修复」 / `review-fix` is the same requirement — resume, do not init. `index.md` `## 同需求提示` is prompt-only (never auto-merge).

## Autonomy loop

Parent is team-lead. Work goes through assignment files, not the parent chat.

```text
index.md 活跃唯一 | read task_plan.md (never Read business-map.json; never ralph_ops)
  → write ASSIGNMENT-TASK n (客服 shape) → spawn (exclusive file)
  → subagent: 先确认再开工 → do the next unchecked Step only → 短句汇报 + 证据
  → parent: append progress.md; STOP (do not start Task n+1)
  → verify FAIL → stay in DELIVER (STAGNATION still stops a repeated strategy)
  → all Steps done + verify PASS → 改动摘要 in findings.md
  → 大功能: ASSIGNMENT-REVIEW → [OK]/[WARN] → 用户验收 → MUST finalize (completed/ + index.md)
  → tiny: skip review; may archive after 用户验收
  → [BLOCK] / 「按审查改」→ ASSIGNMENT-FIX (same run_id) → re-review
  → needs human decision → BLOCKED / READY_FOR_USER_TEST (stop clock)
  → drop mid-flight → abandon → ABANDONED (can resume)
```

Conversational full (`gate_set=full`) does **not** BLOCK on `max_iterations`. Same requirement stays on this `run_id`. Write `assignments/ASSIGNMENT-TASK<n>.md` and spawn (客服); do not start Task n+1 in the same turn. Rewrite live Steps + append progress (or mechanical `scope --replace-in`) / resume from COMPLETED·ABANDONED·PAUSED opens a new progress round. Resume from `STAGNATION` without a rewrite keeps counters. Conversational `$jj-ralph` never runs `ralph_ops`; mechanical CLI still rejects `--lite` on the wrapper.

## Intensity

`run.intensity` is an engine field (`tiny|standard|strict`) driving `budget` / `stagnation` / `accept_layers`. Init infers it before creating the skeleton unless a mechanical override is present; resume never re-infers. Legacy missing fields still hydrate to `standard`. The conversational wrapper rejects `--intensity`; mechanical overrides remain `jj ralph init --intensity` / `initRun({ intensity })`. See [ops.md](ops.md).

| intensity | max_iterations (schema default; BLOCK only on `--lite`) | PLAN | DELIVER | ACCEPT judgment layer |
| --- | --- | --- | --- | --- |
| `tiny` | 8 | Shortest Goal + file list | Single track; early stop on stagnant `deliver-attempt` | Default SKIPPED allowed |
| `standard` | 20 | Normal short plan | Same | Honor review if present; else SKIPPED |
| `strict` | 12 | Optional `plan_options` remains supported | Tighter budget | **Must** `accept_layers.judgment=PASS` (review/recheck) |

`max_iterations` is stored on every run (schema). Conversational full does **not** BLOCK on 8 / 20 / 12. `--lite` BLOCKS at `budget.max_deliver_loops` (falls back to this field). Compact `status` still exposes the schema field; it is not a full-run stop. Do not add `set-budget`.

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
- Hit `budget.max_deliver_loops` on **lite** → `MAX_ITERATIONS` (conversational full has no lifetime cap)
- `review-record` outcome=PASS/NEEDS_CHANGES → auto-write `accept_layers.judgment` (strict may gate accept directly)
- `map-merge` / finalize auto-write STAGNATION, strict, etc. into capability `lessons` (weak pheromone for map-find)
- **ABANDONED** forbids `map-merge` / `archive` (resume first)

## Gate set (deprecated)

Conversational `$jj-ralph` **never** uses `--lite` / `brief` / `close`. Always ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE. Text init no longer prints `gate_set?`; JSON may carry the advisory without changing the ledger. `tiny` only shortens the plan.

Conversational path never starts `--lite`. If a leftover run still has `gate_set=lite`, walk the five gates (or let any FAIL / `scope --in` promote to full). Do not teach a second tier.

## MUST evidence (generic, anti false-green)

Contract SSOT (English): [must-evidence.md](must-evidence.md). Summary:

- Tag every MUST with `evidence_class`: `diff-only` | `behavior-local` | `write-then-read` | `cross-path` | `runtime-env`
- **Claims must not exceed evidence**: `write-then-read` needs a write→read trace (mock allowed); ban PASS on diff alone
- `tiny` + pure presentational defaults to `diff-only`; **no** mandatory lifecycle / dual-path ceremony
- Business API names and dual-write recipes live in the business-repo knowledge, **not** this skill
- User-correction resume: append a dated progress section; close the evidence gap; do not dump `failed_must` machine lines into progress.md

## Lean execution

- Start from `index.md` 活跃 + `task_plan.md` (last ~30 `progress.md` lines). Never `context --run-id` / `ralph_ops` on the conversational path. Mechanical `status --details` stays CLI-only. The reference list is not a startup checklist.
- This turn: write `ASSIGNMENT-TASK<n>.md` (客服 shape: 来自 team-lead / 读这些 / 交付 / 不要改 / 先确认再开工 / 短句汇报，等 Task n+1) and spawn; exclusive input is that file. The **next unchecked Step** only. Do not start later Steps. Rewrite live Steps to replace the current assignment; it does not create a new `run_id`. Mechanical `scope --replace-in` is CLI-only.
- Spawn description names `ASSIGNMENT-TASK<n>` + `run_id`. Subagent first reply = one-line confirm (goal + first step). Last action = report with paths and verify evidence. Do not commit unless team-lead said so.
- CI before review: verify PASS, then write 改动摘要 in `findings.md`, then `$jj-review`. Do not spawn review on a failing verify.
- 大功能 / non-tiny: after verify evidence in `progress.md`, `$jj-review` 客服 ASSIGNMENT-REVIEW; persist findings.md + REV json; never `review-record` CLI. 本轮只有文案/样式 skip. 小改 (`tiny`) skip review. `[OK]`/`[WARN]` → wait for 用户验收 before archive. `[BLOCK]` → reply, wait 「按审查改」, then `ASSIGNMENT-FIX`, same `run_id`, then re-review.
- Conversational review lists this-round ASSIGNMENT files only. Do not generate `review-context.json` via CLI. Mechanical CLI may still use `context --review` / `review-record`. Empty/missing task diffs cannot become PASS.
- A rewritten current plan: rewrite live Goal / 验收 / Steps and append progress. Mechanical `scope --replace-in` is CLI-only. `scope.out` does not filter away unrelated Git changes.
- Single-point / single-file: shortest Goal + file list + 验收. Parent is team-lead: write the assignment and spawn; do not Read cited source to plan.
- Once files are located **and the requirement is confirmed**, go DELIVER; do not re-search the whole tree for completeness theater. Unconfirmed requirement is a CHECKPOINT (User intervention item 1).
- Batch independent reads; `offset`/`limit`; do not re-read injected files; do not Read `business-map.json`.
- Same tool/strategy fails twice → change approach; append `progress.md` after every verify; second unchanged attempt writes `instruction-correction.md`. Mechanical `deliver-attempt` is CLI-only.
- Follow the user's process/agent limit. Use independent streams only when authorized and useful; shared files stay serial. `$jj-review` reports only.
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

1. Unconfirmed requirement — 🔴 CHECKPOINT: **ask first** when a requirement / MUST / scope / acceptance cannot be confirmed. Do not invent, do not pick a side, do not treat a guess as the spec. Write the question under `## 存疑`; stay in the current phase (or BLOCKED), do not rollback-phase to ANALYZE. Do not implement the unconfirmed fact or `gate` analyze/plan/deliver/accept/archive until a written answer; never ACCEPT/ARCHIVE the guess.
2. Irreversible ops (push, merge, release, delete data) — prepare only, do not execute
3. Missing secrets/permissions
4. Human UAT — after review `[OK]`/`[WARN]`, or when static evidence is insufficient. Stop at `READY_FOR_USER_TEST`; `gate accept` only after the user says 验收通过 / 可以收工
5. Dirty workspace would overwrite user edits
6. User said 先不写代码 / 先理解需求 / 先分析 — stay ANALYZE; no `gate analyze PASS` until 「开始做吧 / 我认可 / 继续改」
7. Screenshot / 「这里」 / `[Image]` — read the image before searching; it is the spec
8. After an assignment report — STOP; do not start Task n+1 until the next ASSIGNMENT (user 「继续」 or a new dispatch)

After a phase PASS, auto-advance to the next phase by default; do not ask “continue?”. **Exception:** unconfirmed requirement (item 1), analyze-hold (item 6), assignment STOP (item 8), and UAT after review (item 4).

## Closeout

```text
append progress.md (verify evidence)
→ 大功能: ASSIGNMENT-REVIEW → 用户验收
→ MUST finalize (completed/ + index.md + run.json documents)
```

- Conversational path never runs `ralph_ops` / `jj ralph`. Parent reads Goal / 验收 / Steps in `task_plan.md` and verify bullets in `progress.md`. Empty checkbox stubs are not artifacts.
- Mechanical `setGate` / `jj ralph gate --gate deliver` still write only the requested gate. Falling back to this command is **degraded unfold**: analyze/plan remain unchanged, so do not finalize through that CLI fallback; restore the wrapper for mechanical users. Explicit analyze/plan remain available for mechanical recovery, not as the default conversational chain.
- CAP lookup is built into init/resume (cap 5); use the returned `map_find` hits or leave empty hits empty. The lookup is not a separate Agent command, and its results are not ledger fields.
- Default closeout: 大功能 wait for `$jj-review` `[OK]`/`[WARN]` then **用户验收** then accept → finalize. 小改 (`tiny`) may skip review. `$jj-end` is not part of this chain.
- `next=commit-scoped-review` requires commit evidence, not permission to commit. Use existing session authorization; otherwise prepare `commit-prep` and explain the missing approval/evidence. Never present a working-tree review as commit-scoped or bypass the archive gate.
- Conversational path: `[BLOCK]` / `NEEDS_CHANGES` → `$jj-review` (not accept). After 用户验收 dual-write gates then MUST finalize as documents (`completed/` + `index.md` + `run.json`). Mechanical `status` prints `next`: `NEEDS_CHANGES`/`BLOCKED` → `review` (not `gate accept`). accept PASS + latest PASS on `working_tree` → `commit-scoped-review` (not `finalize`). accept PASS with no blocking review and no leftover resume window → `finalize`. COMPLETED in `completed/` → no next.
- After accept PASS, **MUST `finalize`**. Conversational = move live dir to `completed/`, update `index.md`, dual-write `run.json` (map-merge + in-place archive; re-archive allowed; appends `archive_history`). Mechanical `status` / `ralph_ops status` print `next: finalize` until `run.archive` exists. `phase=ARCHIVE` while the run is still on the live root (including the resume→rollback window) prints a second warning: `phase=ARCHIVE 未完成收尾——先跑 gate/status 核对`. Mechanical `locate` rows carry the same `next` / `closeout`; leftover runs: `jj ralph remediate` (dry-run) then `--yes`. `$jj-end` is Git only and does not write the run.
- Stepwise: `map-merge` then `archive`; do not archive without map.
- Further edits: `resume` same run → re-verify → may `finalize` again. After resume, leftover `run.archive` is **not** an immediate finalize MUST (`next=check`).
- Drop mid-flight: `abandon`; can `resume` later. Conversational `close` is deprecated.

## Failure modes

| Signal | Recovery |
| --- | --- |
| Missing `~/.jj-flow` | `jj home init`, then continue; map join / first-time bootstrap uses `$jj-init`. |
| Empty CAP or portfolio results | Continue with focused source exploration; keep empty hits empty, never Read `business-map.json` or pad unrelated history. |
| Verify FAIL | Stay DELIVER, rework; conversational append `progress.md`; mechanical `deliver-attempt`. STAGNATION still BLOCKS a repeated strategy. Lite budget cap remains `MAX_ITERATIONS`. |
| Same strategy fails twice | Change strategy; honor STAGNATION and `instruction-correction.md`, do not repeat a third unchanged attempt. |
| Dirty work would be overwritten | Preserve user changes and resolve the conflict; no silent stash/reset. |
| Handoff `ready=false` | Report `blocked_reasons`; do not start a port as if the source were ready. |
| Spoken “close” | Resolve intent to `abandon` or `finalize`; no conversational `gate close`. |
| Review findings in an authorized write task | Resume the same feature run and fix findings; do not create a review-fix task. A review-only invocation remains read-only. |
| User changes approach or says 改坏了 | Rewrite Goal / 验收 / Steps, append dated progress, then re-verify; keep history out of the live plan. |
| Judgment gate asks for a passing review | Run `$jj-review` (findings.md + REV json; set `accept_layers.judgment`). Never invent a PASS or a commit SHA. |
| Unconfirmed requirement or analyze-hold | Apply the User intervention checkpoints above before any gate or implementation. |

Use [ops.md](ops.md) for conditional `rollback-phase` / `set-status` / review operations. Batch independent reads; use `offset`/`limit`, and read only the last ~30 progress lines. Tool integrations and knowledge rules live in [integrations.md](integrations.md).
- Truly new requirement only → `init` a new run.
- `index.md` `## 归档提示`: live `task-*` **> 5** or any live `updated_at` **≥ 5 days** → prompt only. Never auto finalize/abandon. Certain (accept PASS, no blocking review) may suggest `finalize`; PAUSED / BLOCKED / mid-flight / cannot tell finalize vs abandon → **ask the user**.

## Rollback

See [rollback.md](rollback.md). Adjacent phases only; ARCHIVE→ACCEPT is legal; `resume` / `abandon` write progress; gate FAIL needs a log entry.

## gate

- Conversational path writes `progress.md` + `.state/run.json`; never `ralph_ops` / `jj ralph gate`. Mechanical CLI: `ralph_ops.mjs gate --run-id … --gate analyze|plan|deliver|accept|archive --status PASS`. Do not use `brief`/`close` on the conversational path.
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
