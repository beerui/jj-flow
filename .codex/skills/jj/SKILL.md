---
name: jj
description: 兼容入口；jj-flow 项目族编排工作流的路由层，把 $jj / /jj 转到 jj-same、jj-ralph、jj-review、jj-end、jj-dispatch（宿主支持时）或 experimental 的 jj-evaluated。
---

# jj

## 定位

`jj` 是兼容入口，不是终端命令入口。正式使用主推原生 skill：

| 宿主 | 入口 |
| --- | --- |
| Codex / Qoder / Grok | `$jj-same` / `$jj-ralph` / `$jj-review` / `$jj-end` / `$jj-dispatch`；experimental `$jj-evaluated` |
| Claude Code | `/jj-same` / `/jj-ralph` / `/jj-review` / `/jj-end`（**无** `/jj-dispatch`、**无** `/jj-evaluated` — intentional） |

## 路由前检查（只读）

在选定目标 skill 前，尽量探测（有则读，无则跳过，不 invent）：

1. 用户原始意图与范围（单仓 / 多仓 / 收工 / 审查 / 调度）
2. 若存在：`.workflow/handoff/`、当前或最新 ralph `run.json`（含 `run.handoff`）
3. 若存在：控制项目 manifest / 批准快照（**只读**；无 control 不伪造成 dispatch）
4. 分支 / commit / 工作区脏状态是否与意图一致

## 路由优先级

```text
1. 同源多仓迁移 / handoff 消费 / sync_key / 持续同步     → $jj-same  （Claude: /jj-same）
2. 多目标批准 / delivery_id / task_key / 控制项目调度     → $jj-dispatch（Codex/Qoder/Grok；Claude 无 slash）
3. 单仓 ANALYZE→ARCHIVE 闭环 / 能力地图 / 验收归档 / **归档后再改·废弃** → $jj-ralph （Claude: /jj-ralph）
4. 单仓只读审查 / 落盘 REV-*.json（含已 soft-archive 的最新 run） → $jj-review（Claude: /jj-review）
5. 单仓 git 收工：commit → push work → merge integration → $jj-end   （Claude: /jj-end；**不**关死 ralph）
6. 离线 episode 评估（experimental）                     → $jj-evaluated（无 Claude command）
7. 不确定                                                → 先澄清意图（不默认 same）
```

决策提示：

- 迁移/家族/handoff → same；多项目批准/派发 → dispatch；单仓做到验收 **或归档后续作/abandon** → ralph（**同 run resume 优先**）；只审不改 → review；收工合入 → end（Git only）；离线复盘 → evaluated
- `jj-dispatch`：**Codex / Qoder / Grok** install；**无 Claude slash = intentional**（勿写「仅 Codex」）
- `jj-evaluated`：experimental；**禁止**虚构 `/jj-evaluated` Claude 命令

## 执行契约

1. 先保留用户原始需求和动机，不把需求改写成固定 CLI 参数。
2. 优先读取项目资料、`.workflow` 状态、会话、handoff、ralph 地图、分支与 commit 证据。
3. 代码定位使用 Read、Glob、Grep、Bash 或已批准 skill。
4. 不通过 shell 执行 `jj-same` 等同名对话命令；`npx`/`jj` 用于安装资产或 `jj ralph *` 机械步骤。
5. 证据不足时保持 `PENDING`/`BLOCKED`，只在会改变交付结果的地方追问用户。

## 已移除

`$jj-delivery` / `$jj-validate` / `$jj-evolve` / `$jj-feat` / `$jj-fix` / `$jj-knowhow` / `$jj-auto`。
