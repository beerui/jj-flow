---
name: jj-same
description: 基于会话 ID、需求、handoff snapshot、分支、commit 或 diff，首次迁移同源项目功能，或按上次成功基线持续同步后续更新、修复和需求变更。
argument-hint: "<准备交接、handoff_ref、更新交接、首次迁移或 sync_key、当前需求、源/目标项目、分支、commit 或 diff>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj-same

User: $ARGUMENTS

Authoritative procedure: `skills/jj-same/SKILL.md` (multi-host SSOT). This file is a thin Claude entry only.

Mandatory pointers:

1. **Ralph-handoff-first**：用户只说「交接到…」时，优先读当前/最新 ralph `run.handoff`（或 handoff 镜像）；不要要求用户手填路径。
2. **双门禁**：`EXECUTION_READY` 才改业务代码；`HANDOFF_READY` 才宣称交接完成（细则见 SSOT）。
3. **证据优先**：Git / 源码 / 产物优先于聊天摘要；不足则 `BLOCKED` / caveat，不 invent。
4. **控制面**：有 control project 时**只读** manifest / 批准的 targets / `task_key`；家族计划 ≠ dispatch 批准，无 control 不伪造成调度。
5. **代码工具**：Read / Glob / Grep / Bash / `rg`；不整分支 cherry-pick、不整文件覆盖。

Do not expand this file into full lifecycle/gates workflow — keep logic in the SSOT skill.
