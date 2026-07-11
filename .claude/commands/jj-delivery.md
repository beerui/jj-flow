---
name: jj-delivery
description: 少参数端到端交付入口；把需求、资料、关键决策和验收整理成可执行的 Maestro/Claude Code 工作流。
argument-hint: "<需求、PRD、接口、设计、日志、范围、验收>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj-delivery

用户输入：$ARGUMENTS

先还原原始目标、范围、不做范围和验收标准，再自动查找项目上下文、`.workflow` 状态、PRD、接口、设计、日志和历史线程。证据不足的结论保持 `PENDING`。需要通用流程时调用 Maestro/Claude Code skills 完成分析、计划、执行、验证、审查和知识沉淀。

实际修改代码且源项目验证通过后，调用 `/jj-same` 做 post-change discovery：核对项目与分支，列出可同步目标，并询问立即同步、延期或不适用；没有 outgoing sync contract 或同族候选时不打扰用户。

不要通过 shell 执行同名命令；这是 Claude Code 原生 slash command。
