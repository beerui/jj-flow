# Exec plan — Ralph 自动结案（auto-closeout）

> 状态：completed
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
| 第二批动手前 | `origin/main` 已含 `d377acb`（PR #30 MERGED）；工作区干净 |
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

- [x] 本文件 + 执行索引 + `scripts/build-docs.mjs` DEEP_PAGES
- [x] CHANGELOG Unreleased 指针

### §4.1 / §4.4 / §4.6 / §4.7 / §4.2 / §4.3

- [x] 第一批已合入 PR #30 / `d377acb`

### §4.5 — 可选

- [x] locate 行带 `next` / `warning` / `closeout`（不自动 finalize）

### §4.8 — 测试

- [x] 第一批合约 55/55（合入时）
- [x] 本批：`tests/jj-ralph-contract.test.mjs` **56/56**；`tests/install-skill.test.mjs` 含 agents 用例；全量 `node --test tests/*.test.mjs` **381/381**

### §4.9 步骤 4 — `~/.agents/skills` 清理

- [x] `--platform agents` / `all` 写入 `~/.agents/skills` + `commands`（`--project` → `.agents/…`）
- [x] 安装时删除该目标 retired 资产
- [x] 本环境 `node bin/jj.mjs install-skill --platform all --force`：目标含 `/home/ubuntu/.agents/skills` 与 `commands`；`jj-ralph` 已写入；无 retired

### §4.9 步骤 5 — 存量 run 补救

- [x] `jj ralph remediate` 默认 dry-run；`--yes` 只处理 `finalize` + `migrate`
- [x] 本仓 `node bin/jj.mjs ralph remediate --json` → `count=0`（无存量）

## 验收

| 命令 | 结果 |
| --- | --- |
| `node --test tests/jj-ralph-contract.test.mjs` | 56/56 |
| `node --test tests/*.test.mjs` | 381/381 |
| `npm run ralph:check` | in_sync，15 files |
| `npm run check` / `harness:check` / `harness:gc` / `scenario:check` / `host:trial` / `docs:check` / `evaluated:check` | 通过 |
| `git diff --check` | 干净 |
| `node bin/jj.mjs install-skill --platform all --force` | ok；含 `~/.agents/skills` + `commands` |
| `node bin/jj.mjs ralph remediate --json` | `count=0` |
| `npm test`（`node --test tests`） | 本环境 Node 22 把 `tests` 当模块，未用此入口 |
| `lab:check` | 既有 `LAB-ROOT-MISSING`（无 sibling gym） |

## 残留风险

| 风险 | 缓解 |
| --- | --- |
| 修订 10 原文若日后入库，行号与补录文档不对齐 | 补录标明来源；不以聊天当修订 10 |
| `remediate --yes` 对 resume 窗口误 finalize | 只处理 `closeout=finalize`；`check` 不动 |
| `--platform all` 现在多写 `~/.agents` | 与 AGENTS.md 用户级发现路径对齐；retired 安装时删 |
