# Ralph 自动结案（auto-closeout）

> 状态：Implemented
>
> 验收证据：`tests/jj-ralph-contract.test.mjs`、`tests/install-skill.test.mjs`、PR #30（`d377acb`）
>
> 来源：用户 2026-09-04 指定 SSOT 路径为本文件（修订 10）。**修订 10 原文从未入库**（`origin/main` 与全部远端分支均无此文件）。本文按 PR #30 实现事实 + 当日实施指令补录，并纳入随后独立批次的 §4.5 / §4.9 步骤 4–5。不把聊天记录写成修订 10。审查修正 d：表格外 code span 写 `|`，不要写成 `\|`。

## 1. 目标

accept PASS 之后 **MUST `finalize`**（map-merge + 归档进 `completed/`），不是只翻 archive 门、也不是只 `archive`。`status` 两处输出层带下一步；`phase=ARCHIVE` 仍停在活跃根时给第二道中性告警。Locate 能找到扁平 `task-*` 与 `completed/`。index 写入失败不得让主路径假失败。

## 2. 非目标

- 不在 `accept` / `close` 里偷偷 `finalize`
- 不升 schema、不改 dispatch 检查点
- resume 拉回后、rollback 完成前的窗口不报「必须立刻 finalize」（只提示核对）

## 3. 硬约束

| # | 约束 |
| --- | --- |
| 1 | `ralph_ops.mjs` 是 skill SSOT；`ralph:sync` 不覆盖它。`next` / `warning` 必须单独改它的 `printJson` |
| 2 | `writeRalphIndex` 内部 try/catch，`archiveRun` / `abandonRun` / `resumeRun` / `migrateRuns` 四个显式调用点统一降级 |
| 3 | status 告警用中性句，规避 resume → rollback 前的误报窗口 |
| 4 | 新 status marker 必须同时进 SKILL 与 `docs/commands/jj-ralph.md`（两套独立断言） |

缺省 `gate_set` 在文本层显示 `gate_set=undefined`（竖线是字面量）。行为仍走 `effectiveGateSet`（legacy 当 full）。

## 4. 切片

### 4.1 finalize MUST + next + 两处输出层 + 第二道告警

`computeRalphNext(run, { layout })`：

- accept PASS 且无 `run.archive` → `next=finalize`
- lite 走 brief / deliver / close；full 走五 gate
- `phase=ARCHIVE` 且 `layout !== completed` → `warning` = `phase=ARCHIVE 未完成收尾——先跑 gate/status 核对`
- 已停进 `completed/` 且 COMPLETED → `next` / `warning` 皆空
- resume 拉回后 `next=check`（先核对，不催 finalize）

输出层 1：CLI `renderRalphStatusText` / `--json`。  
输出层 2：`ralph_ops.mjs` `printJson`。

### 4.2 / 4.3 skill 与用户文档

SKILL：accept PASS 后 MUST finalize。用户文档与 zh-bridge 同步同一批 marker。

### 4.4 `gate_set=undefined`

文本层缺字段显示 `undefined`，不再 `|| 'full'`。`setGate` 返回值不把缺省填成 `full`。

### 4.5 可选：locate 带 next / warning

`jj ralph locate`（及 `ralph_ops locate`）每行附带 `next`、`warning`、`closeout`。  
`closeout=finalize` 表示可以机械收尾；`closeout=check` 只提示核对（resume 窗口）；`closeout=migrate` 走布局迁移。  
**不**在 locate 里自动 finalize。

### 4.6 / 4.7 writeRalphIndex 降级 + Locate

`writeRalphIndex` 失败返回 `{ ok:false, degraded:true }`，不抛。  
Locate 覆盖活跃 `task-*`、`completed/task-*`、leftover `tasks/` / `archive/` / `RALPH-*`。jj-review Locate 可走 `jj ralph locate`。  
不改 `events.jsonl` / `progress.md` 双轨写入点。

### 4.8 测试

`tests/jj-ralph-contract.test.mjs`：next / warning / `gate_set=undefined` / index 降级 / locate / remediate。  
`tests/install-skill.test.mjs`：`--platform agents` 与 `--platform all` 写入 `~/.agents/skills` + `commands`，并清掉 retired。  
userCmd marker 数组与 SKILL 数组是独立循环：新 marker 必须两边都加。

### 4.9 落地顺序

0. `git status` 核在途批次；本方案 commit 只 stage 本方案文件。顺序链：jj-review Locate → §4.6 → 工作区双轨。
1. exec plan 入库。
2. 按 §4.1 → §4.4 → §4.6+§4.7 → §4.2/§4.3 → §4.5。
3. 验证：`node --test tests/jj-ralph-contract.test.mjs`；全部完成后 `npm run verify` → `git diff --check` → `jj install-skill --platform all --force`。
4. **`~/.agents/skills` 清理**：`--platform all`（及 `--platform agents`）把当前 skill / 薄命令装到 `~/.agents/skills` 与 `~/.agents/commands`（`--project` 则是仓内 `.agents/…`）。安装时删除该目标上的 retired jj-flow 资产（`jj-auto` / `jj-validate` 等），避免旧副本继续被 AGENTS.md 用户级发现路径读到。
5. **存量 run 补救**：`jj ralph remediate` 默认 dry-run，列出 `closeout=finalize|migrate`。加 `--yes` 时：先 `migrateRuns` 收布局残骸，再对 `next=finalize` 的 run 调 `finalizeRun`。`closeout=check` 不自动动。

## 5. 实现指针

| 项 | 路径 |
| --- | --- |
| next / warning | `src/ralph/state.mjs` `computeRalphNext` |
| status | `src/ralph/gates.mjs` `getStatus`；`renderRalphStatusText` |
| locate 注释 | `locateRalphRuns` |
| remediate | `src/ralph/archive.mjs` `remediateCloseout` |
| agents 宿主 | `src/installSkill.mjs` platform `agents` |
| skill 出口 | `skills/jj-ralph/scripts/ralph_ops.mjs` |
