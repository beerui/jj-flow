---
name: jj-ralph
description: 单仓闭环：分析→计划→改代码→验收→归档；同需求优先同一 run（归档后可继续）；能力地图与 handoff。
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

当前业务仓 Ralph 闭环：ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE。  
产物：`.workflow/ralph/tasks/<task_key>/`、`business-map.json`。
权威 skill：`skills/jj-ralph/`（`ralph_ops.mjs` / `jj ralph`）。

## 执行要点

1. 解析脚本：repo skill → `$CODEX_HOME/skills/jj-ralph/scripts/` → `jj ralph`。
2. **用户口语优先**（「再改 tip」「刚才那个」「先不做了」）；**禁止**要求用户先报 `task-…`。同需求 → resume/继续，勿默认 init。活跃 `RALPH-*` 先 `jj ralph migrate`。
3. map-find；单点跟 tiny-example。
4. 聊天不推进检查点；更新 run.json 与阶段文档。报告里可写 run_id 供核对。
5. 同操作失败最多 2 次后换策略；校正写 `instruction-correction.md`，审查者只读、不写 `AGENTS.md`。
   tiny 默认不写 `task_plan.md` `## 目标` 意图块；ANALYZE 要回应 intent 未决问题。
6. accept PASS 后 `finalize`；之后仍可同 run 再改。
7. 一半不做：`abandon`；再做：`resume`。
8. 未要求 commit/push/review/handoff/dispatch 不做。
9. 交接：「交接到…」→ `/jj-same`。Git 收工 → `/jj-end`（只 Git）。

细则：skill `phases.md`、`post-complete-continue.md`、`rollback.md`。
