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

用户输入：$ARGUMENTS

权威流程：`skills/jj-same/SKILL.md`（多宿主 SSOT）。本文件仅为 Claude 薄入口。
派单协议见 `skills/jj/references/assignment-spawn.md`，此处不再重复。

要点：

1. **Ralph-handoff-first**：用户只说「交接到…」时，优先读当前/最新 ralph `run.handoff`（或 handoff 镜像）；不要要求用户手填路径。
2. **写面**：迁入**目标仓** `.workflow/ralph/task-<slug>/`；禁止把 ANL 正文写入 `~/.jj-flow`。
3. **双门禁**：`EXECUTION_READY` 才改业务代码；`HANDOFF_READY` 才声称交接完成（细则见 SSOT）。
4. **证据优先**：Git / 源码 / 产物优先于聊天摘要；不足则 `BLOCKED` / caveat，不臆造。
5. **控制面**：有 control project 时**只读** manifest / 批准的 targets / `task_key`；家族计划 ≠ dispatch 批准，无 control 不伪造成调度。
6. **代码工具**：Read / Glob / Grep / Bash / `rg`；不整分支 cherry-pick、不整文件覆盖。
7. **对话路径**：写本轮 ASSIGNMENT-RESEARCH / ASSIGNMENT-HANDOFF，目标仓调研后再 spawn（匹配的派单前缀 + 独占文件）。不要在父会话中修改业务代码。

不要把这个文件扩写成完整生命周期或门禁流程，逻辑留在 SSOT skill。
