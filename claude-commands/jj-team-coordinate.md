---
name: jj-team-coordinate
description: 会话内多角色团队编排（动态 role-spec）；不推进 ralph/dispatch 检查点。
argument-hint: "<任务描述 | check | resume | revise …>"
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

# /jj-team-coordinate

用户输入：$ARGUMENTS

会话多角色执行引擎：分析 → 动态 role-spec → 派工 → 交付。  
Session：`.workflow/.team/TC-*/`。权威 skill：`skills/jj-team-coordinate/`。

## 执行要点

1. 加载 skill `jj-team-coordinate`（含 `roles/coordinator/role.md`）。
2. **派工前必须告诉用户**：为什么用 team、当前在做什么、预计用时（见 `references/user-transparency.md`）。
3. **禁止**用 team 完成结果直接改 ralph gate / dispatch manifest。
4. Worker 优先 `team-worker`；Codex 等无则 `general-purpose` + `tasks.json`（`references/host-codex.md`）。
5. 无 maestro 时用 `.msg/` 文件总线；Codex 常需用户 `resume` 推进。
6. 命令：`check` / `resume` / `revise` / `feedback` / `improve`。

细则：skill `SKILL.md` + `docs/design-docs/jj-team-coordinate.md`。
