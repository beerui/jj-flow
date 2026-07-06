---
name: jj-auto
description: 自动判断用户意图并选择最合适的 jj-flow 原生命令入口。
argument-hint: "<不确定分类的需求或问题>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj-auto

用户输入：$ARGUMENTS

从原始需求判断任务类型、风险、资料成熟度和是否需要改代码。输出推荐入口与理由，并在用户未反对时直接转入对应 `/jj-*` 工作流。不要把它转换成 shell 命令。
