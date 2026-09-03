# Exec plan — Ralph 任务工作区 P2+（lite 档）

> 状态：active
>
> 负责人：jj-flow
>
> 开始日期：2026-09-03
>
> 关联设计：[Ralph 任务工作区 `.plans` 化改造](../../design-docs/ralph-plans-workspace.md) §3.8 / §4 P2+
>
> 前置：[P2](../completed/2026-09-02-ralph-plans-workspace-p2.md) 已关闭（`b70f15c` 身份稳定化、`b11d670` review-fix）
>
> 边界：本计划只做设计 §4 的 P2+ lite 档。不改 `task-*` 身份与 `.state/` 布局、不升 schema 大版本、不写业务仓 AGENTS.md / CLAUDE.md、不改 dispatch 检查点语义。整体设计在 lite 落地并补 `> 验收证据：` 之前仍是 Proposed。

## 目标

给小改动一条 BRIEF→DELIVER→CLOSE 路径，同一 `tasks/<task_key>/` 目录、同一三 md + `.state/`。判档错了可以升 full，不换目录、不丢证据。

完成后：`--lite` 新 run 的 `gate_set=lite`，budget `max_deliver_loops ≤ 3`；任一 gate 失败或范围膨胀自动升 full；默认路径仍是五 gate。

## 非目标

- 改 `run_id` / 布局 / schema 1.2 必填键（`gate_set` 已在 1.1 预留）
- 把 `phase` 枚举改成 BRIEF/CLOSE（schema 仍是 ANALYZE|PLAN|DELIVER|ACCEPT|ARCHIVE）
- 把 intensity `tiny` 等同于 lite（正交：tiny 是质量档，lite 是 gate 集合）
- 业务仓库指令文件
- 改 dispatch 协议 / checkpoint
- npm 发布 / 推远端（除非用户明确要求）

## 已锁定（实现时勿重新设计）

| 项 | 口径 |
| --- | --- |
| 默认 | init 仍 `gate_set=full`。显式 `--lite` / `--full` 覆写 |
| 正交 | `intensity`（tiny/standard/strict）与 `gate_set`（full/lite）独立。tiny 不自动变 lite |
| schema | **不升 1.3**。`phase` 仍五值；`gates` 仍五键 `analyze/plan/deliver/accept/archive`。lite 是策略层，不是第二套 ledger |
| 映射 | BRIEF PASS → `analyze=PASS` 且 `plan=PASS`，`phase=DELIVER`。DELIVER 不变。CLOSE PASS → 走现有 accept 机械/判断门，再 `archive=PASS`（可接现有 finalize） |
| 别名 | `setGate` 接受 `brief` / `close`（及现有五键）。`brief`/`close` 不是 schema 新键 |
| 文件 | 同一 `task_plan.md`；Analyze 节允许缩成一句话，不另起模板树 |
| budget | lite：`max_deliver_loops = min(现有, 3)`。升 full 后按当前 intensity 默认值恢复上限（不小于已用次数） |
| 升档 | 任一 lite gate FAIL/BLOCKED，或 `scope.in` 相对 init 膨胀（新增路径/模块），`gate_set` 改 `full`。同目录续写。progress 追一行 `promoted lite→full` |
| 升档优先 | 设计要求「判档错误的兜底必须先落地」：升档逻辑与 `--lite` 同切片，启发式判档可后置 |
| 判档 | 第一刀只认显式 flag。启发式（改动面小、无架构词、单一验收项）单独一刀，默认仍 full |
| dispatch | 零改动 |

## 执行清单

### 切片 0 — 本计划入库

- [x] `docs/exec-plans/active/2026-09-03-ralph-plans-workspace-p2-lite.md`
- [x] 执行索引 + 站点构建清单
- [x] 设计文档加执行指针；索引注明 P2 已落地、P2+ 进行中
- [x] CHANGELOG Unreleased 指针
- [x] `npm run docs:check` 与 `npm run harness:check`

### P2+a — `--lite` 路径 + 升 full 兜底

