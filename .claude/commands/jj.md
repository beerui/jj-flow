---
name: jj
description: 兼容入口；把 /jj 或 jj-flow 泛称路由到 /jj-same、/jj-ralph 等原生命令。
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

这是兼容入口，不是 shell 命令。按优先级路由：

1. 同源迁移 / handoff / 同步 → `/jj-same`
2. 单仓全流程闭环 / ralph / 归档 / 能力地图 → `/jj-ralph`
3. 单仓审查 / review 落盘 REV → `/jj-review`
4. 收工 / 提交并合入 dev·develop·main → `/jj-end`
5. 多项目调度在 Codex 等宿主用 `$jj-dispatch`（Claude 侧无对等 slash）
6. 不确定时默认 `/jj-same`

已移除 `/jj-delivery`、`/jj-validate`、`/jj-evolve` 以及更早的 feat/fix/knowhow/auto。

Skill 权威正文只在 `.codex/skills/`（多端 SSOT）；本目录仅 Claude 薄入口。改 skill 后需 `jj install-skill --platform all --force`。

保留原始动机和证据；`npx`/`jj` 只用于安装或 `jj ralph *` 机械步骤。
