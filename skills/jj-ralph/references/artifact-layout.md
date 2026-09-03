# Ralph artifact layout

**Location: business repo** (ProjectA / ProjectB / ProjectC, etc.), not the control project.

```text
.workflow/ralph/
  index.md
  business-map.json
  task-{kebab-slug}/              # Scheme A: live runs sit flat (no tasks/ wrapper)
    task_plan.md                  # ## 目标 / ## 分析 / ## 计划 / ## 验收
    progress.md                   # human rounds only (## 轮次 N); append-only
    findings.md                   # 踩坑与因果；finding 软提示，不硬失败
    .state/
      run.json
      events.jsonl                # machine SSOT (gate / deliver-attempt / review / …)
      reviews/REV-*.json
      handoff.json
  completed/task-{kebab-slug}/    # archive / abandon (incl. ABANDONED); resume lifts back
  migrated/RALPH-*/               # migrate shelter for .migrated-RALPH-* leftovers
  archive/YYYY-MM-DD-*/           # 1.0 snapshots (read-only); migrate --prune-archive [--yes]
  tasks/                          # legacy P2 nest; migrate lifts into root
```

## Rules

1. Handoff source of truth: `run.handoff`
2. Do not write external `.workflow/handoffs/` or csv-wave HOF bulk packages
3. Naming follows naming config (`jj doctor` / `JJ_GLOBAL_CONFIG_DIR`; **never** hard-code host-local paths)
4. Scripts: `scripts/ralph_ops.mjs` (includes `deliver-attempt` / `accept-layer` / `resume` / `abandon`)
5. `task-*` ≠ control-plane `DEL-*` / dispatch `task_key`
6. Live runs sit at `.workflow/ralph/task-*`. `archive` / `abandon` rename into `completed/`; `resume` lifts back and opens a new progress round. Leftover `archive/` folders are historical 1.0 snapshots — `jj ralph migrate --prune-archive` dry-runs removal, `--yes` deletes. Active leftover `RALPH-*` dirs fail load/gate/save until `jj ralph migrate`
7. Intent is optional text under `task_plan.md` `## 目标`. `init` writes it except `tiny` or `--no-intent` (`artifact_refs.intent` = `task_plan.md`). Same requirement resume keeps the existing intent; a truly new requirement may get a new intent on a new run
8. Claimed implementation paths and review compliance read `task_plan.md` **## 计划 → ### 当前** only (no `Current` / `Tasks` / full-file fallback on the active write path). `### 已落地` / `### 已取代` do not count as the current ledger. Do not put `#` fragments in `artifact_refs`

## Current contract vs history

Live `task_plan.md` = **current contract** (what to do now). It is not a changelog.

| Layer | Where | Mutate how |
| --- | --- | --- |
| Current contract | live `task_plan.md` (`### 当前` under 分析 / 计划 / 验收) | Update **当前**; do not delete prior rows |
| Audit | live `progress.md` | Append only |
| Pitfalls | live `findings.md` | Append F-00N + 可复用结论 |
| Finalize snapshot | `completed/<task>/` + inline `run.archive` / `archive_history` | Rename into `completed/` on `finalize` / `abandon`; leftover `archive/` dirs are not mutated |

`archive` / `abandon` rename the live dir into `completed/`. Leftover `.workflow/ralph/archive/*` dirs (if any) are read-only 1.0 snapshots (`migrate --prune-archive [--yes]`). A mid-DELIVER plan that never passed `finalize` has no `archive` field. If you replace live `task_plan.md` in place, that text is gone.

### File shape (`task_plan.md`)

Keep this H2 order. Nested H3 under 计划 / 验收. `tiny` uses the same shape, shortest bullets. `init` writes **Chinese headings only**.

```markdown
## 目标
## 分析
### 必须项
### 范围外
### 存疑事项
### 未解决
## 计划
### 当前
- only in-force TASK items for this loop
### 已落地
- still-true completed items (do not re-implement)
### 已取代
- previous 当前 that is no longer the approach
## 验收
### 当前
| 项 | must_id | evidence_class | 结果 | 证据 |
| --- | --- | --- | --- | --- |
### 已落地
```

On first write of a new run, `### 已落地` / `### 已取代` may stay empty until something lands or is replaced.

### Legacy / init headings

`ralph_ops init` writes `task_plan.md` with `### 当前`. Older 1.0 runs may still have `analyze.md` / `plan.md` / `acceptance.md` and English `## Current` / `## Tasks`. `jj ralph migrate` merges those files and translates headings fail-open. Active extractors no longer treat `Current`/`Tasks` as current. Gate path checks read backtick paths, not these heading names.

| If you see | On task / approach change |
| --- | --- |
| `task_plan.md` `### 当前` | Move that block to `### 已落地` / `### 已取代`, then write the new 当前. Never replace 当前 in place. |
| Legacy `plan.md` `## Tasks` and no `## Current` | That Tasks block **is** Current. Rename it to Current first, then move. |
| Legacy `analyze.md` `## MUST` / `## OUT` | Keep those headings on 1.0 files. New runs use `### 必须项` / `### 范围外`. Mark abandoned MUST `SUPERSEDED` / `已取代`. |
| Legacy `acceptance.md` table, no Current sections | Keep the table on 1.0 files. `结果`/`result` = `PASS` (既有) / `SUPERSEDED`/`已取代` + reason / empty until evidence. New runs put the table under `## 验收` `### 当前`. |

### When the task / approach / MUST changes

Includes: resume after archive, user correction, mid-DELIVER policy swap. Same `run_id`.

1. **Before** replacing `### 当前`: move that whole block into `### 已落地` (still true) or `### 已取代` (approach abandoned). Then write the new `### 当前`.
2. This move is mandatory even if the previous 当前 was never archived. Do not wait for `finalize` to preserve it.
3. `## 分析`: add or tighten `### 必须项`; do not drop still-true REQ; mark abandoned MUST `已取代`.
4. `## 计划`: new work only under `### 当前`. Old TASKs stay in 已落地 or 已取代 — never a file that contains only this loop’s TASKs after a prior loop existed.
5. `## 验收`: still-true rows stay `PASS` (evidence `既有` or archive pointer). Replaced rows `已取代` + reason. New rows empty/FAIL until evidence. Do not wipe the table down to only the new round.
6. `progress.md`: append `failed_must` / `failed_evidence_class` / `over_claimed` when a correction retracts a claim.
7. Gate meaning of “rewrite plan/acceptance before accepting”: **当前** must match the code. It does not mean erase 已落地/已取代.
8. “Add REQ / TASK” = append under 当前 (and 必须项). Do not keep superseded TASKs in 当前 as if they were still to-do.
