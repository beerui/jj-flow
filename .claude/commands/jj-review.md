---
name: jj-review
description: 交付前质量审查入口；优先找风险、缺陷、缺失测试和证据不足。
argument-hint: "<审查目标、diff、验收标准、风险关注点>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj-review

用户输入：$ARGUMENTS

明确审查范围、验收标准和风险关注点。读取 diff、相关源码、测试和文档，按严重程度输出问题，附文件和证据。没有发现问题时说明剩余测试缺口或残余风险。