设计 §3.8。本切片让 lite 能跑通，且判错可恢复。

- [x] CLI / `ralph_ops`：`--lite` / `--full`；`initRun` 写 `gate_set`（`createRunSkeleton.gate_set`，`normalizeGateSet`；无 flag 仍 full，tiny 不改 `gate_set`）
- [x] lite budget 收紧 `max_deliver_loops ≤ 3`（`LITE_MAX_DELIVER_LOOPS` / `applyLiteBudget`）；stagnation fingerprint 仍跑；预算耗尽 BLOCKED 的 `unblock` 提示升 full 出口
- [x] `setGate('brief'|'close')` 别名（`GATE_ALIASES`，仅 `gate_set=lite` 生效）；内部仍写五键，progress 仍按五键写 gate 行（`via=brief|close`）
- [x] CLOSE 复用 `evaluateAcceptArchiveGate`（accept → archive 两跳）+ `evaluateAcceptJudgment`，弱证据 / strict judgment 仍挡；可接现有 finalize
- [x] 升 full：`setGate` / `rollbackPhase` 写出 FAIL/BLOCKED，或 `updateRunScope`（`jj ralph scope --in`）新增 `scope.in` → `promoteGateSetToFull`：`gate_set=full`，`max_deliver_loops` 按 intensity 默认恢复（不小于已用次数），progress 追 `promoted lite→full`；目录 / `run_id` 不变
- [x] 合约：`--lite` init 的 gate_set/budget；brief PASS 推进 DELIVER；close 弱证据仍挡；升档不换 `run_id`（`tests/jj-ralph-contract.test.mjs` 新增 4 个 `P2+a` 用例）
- [x] `npm run ralph:sync` + `ralph:check` + `tests/jj-ralph-contract.test.mjs`（49 pass）

> P2+a 验收证据：`node --test tests/jj-ralph-contract.test.mjs` 49/49；`npm run ralph:check` in_sync；`npm run verify` 除 `lab:check` 外全绿——`lab:check` 在 `main`（`c051f0b`）上同样失败（sibling gym pin `8e51498` 早于 P2 `task-*` 布局：`RALPH-alphahand-*` legacy 报错、`acceptance.md` ENOENT），与本切片无关，需另行更新 gym pin。

### P2+b — 启发式判档 + skill 文案

- [ ] init 无 flag 时按规模建议 lite（保守：拿不准则 full）
- [ ] skill / `docs/commands/jj-ralph.md`：口语「小改 / 顺手修」可走 lite；用户说「完整走一遍」走 full
- [ ] 合约：启发式只建议不强制（无 flag 默认 full，除非命中明确规则）

## 下一刀

P2+a（`--lite` + 升档）已落地。下一刀 P2+b：启发式判档（只建议不强制，默认仍 full）+ skill / `docs/commands/jj-ralph.md` 口语文案。

## 完成定义

- P2+a：`--lite` 新 run `gate_set=lite` 且 `max_deliver_loops ≤ 3`；`brief`/`close` 别名写五键；升 full 同目录；弱证据 CLOSE 仍挡。
- P2+b：无 flag 默认 full；skill 文案区分 lite/full。
- 全计划关闭：两切片勾完，本文件移入 `completed/`，设计 §3.8 / §4 P2+ 标落地，补 `> 验收证据：` 后再把整体设计标 Implemented。
- `npm run verify` + `git diff --check`。不推远端。

## 残留风险

| 风险 | 缓解 |
| --- | --- |
| 把 tiny 当成 lite，五 gate 被静默砍掉 | 正交锁定；无 `--lite` 不得改 `gate_set` |
| schema 加 BRIEF/CLOSE 逼升 1.3 | 别名映射，phase 枚举不动 |
| CLOSE 跳过 accept 证据门 | close 必须走现有 accept/archive 评估器 |
| 升档丢 BRIEF 证据 | 同目录续写；只改 `gate_set` 与未用 gate 的 PENDING |
| 启发式误判大改动进 lite | 升档兜底先落地；启发式默认 full |
