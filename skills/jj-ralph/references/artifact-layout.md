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
    assignments/                  # 客服派单：子代理只读取这些文件，不读取聊天
      ASSIGNMENT-TASK-<n>.md      # 读这些 / 交这些 / 不要改那些 / 做完等下一轮
      ASSIGNMENT-REVIEW-<n>.md    # 审查派单（只读源码）
      ASSIGNMENT-RESEARCH-<target>.md   # 交接调研（只读目标仓）
      ASSIGNMENT-HANDOFF-<target>.md    # 交接实施（人设提示词后 spawn）
    reviews/review-<slice>/findings.md  # 人读审查：[OK]/[WARN]/[BLOCK] + HIGH/MEDIUM/LOW
    .state/
      run.json
      events.jsonl                # machine SSOT (gate / deliver-attempt / review / …)
      reviews/REV-*.json          # 门禁双写
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
4. Scripts: `scripts/ralph_ops.mjs` (mechanical CLI only; conversational path never runs it). Syntax: `jj ralph --help`
5. `task-*` ≠ control-plane `DEL-*` / dispatch `task_key`
6. Live runs sit at `.workflow/ralph/task-*`. `archive` / `abandon` rename into `completed/`; `resume` lifts back and opens a new progress round. Leftover `archive/` folders are historical 1.0 snapshots — `jj ralph migrate --prune-archive` dry-runs removal, `--yes` deletes. Active leftover `RALPH-*` dirs fail load/gate/save until `jj ralph migrate`
7. Intent is the Goal paragraph. No empty `## 存疑` at init unless `--intent`. `tiny` skips empty `## 存疑` at init unless `--intent`. Unconfirmed requirement / analyze-hold still write `## 存疑` and ask first (`tiny` is not exempt). Conversational path never `--lite`; `tiny` does **not** drop gates. Same requirement resume keeps Goal; a truly new requirement may get a new run
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

Optional `## 存疑` for analyze-hold (「先不写代码」) and for an unconfirmed requirement (ask first; do not invent). Do not add 分析 / 必须项 / 已落地 / evidence_class tables unless a leftover run already has them.

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

`resume` / approach change: append `## YYYY-MM-DD — resume` plus the reason. `scope --replace-in` appends `## YYYY-MM-DD — assignment` and resets the deliver-attempt counter (new 客服 slice on the same `run_id`). Do not stamp a stub `进行中` — progress is append-only, so a placeholder can never be filled in. Write a result line only when there is a real outcome. Never rewrite an earlier date section.

### File shape (`assignments/ASSIGNMENT-TASK-<n>.md`)

Exclusive spawn input. Copy this 客服 shape. The subagent must not read the parent chat.

```markdown
# 派单：Task n — <slice title>

来自 team-lead。Task n-1 已完成。本 slice **只做**下列交付，**不要**开始 Task n+1。
请先一句话确认目标理解与第一步，再开工。

## 读这些
1. `path/plan.ts`（参考，**不要改**）
2. `path/a.ts`

## 交付
1. `path/a.ts` — …
2. 单测 `path/a.test.ts` — …
3. 更新本任务 `progress.md` + `findings.md`

## 不要改
- `path/other.ts`
- 不要 commit（等 team-lead）

## 验证
- `<repo verify command>`

完成后向 team-lead 短句汇报（做了什么 / 路径 / 可验证证据），等 Task n+1。
```

### File shape (`assignments/ASSIGNMENT-REVIEW-<n>.md`)

```markdown
# 派单：Review — <slice>

来自 team-lead。Task 0–n 已完成。请做大功能代码审查。不要改业务代码。不要调用宿主 `/review`。

## 范围（只读源码；可写本审查目录）
- `path/a.ts`
- `path/a.test.ts`
- **确认未改** `path/other.ts`

## 检查维度
标准：类型安全、null 处理、API 契约匹配、回归。安全问题标 CRITICAL。

## 产出格式
写 `reviews/review-<slice>/findings.md`。
HIGH / MEDIUM / LOW + `file:line`；结论 `[OK]` / `[WARN]` / `[BLOCK]`。

完成后短句回报 team-lead。不要开始修代码。
```

### File shape (`assignments/ASSIGNMENT-FIX-<id>.md`)

Same `run_id`. Used after `[BLOCK]` or user 「按审查改」. Do not init a review-fix task.

```markdown
# 派单：修审查 <id>（+ 可选 MEDIUM）

来自 team-lead。Reviewer 结论 **[BLOCK]** / **[WARN]**，见 `reviews/review-<slice>/findings.md`。
请先一句话确认，再开工。

## 必修
### H-1 — <title>
`file:line` … 改法：…

## 不要
- 改派单未列的文件
- commit（等 team-lead）

## 验证
- `<repo verify command>`
- 更新 progress/findings

完成后短句回报 team-lead。
```

### File shape (`assignments/ASSIGNMENT-RESEARCH-<target>.md` / `ASSIGNMENT-HANDOFF-<target>.md`)

Same `run_id` family, **target repo** Ralph. Conversational `$jj-same` / dispatch-approved port. Research is read-only; implement spawn includes 人设提示词. Shapes live with jj-same (do not open from the ralph SKILL entry).

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

Same `run_id`. Rewrite live Goal / 验收 / Steps to the new contract (the current assignment). Append a dated progress section with what was wrong and what you will do instead. `scope --replace-in` is the mechanical new-assignment signal. Put the pitfall in findings if it will recur. Leftover runs that still have `### 当前` may move that block to `### 已落地` / `### 已取代` — new runs do not grow those sections.
