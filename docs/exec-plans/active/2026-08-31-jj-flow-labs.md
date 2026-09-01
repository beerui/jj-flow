# Exec plan — jj-flow 实验场（Loop gym + Family gym）

> 状态：active
>
> 负责人：jj-flow
>
> 开始日期：2026-08-31
>
> 关联设计：[实验场 Loop gym / Family gym](../../design-docs/jj-flow-labs.md)
>
> 边界：文档与后续 sibling 仓；不改 same / ralph / dispatch 检查点语义；不把 gym 放进产品 `labs/`；不改 `evaluateAcceptArchiveGate`；CI 不调模型。

## 目标

落地两个版本化实验项目，证明 jj-flow 能完成真实工程、在红灯处 fail-closed、并关上三条主路径闭环：

| 实验项目 | 推荐仓（与 `jj-flow` 同级） | 主路径 |
| --- | --- | --- |
| Lab 1 · Loop gym | `jj-lab-loop` | ralph + review + end |
| Lab 2 · Family gym | `jj-lab-family` | same + dispatch（源仓可 ralph → handoff） |

## 非目标

见设计 Non-Goals。本计划不创建产品仓 `labs/` 树，不把 live Agent 当默认 `verify`，不发明 Claude `/jj-dispatch`。

## 已决（Q1–Q4）

| # | 决定 |
| --- | --- |
| Q1 | 旁路 sibling 仓，不是 in-tree `jj-flow/labs/` |
| Q2 | `lab:check` 先 opt-in；&lt;20s 再进 `verify` |
| Q3 | MVP attestation `host_id=grok-build` + 真文件；无 `lab-harness` |
| Q4 | 不改 `evaluateAcceptArchiveGate`；假绿由 lab detector 抓 |

## 执行清单

### PR1 — 设计入库（Proposed）

- [x] `docs/design-docs/jj-flow-labs.md`（Proposed；D2 = sibling 仓）
- [x] 设计索引 + 站点构建清单
- [x] 本 exec plan + 执行索引
- [x] `ARCHITECTURE.md` 修改入口
- [x] harness-manifest 权威条目
- [x] CHANGELOG Unreleased 指针
- [x] `npm run docs:check` 与 `npm run harness:check`（本切片验收）

### PR2 — sibling 仓 + 产品 pointer + 发布隔离

- [x] 创建 `jj-lab-loop` / `jj-lab-family`（`lab-manifest.json` pin + `_materialized/` gitignore）
- [x] `docs/jj-lab-siblings.md` + `lab-roots.json.example`；gitignore `lab-roots.json`
- [x] `HNS-PUBLISH-LABS` + `npm pack --dry-run` 不得出现 `labs/`
- [x] **不加** exit-0 的 `lab:check`

### PR3 — Loop gym 种子 + env-print

- [x] `jj-lab-loop` seed / env-print / reset；`loop-gym-control/` 非 git
- [x] 缺 `JJ_LAB_LOOP_ROOT` fail-closed；不写 `~/.jj-flow`

### PR4 — Loop gym 机械 oracle

- [x] L1-S4 / S5 / S6 / S7a；真实 `lab:check` 委派；不进产品 `tests/`

### PR5 — Family gym 种子 + copy/CREATE oracle

- [x] 可与 PR3 并行。形状只在本地 `dev`；fetch 不 merge local `master`

### PR6 — dispatch 机械闭环

- [x] L2-S5 / S6 / S3b；Mode S `grok-build` + session 文件 + T-task-result-sync

### PR7 — handoff ready=false + 假绿 detector

- [x] L2-S3a / L1-S3a；`writeHandoffPackage(..., {port_mode:'FULL'})`

### PR8 — Agent 场景说明书

- [x] 各 lab `scenarios/*.md`；episode 省略 `role`

### PR9 — 可选：`lab:check` 进 verify

- [x] `package.json` `verify` 含 `npm run lab:check`；CI / NPM Publish 在 verify 前 `prepare-lab-roots`（clone sibling 到 `$HOME` 外绝对路径并 seed；Ubuntu 不用 `$HOME` 下的 `$RUNNER_TEMP`）。缺根 fail-closed。Windows CI job 不是本 PR。Live Agent 不阻塞 Implemented（机械）

### PR10 — 协议后续

- [x] `evaluateAcceptArchiveGate` 解析 `evidence_class`：强类 PASS 仅静态证据则挡（`--force` 仍可覆盖）
- [x] dispatch `lab-harness` host_id（Mode S session；**不是** Wave 2 / real-host）
- [x] CI `windows-latest` 独立 job：`prepare-lab-roots` + `npm run lab:check`

## 下一刀

无机械待办。Live Agent 仍为手册 / evaluated。

## 完成定义

- PR1：`docs:check` 与 `harness:check` 绿；设计状态仍为 Proposed。
- 机械实验场 Implemented：PR2–PR7 落地且 `lab:check` 真跑。
- Live Agent 保持 evaluated / 手册，不作为本计划关闭条件。

## 残留风险

| 风险 | 缓解 |
| --- | --- |
| sibling 仓相对协议漂移 | 各 lab `lab-manifest.json` pin；缺 pin oracle FAIL |
| 误把 gym 加进 npm `files` | PR2 `HNS-PUBLISH-LABS` |
| 评审以为 ralph_ops 已拦假绿 | L1-S3a：协议可 PASS；detector 是证据 |
