# Exec plan — Ralph 自动结案（auto-closeout）

> 状态：active
>
> 负责人：jj-flow
>
> 开始日期：2026-09-04
>
> 关联设计：[Ralph 自动结案](../../design-docs/ralph-auto-closeout.md)（仓内补录；**不是**修订 10 原文。审查修正 d：表格外 code span 用 `|`）。
>
> 前置：工作区布局方案 A 已落地（`completed/` + `events.jsonl` + `writeRalphIndex`，PR #25）；lite 档已关闭。主路径已合入 `main`（PR #30 / `d377acb`）。
>
> 边界：不升 schema。不改 dispatch 检查点。不自动 finalize（accept/close 不偷偷归档；`remediate` 无 `--yes` 只列）。commit 只 stage 本方案文件。

## 0. 基线（§4.9.0）

| 项 | 事实 |
| --- | --- |
| 第一批动手前 | `main` 干净，与 `origin/main`（`4dd3f7e`）同步；无在途未提交批次 |
| 本批动手前 | `origin/main` 已含 `d377acb`（PR #30 MERGED）；工作区干净 |
| 顺序链 | jj-review Locate → §4.6 → 不破坏 ralph-workspace-layout 双轨（`progress.md` 人读 / `events.jsonl` 机器） |

## 目标

accept PASS 之后 **MUST `finalize`**。`status` 两处输出层带 `next`；`phase=ARCHIVE` 且未停进 `completed/` 时给第二道中性告警。`writeRalphIndex` 内部降级。Locate 能找到扁平 `task-*` 与 `completed/`，并带 `next` / `closeout`。`--platform all` 覆盖 `~/.agents/skills` + `commands` 并清 retired。存量 run 用 `jj ralph remediate` 干跑 / `--yes` 补救。

## 非目标

- 自动 `finalize`（不在 accept/close 里偷偷归档；`closeout=check` 不自动动）
- 升 schema / 改 dispatch
- 把聊天或推断写成「修订 10 原文」

## 审查修正（写入本计划，以此为准）

| # | 修正 | 采纳 |
| --- | --- | --- |
| a | `tests/jj-ralph-contract.test.mjs` userCmd marker 数组与 SKILL 数组是独立循环：新 marker 同步加入 userCmd | 是 |
| b | §4.6 硬约束 2 的 try/catch 放在 `writeRalphIndex` **内部** | 是 |
| c | status 告警用中性表述：`phase=ARCHIVE 未完成收尾——先跑 gate/status 核对` | 是 |
| d | 设计文档表格外 code span 的 `\|` 改成 `|` | 是（补录文档按此写；修订 10 原文仍不在仓） |

## 执行清单

### 切片 0 — 本计划入库

- [x] `docs/exec-plans/active/2026-09-04-ralph-auto-closeout.md`
- [x] 执行索引 + `scripts/build-docs.mjs` DEEP_PAGES
- [x] CHANGELOG Unreleased 指针（合约结果测完回填）

### §4.1 — finalize MUST + next + 两处输出层 + status 第二道告警

- [x] `computeRalphNext` / `getStatus` / `renderRalphStatusText` / `ralph_ops printJson`
- [x] SKILL：accept PASS 后 MUST finalize

### §4.4 — `gate_set=undefined`

- [x] 文本层缺字段显示 `undefined`；`effectiveGateSet` 行为不变

### §4.6 + §4.7 — writeRalphIndex 降级 + Locate 入口

- [x] `writeRalphIndex` 内部 try/catch
- [x] `jj ralph locate` + jj-review 覆盖 `task-*` / `completed/`

### §4.2 / §4.3 — skill / 用户文档

- [x] SKILL / phases / `docs/commands/jj-ralph.md` / zh-bridge（第一批）

### §4.5 — 可选（本批补）

- [x] locate 行带 `next` / `warning` / `closeout`（不自动 finalize）

### §4.8 — 测试

- [x] 第一批合约（合入时 55/55）
- [ ] 本批：locate 注释 + remediate + `--platform agents`（测完回填）

### §4.9 步骤 4 — `~/.agents/skills` 清理（本批）

- [ ] `--platform agents` / `all` 写入 `~/.agents/skills` + `commands`（`--project` → `.agents/…`）
- [ ] 安装时删除该目标 retired 资产
- [ ] 本环境跑 `jj install-skill --platform all --force`

### §4.9 步骤 5 — 存量 run 补救（本批）

- [ ] `jj ralph remediate` 默认 dry-run；`--yes` 只处理 `finalize` + `migrate`
- [ ] 本仓 `remediate` 干跑记录（无存量则 count=0）

## 验收

全部完成后依次：`npm run verify` → `git diff --check` → `node src/cli.mjs install-skill --platform all --force`。

### 第一批（已合入 `d377acb`）

| 命令 | 结果 |
| --- | --- |
| `node --test tests/jj-ralph-contract.test.mjs` | 55/55 |
| `node --test tests/*.test.mjs` | 379/379 |
| `npm run ralph:check` | in_sync，15 files |
| `lab:check` | 既有 `LAB-ROOT-MISSING`（无 sibling gym） |

### 第二批（本批，测完回填）

| 命令 | 结果 |
| --- | --- |
| `node --test tests/jj-ralph-contract.test.mjs` | 待跑 |
| `tests/install-skill.test.mjs` | 待跑 |
| `npm run verify` | 待跑 |
