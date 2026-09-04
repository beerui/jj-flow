# Exec plan — Ralph 自动结案（auto-closeout）

> 状态：active
>
> 负责人：jj-flow
>
> 开始日期：2026-09-04
>
> 关联设计：用户指定 SSOT `docs/design-docs/ralph-auto-closeout.md`（2026-09-04 修订 10）。**动手时 `origin/main`（`4dd3f7e`）与全部远端分支均无此文件**；实现按用户实施指令 + 现有 `src/ralph/` 契约落地。设计文档 :108 `\|` → `|`（审查修正 d）待该文件入库后再改。
>
> 前置：工作区布局方案 A 已落地（`completed/` + `events.jsonl` + `writeRalphIndex`，PR #25）；lite 档已关闭。
>
> 边界：不做设计 §4.9 步骤 4（`~/.agents/skills` 清理）与步骤 5（存量 run 补救）。不升 schema。不改 dispatch 检查点。commit 只 stage 本方案文件。

## 0. 基线（§4.9.0）

| 项 | 事实 |
| --- | --- |
| `git status`（动手前） | `main` 干净，与 `origin/main` 同步；**无在途未提交批次** |
| 顺序链 | jj-review Locate → §4.6 → 不破坏 ralph-workspace-layout 双轨（`progress.md` 人读 / `events.jsonl` 机器） |
| 设计文档行号 | 修订 10 不在仓内，无法重核 :373 / :108 / :132 原文；代码锚点按当前 `main`：`archive.mjs:132` `writeRalphIndex`、合约测试 userCmd 自 :361 |

## 目标

accept PASS 之后 **MUST `finalize`**（不是只 `archive` / 只翻 gate）。`status` 两处输出层带 `next`；`phase=ARCHIVE` 且未停进 `completed/` 时给第二道中性告警。`writeRalphIndex` 内部降级，避免主写入成功后命令假报失败。Locate 能找到扁平 `task-*` 与 `completed/`。

## 非目标

- §4.9 步骤 4 / 5
- 自动 `finalize`（不在 accept/close 里偷偷归档）
- 升 schema / 改 dispatch
- 编造缺失的设计文档正文当作 SSOT

## 审查修正（写入本计划，以此为准）

| # | 修正 | 采纳 |
| --- | --- | --- |
| a | `tests/jj-ralph-contract.test.mjs` userCmd marker 数组（:361 起）与 SKILL 数组是独立循环：新 marker 同步加入 userCmd，让「SKILL 变更须同步用户文档」受测试保护 | 是 |
| b | §4.6 硬约束 2 的 try/catch 放在 `writeRalphIndex` **内部**，4 个显式调用点（`archiveRun` / `abandonRun` / `resumeRun` / `migrateRuns`）统一降级 | 是 |
| c | status 告警用中性表述：`phase=ARCHIVE 未完成收尾——先跑 gate/status 核对`（规避 resume 拉回后 rollback 完成前的误报窗口） | 是 |
| d | 设计文档 :108 表格外 code span 的 `\|` 改成 `\|` | **搁置**：文件不在仓内 |

## 执行清单

### 切片 0 — 本计划入库

- [x] `docs/exec-plans/active/2026-09-04-ralph-auto-closeout.md`
- [x] 执行索引 + `scripts/build-docs.mjs` DEEP_PAGES
- [x] CHANGELOG Unreleased 指针（合约结果测完回填）

### §4.1 — finalize MUST + next + 两处输出层 + status 第二道告警

- [x] `computeRalphNext(run, { layout })`：accept PASS 且无 `run.archive` → `next=finalize`；lite 走 brief/deliver/close；full 走五 gate；`phase=ARCHIVE` 且 `layout !== completed` → `warning` 中性句
- [x] `getStatus({ runId })` 附带 `next` / `warning` / `layout` / 原始 `gate_set`
- [x] 输出层 1：`renderRalphStatusText` 打 `next:` / `warning:`
- [x] 输出层 2：`ralph_ops.mjs` `printJson` **单独**写出 `next` / `warning`（`ralph:sync` 不覆盖此文件）
- [x] SKILL：accept PASS 后 MUST finalize（净增 2 行，≤10）

### §4.4 — `gate_set=undefined`

- [x] 文本层：缺字段显示 `undefined`，不再 `|| 'full'`
- [x] `setGate` 返回值不把缺省 `gate_set` 填成 `full`（行为仍走 `effectiveGateSet`）
- [x] `effectiveGateSet` 行为不变（legacy 仍按 full 跑）

### §4.6 + §4.7 — 同批：writeRalphIndex 降级 + Locate 入口

顺序：先 jj-review Locate，再 ralph Locate / index。

- [x] jj-review Locate：活跃 `task-*` + `completed/task-*` + leftover `tasks/` / `archive/` / `RALPH-*`；可走 `jj ralph locate`
- [x] `writeRalphIndex` 内部 try/catch，失败 `{ ok:false, degraded:true }`，不抛
- [x] `jj ralph locate` + `ralph_ops locate` 包 `locateRalphRuns`
- [x] 不改 events.jsonl / progress 双轨写入点

### §4.2 / §4.3 — skill / 用户文档

- [x] `skills/jj-ralph/SKILL.md`（净增 2 行）+ `references/phases.md` Closeout MUST
- [x] `docs/commands/jj-ralph.md`（userCmd 新 marker 必须出现）
- [x] `docs/skill-zh-bridge/jj-ralph/README.zh.md`

### §4.5 — 可选

- [x] 不做（本批不扩自动 finalize / 存量补救）

### §4.8 — 测试

- [x] 合约用例已写（跑测前先 commit）
- [x] `node --test tests/jj-ralph-contract.test.mjs` **55/55**；`npm run ralph:sync` / `ralph:check` in_sync

## 不做

- §4.9 步骤 4：`~/.agents/skills` 清理
- §4.9 步骤 5：存量 run 补救

## 验收

全部完成后依次：`npm run verify` → `git diff --check` → `node src/cli.mjs install-skill --platform all --force`。

验收记录（2026-09-04，本云端 Node 22.14.0）：

| 命令 | 结果 |
| --- | --- |
| `node --test tests/jj-ralph-contract.test.mjs` | 55/55 |
| `node --test tests/*.test.mjs` | 379/379 |
| `npm run ralph:check` | in_sync，15 files |
| `npm run check` / `harness:check` / `harness:gc` / `scenario:check` / `host:trial` / `docs:check` / `evaluated:check` | 通过 |
| `git diff --check` | 干净 |
| `node bin/jj.mjs install-skill --platform all --force` | ok（`node src/cli.mjs` 只加载模块、不跑 CLI） |
| `npm test`（`node --test tests`） | 本环境 Node 22 把 `tests` 当模块，未用此入口 |
| `lab:check` | 既有 `LAB-ROOT-MISSING`（无 sibling gym） |
