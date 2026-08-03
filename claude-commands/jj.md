---
name: jj
description: 兼容入口；把 /jj 或 jj-flow 泛称路由到 /jj-same、/jj-ralph、/jj-review、/jj-end 等原生命令。
argument-hint: "<需求、资料、范围或问题>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj

用户输入：$ARGUMENTS

这是兼容入口，不是 shell 命令。权威路由：`skills/jj/SKILL.md`。

路由前只读探测（有则用）：`.workflow/handoff/`、最新 ralph run、控制 plane（有 control 时只读）。

按意图路由（不确定时**先澄清**，不默认 same）：

1. 同源迁移 / handoff / 同步 → `/jj-same`
2. 单仓全流程 / ralph / 归档 / **归档后再改·废弃** → `/jj-ralph`（同 run resume 优先；见 skill 无终态冻结）
3. 单仓审查 / review 落盘 REV（含已归档 run）→ `/jj-review`
4. 收工 / 提交并合入 dev·develop·main → `/jj-end`（**只 Git**，不关死 ralph）
5. 多项目调度 → `$jj-dispatch`（Codex/Qoder/Grok；Claude **无** slash = intentional）
6. 离线评估（experimental）→ `$jj-evaluated`（无 Claude `/jj-evaluated`）

已移除 `/jj-delivery`、`/jj-validate`、`/jj-evolve` 以及更早的 feat/fix/knowhow/auto。

Skill 权威正文只在 `skills/`（多端 SSOT）；本目录仅 Claude 薄入口。改 skill 后需 `jj install-skill --platform all --force`。

保留原始动机和证据；`npx`/`jj` 只用于安装或 `jj ralph *` 机械步骤。
