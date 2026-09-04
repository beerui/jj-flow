# Ralph artifact layout

**Location: business repo** (ProjectA / ProjectB / ProjectC, etc.), not the control project.

```text
.workflow/ralph/
  index.md                        # CLI 派生：活跃/已完成表；活跃>5 或 5 天未动写 ## 归档提示（只提示）
  business-map.json
  task-{kebab-slug}/              # Scheme A: live runs sit flat (no tasks/ wrapper)
    task_plan.md                  # current contract only: Goal / 验收 / Steps
    progress.md                   # dated human narrative (## YYYY-MM-DD); append-only
    findings.md                   # 改动摘要 / 行为 / 踩坑 / 验证；empty F-00N forbidden
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
7. Intent is the Goal paragraph. `tiny` skips `## 存疑`. Same requirement resume keeps Goal; a truly new requirement may get a new run
8. Claimed implementation paths read `task_plan.md` **## Steps** (leftover runs: `## 计划 → ### 当前`). Do not put `#` fragments in `artifact_refs`

## Current contract vs history

Live `task_plan.md` = **what to do now**. History lives in `progress.md`. Machine events live in `.state/events.jsonl`. Do not keep 已落地 / 已取代 / REQ-001…N ledgers in the live plan.

| Layer | Where | Mutate how |
| --- | --- | --- |
| Current contract | live `task_plan.md` | Rewrite Goal / 验收 / Steps to match this loop |
| Audit | live `progress.md` | Append a dated section; never rewrite prior days |
| Pitfalls | live `findings.md` | Real pitfalls only (对策 required); plus 改动摘要 / 验证 |
| Machine log | `.state/events.jsonl` | CLI only (`gate` / `deliver-attempt` / review). Do not copy into progress.md |
| Finalize snapshot | `completed/<task>/` + inline `run.archive` / `archive_history` | Rename into `completed/` on `finalize` / `abandon` |

### File shape (`task_plan.md`)

Current contract only. `tiny` = shortest Goal + 1–3 验收 + 1–3 Steps. Backtick the files you will touch — gates read those paths from **## Steps**.

```markdown
# task-outbound-token-takeover

> Status: DELIVER / IN_PROGRESS
> Branch: feat/example

## Goal

One paragraph: what changes and for whom.

## 验收

1. [ ] Logged-in A + URL token=B → login overlay
2. [x] Tests 13 PASS

## Steps

1. [x] `src/utils/agent-token-identity.ts` decide guard
2. [ ] `src/router/index.ts` wire beforeEach
```

Optional `## 存疑` only for analyze-hold (「先不写代码」). Do not add 分析 / 必须项 / 已落地 / evidence_class tables unless a leftover run already has them.

### File shape (`progress.md`)

Dated human narrative. Read the last ~30 lines on resume. Do not paste ISO `gate=` / `deliver-attempt` / `fp=` lines — CLI already wrote those to `events.jsonl`.

```markdown
# task-outbound-token-takeover — progress

## 2026-08-27

- 派单：异人 JWT 挤掉重登；同人不重登
- 实现：`agent-token-identity.ts` + router requiresAgent
- 单测 12 PASS；`pnpm build` PASS

## 2026-08-27 — M-1 静默换票

- 同人 → `refresh-token`，不闪登录页
- 单测 13 PASS
```

`resume` / approach change: append `## YYYY-MM-DD — <reason>`. Never rewrite an earlier date section.

### File shape (`findings.md`)

Change summary + behavior + real pitfalls + verify. Skip empty F-00N shells. `## 可复用结论` is the only hot-memory source.

```markdown
# task-outbound-token-takeover — findings

> Status: DONE + M-1 已修

## 改动摘要

| 文件 | 变更 |
| --- | --- |
| `src/utils/agent-token-identity.ts` | 同人决策 strip-token → refresh-token |

## 行为

| 场景 | 决策 |
| --- | --- |
| 已登录 + sub === agentId | 静默换票，清 URL token |

## 踩坑

- **M-1**：同人只 strip 会 401 → `refreshAgentAuthByToken`（已修）

## 验证

- `node --test tests/agent-token-identity.test.mjs` → 13 PASS

## 可复用结论

- 同人新 JWT 必须换票，禁止只 strip（F-001）
```

`ralph_ops finding` is optional and only when there is a 对策. Prefill from a progress bullet if you wrote one; do not invent empty 现象/原因 rows.

### When the task / approach changes

Same `run_id`. Rewrite live Goal / 验收 / Steps to the new contract. Append a dated progress section with what was wrong and what you will do instead. Put the pitfall in findings if it will recur. Leftover runs that still have `### 当前` may move that block to `### 已落地` / `### 已取代` — new runs do not grow those sections.
