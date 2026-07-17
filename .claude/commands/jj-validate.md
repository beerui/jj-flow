---
name: jj-validate
description: 维护 jj-flow 项目本身时使用；检查文档、命令资产、测试、路线图和 Maestro 边界是否漂移。
argument-hint: "<自检目标、范围、证据或升级偏好>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj-validate

用户输入：$ARGUMENTS

读取 `.workflow/project.md`、`.workflow/roadmap.md`、`.workflow/state.json`、文档和测试。检查 Codex skills、Claude commands、npm 包文件、安装文档和测试是否一致，并验证 `jj-flow` 仍是 Maestro 上层协议。输出 `PASS`、`PENDING`、`FAIL`、证据路径和下一步建议。**禁止调用 `maestro explore`**。
