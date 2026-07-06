---
name: jj
description: 兼容入口；把 /jj 或 jj-flow 泛称路由到 /jj-delivery、/jj-fix、/jj-review 等原生命令。
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

这是兼容入口，不是 shell 命令。优先根据用户原始需求路由到 `/jj-delivery`、`/jj-feat`、`/jj-fix`、`/jj-review`、`/jj-knowhow`、`/jj-validate`、`/jj-evolve` 或 `/jj-auto`。

执行时保留原始动机和证据，先找项目资料与 `.workflow` 状态，再调用合适的 Maestro/Claude Code skills。不要要求用户改用终端命令；`npx` 只用于安装或刷新本地命令资产。
