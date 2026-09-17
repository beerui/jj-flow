---
name: jj-ralph
description: 任务闭环：分析→计划→改代码→验收→归档；同需求优先同一 run（归档后可继续）；能力地图与 handoff。
argument-hint: "<目标、资料、范围、验收，或 run_id / 查地图关键词>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj-ralph

用户输入：$ARGUMENTS

当前业务仓任务闭环。产物：`.workflow/ralph/task-<slug>/`、`business-map.json`。
权威 skill：`skills/jj-ralph/SKILL.md`。对话路径不执行 `ralph_ops.mjs` / `jj ralph`。
派单协议见 `skills/jj/references/assignment-spawn.md`，此处不再重复。

主对话是 team-lead：写派单并本轮 `spawn_subagent`。大功能走 `$jj-review`。不要 `review-record`。不要 `--lite`，不要 `--intensity`。细则以权威 skill 为准。
`references/` 不是启动清单。
