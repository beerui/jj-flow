---
name: jj-ralph
description: 单仓全流程自治闭环；需求分析 → 计划实施 → 验收完成 → 归档；文档留痕、能力地图、仅必要时介入。
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

在当前单一业务仓库执行 Ralph 闭环：ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE。  
产物写入 `.workflow/ralph/RALPH-{slug}-{date}/`，能力地图为 `.workflow/ralph/business-map.json`。

机械步骤优先 skill 脚本 `ralph_ops.mjs`（自带 `scripts/lib/ralph.mjs`，业务仓无需 jj-flow 包）；等价 `jj ralph`。不要因缺 jj-flow 包改手搓 schema。默认最短路径：少检索、短产物、失败换策略。

## 执行要点

1. 定位脚本：`<repo>/.codex/skills/jj-ralph/scripts/ralph_ops.mjs` → `$CODEX_HOME/skills/jj-ralph/scripts/…` → `jj ralph` → skeleton。
2. map-find：`ralph_ops.mjs map-find --query "…"`；无命中继续。
3. 无 run 时 `ralph_ops.mjs init`（或复制 run skeleton）。
4. 已给文件/行号：只读目标文件 + 至多 1 个参考；跟随 tiny-example。
5. 聊天不能推进检查点；更新 `run.json` 与阶段文档。
6. 同一操作失败最多 2 次，第 2 次换策略。
7. 仅在 MUST 歧义、不可逆操作、缺密钥、需 UAT、脏工作区风险时停表。
8. accept PASS 后优先 `finalize`（map-merge + archive）；可选 handoff / dispatch-snapshot / commit-prep。
9. 未要求 commit/push/review/handoff/dispatch 不做。
10. 与 `/jj-same`：handoff 写 `.workflow/handoffs/`。
11. 与 `$jj-dispatch`：推荐快照写 `.workflow/dispatch/recommendations/`。

详细阶段与布局见 skill `references/phases.md`、`artifact-layout.md`。