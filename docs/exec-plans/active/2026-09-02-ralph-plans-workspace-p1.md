# Exec plan — Ralph 任务工作区 P1（拆分 + 布局 8→4 + 归档反转）

> 状态：active
>
> 负责人：jj-flow
>
> 开始日期：2026-09-02
>
> 关联设计：[Ralph 任务工作区 `.plans` 化改造](../../design-docs/ralph-plans-workspace.md)
>
> 边界：本计划只做设计 §4 的 P1a / P1b / P1c。不改 run_id 为 `task-*`（P2）、不做 lite 档（P2+）、不写业务仓 AGENTS.md / CLAUDE.md。P1a 行为零变化。

## 目标

在 P0 热层已落地的前提下，把 `src/ralph.mjs` 拆成可继续生长的模块，再把活跃 run 从 8 文件布局收成 4 文件（`task_plan.md` / `progress.md` / `findings.md` / `.state/`），最后把 archive 从复制改成原地翻转。

P0 前提（已合入 `main`）：`eb4e34c` 热层闭环、`0fb5e6f` 审查修复。热层文件仍是 `src/memoryHotLayer.mjs`；P1a 把它并入 `knowledge.mjs` 只做 import 搬家，不改行为。

## 非目标

- P2 稳定 `task_key` / `run_id` 合一 / `ralph migrate` / `jj ralph adopt`
- P2+ lite 档（BRIEF→DELIVER→CLOSE）
- 业务仓库指令文件
- 把 KB 从 opt-in 升成默认闭环
- 改 dispatch 检查点语义（§3.10：协议层零破坏）

## 执行清单

### 切片 0 — 本计划入库

- [x] `docs/exec-plans/active/2026-09-02-ralph-plans-workspace-p1.md`
- [x] 执行索引 + 站点构建清单
- [x] 设计文档加执行指针；索引注明 P0 已落地、P1 进行中
- [x] CHANGELOG Unreleased 指针
- [x] `npm run docs:check` 与 `npm run harness:check`

### P1a — 模块拆分（行为零变化）

设计 §3.9。`src/ralph.mjs` 现约 2748 行。拆分是**移动不是重写**。

| 模块 | 职责 |
| --- | --- |
| `src/ralph/state.mjs` | run.json 读写、校验、listRuns、status/metrics、强度/budget/stagnation 骨架 |
| `src/ralph/gates.mjs` | setGate / rollback / evaluateAcceptArchiveGate / deliver-attempt / ledger 与证据 |
| `src/ralph/archive.mjs` | archiveRun / finalizeRun / 归档目录名 |
| `src/ralph/knowledge.mjs` | 热层 promote/finding/confirm/prune + contribution + review 写回 |
| `src/ralph/map.mjs` | business-map merge / elevation / map-find |
| `src/ralph.mjs` | 门面 re-export；CLI 与既有 import 路径不破坏 |

- [x] 新建 `src/ralph/` 五模块；`ralph.mjs` 只 re-export
- [x] `scripts/sync-ralph-skill-lib.mjs` files 清单扩展；skill `scripts/lib/ralph/` 逐字节跟随
- [x] `tests/jj-ralph-contract.test.mjs` 逐字节断言清单同步
- [x] 单模块目标 300–600 行；超限在本切片注释接受原因，禁止回填门面（gates/knowledge 超限：ledger+handoff 必须留在 gates，contribution+review 必须留在 knowledge）
- [x] `npm run ralph:check` + `tests/jj-ralph-contract.test.mjs` + `tests/memory-hot-layer.test.mjs` 行为不变

### P1b — 布局 8→4

设计 §3.3 / §3.4 / §3.6 / §3.10 表 B1 / §3.11。

- [ ] `task_plan.md` 三 section（分析 / 计划 / 验收）；init 只写中文段名
- [ ] 停写 `knowledge-attach.json` / `knowledge-contribution.json`；home ingest 链显式降级（§3.6）
- [ ] schema 1.1：`artifact_refs.findings`、`knowledge.memory_refs`、`gate_set` 预留；skill schema 副本同步
- [ ] `LEDGER_PATH_EXCLUDE` 加入 `task_plan.md` / `findings.md`
- [ ] `artifact_refs` 禁锚点；`readRunArtifactText` 解析失败抛错（防合规 gate 静默放行）
- [ ] `extractMarkdownSection(text, heading, level)` 层级感知；Current 提取两跳：`计划`(2) → `当前`(3)
- [ ] 读端四级回退：`当前` → `Current` → `Tasks` → 全文；存量英文标题仍能提取
- [ ] jj-review 四文件读取改三 section；段名常量同批；`agents/jj-workflow-reviewer.toml` 对照段名
- [ ] `tests/jj-ralph-contract.test.mjs`：骨架中文段名、`:237` 假绿断言改掉、存量英文 Current 回退用例

### P1c — 归档反转

设计 §3.5 / §4 P1c。

- [ ] 原地翻转 + `archive` / `archive_history` 内联；停写 `archive-manifest.json`
- [ ] `skills/jj-ralph/references/phases.md` 文案
- [ ] `jj-ralph-contract` 归档用例：活跃目录仍可 resume；历史快照只读

## 下一刀

P1b：布局 8→4 + schema 1.1。不改 run_id，不写业务仓指令文件。

## 完成定义

- P1a：`ralph:check` in_sync；ralph / hot-layer 合约绿；对外 export 集合不变。
- P1b：schema 1.1 + 新布局 init；存量英文标题可读；jj-review 能评新布局；`npm run verify` + `git diff --check`。
- P1c：不再写 `archive-manifest.json`；归档合约绿。
- 全计划关闭：三切片勾完，本文件移入 `completed/`，设计文档 P1 段标落地；P2 另开 exec plan。

## 残留风险

| 风险 | 缓解 |
| --- | --- |
| 拆分时漏 re-export 导致 skill/CLI 断 import | P1a 以现有 `export function` 清单做差集测试 |
| 扁平放宽 `#{2,3}` 截断 Current | 禁止；必须层级感知（设计 §3.11 已实测推翻扁平方案） |
| 合规 gate 把工作区文件名当业务路径 | P1b 同步 `LEDGER_PATH_EXCLUDE` |
| ref 解析失败返回空串 → 静默放行 | P1b 改抛错 + 合约 |
| jj-review 漏改段名 / run_id 校验 | P1b 与表 B7 同批；P2 才改 run_id 正则 |
