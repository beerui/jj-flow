---
name: jj-feat
description: 边界明确的新功能交付入口；适合已有需求、接口和验收标准的小到中型功能。
argument-hint: "<功能目标、接口资料、模块路径、验收标准>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj-feat

用户输入：$ARGUMENTS

明确功能目标、影响模块、接口资料和验收标准。查找相邻实现和项目约定，优先复用既有模式。给出最小实现计划后改代码，并运行聚焦验证。

功能修改验证通过后，调用 `/jj-same` 核对当前项目与分支、列出可同步项目并询问同步决策；没有候选时直接结束。
