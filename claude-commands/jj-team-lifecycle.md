---
name: jj-team-lifecycle
description: 固定角色 SDLC 会话引擎（规格→计划→实现→测审）；不推进 ralph/dispatch 检查点。
argument-hint: "<任务描述 | --pipeline spec-only|impl-only|full-lifecycle | check | resume | revise …>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - Agent
  - AskUserQuestion
  - TeamCreate
  - TeamDelete
  - SendMessage
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---

# /jj-team-lifecycle

用户输入：$ARGUMENTS

固定 SDLC 执行引擎：分析 → 固定角色流水线 → CHECKPOINT → 交付产物。  
Session：`.workflow/.team/TLV4-*/`。权威 skill：`skills/jj-team-lifecycle/`。

## 执行要点

1. 加载 skill `jj-team-lifecycle`（含 `roles/coordinator/role.md`）。
2. **直接调用**：无强制提示。仅嵌套在 ralph/review/dispatch 时一句：`开启 lifecycle 模式，开始任务XXX 约 20-45分钟`。
3. **禁止**用 lifecycle 结果直接改 ralph gate / dispatch。
4. 动态多角色用 `/jj-team-coordinate`；对抗搜索用 `/jj-team-swarm`。
5. 命令：`check` / `resume` / `revise` / `feedback` / `improve`；可选 `--pipeline`。

细则：skill `SKILL.md` + `docs/design-docs/jj-team-lifecycle.md`。
