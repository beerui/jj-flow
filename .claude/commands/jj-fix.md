---
name: jj-fix
description: 线上问题、回归和异常行为的定位修复入口；强调真实证据、根因和最小修复。
argument-hint: "<现象、时间窗、错误指纹、影响范围>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj-fix

用户输入：$ARGUMENTS

锚定真实页面、时间窗、错误指纹和影响范围。查日志、复现路径、相关代码和历史变更，必要时定位引入点。输出根因机制、引入位置和修复位置，然后做最小范围修复并验证。
