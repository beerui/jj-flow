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
2. **直接调用**：无强制提示。仅嵌套在 ralph/review/dispatch 时一句：`开启 team 模式，开始任务XXX 约 10-25分钟`。
3. **禁止**用 team 结果直接改 ralph gate / dispatch。
4. Worker 优先 `team-worker`；degraded 用 `tasks.json` + `.msg/`。
5. 命令：`check` / `resume` / `revise` / `feedback` / `improve`。

细则：skill `SKILL.md` + `docs/design-docs/jj-team-coordinate.md`。
