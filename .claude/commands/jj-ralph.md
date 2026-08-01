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

**无终态冻结：** 归档是 soft 沉淀（快照 + map），不是墓碑；`COMPLETED`/已归档后 **优先 resume 同 `run_id`**；一半不做 → `abandon`（可救回）。新 RALPH 仅真新需求。`$jj-end` 只 Git，不关死 ralph。权威细则：skill SSOT `.codex/skills/jj-ralph/`（`post-complete-continue.md` / `rollback.md`）。

机械步骤优先 skill 脚本 `ralph_ops.mjs`（自带 `scripts/lib/ralph.mjs`，业务仓无需 jj-flow 包）；等价 `jj ralph`。不要因缺 jj-flow 包改手搓 schema。默认最短路径：少检索、短产物、失败换策略。

## 执行要点

1. 定位脚本：`<repo>/.codex/skills/jj-ralph/scripts/ralph_ops.mjs` → `$CODEX_HOME/skills/jj-ralph/scripts/…` → `jj ralph` → skeleton。
2. map-find：`ralph_ops.mjs map-find --query "…"`；无命中继续。
3. **有同需求 run（含 COMPLETED/归档/ABANDONED）→ 优先 `resume`/`continue` 同 run，禁止默认新 init。** 无 run 才 `init`。
4. 已给文件/行号：只读目标文件 + 至多 1 个参考；跟随 tiny-example。
5. 聊天不能推进检查点；更新 `run.json` 与阶段文档。
6. 同一操作失败最多 2 次，第 2 次换策略。
7. 仅在 MUST 歧义、不可逆操作、缺密钥、需 UAT、脏工作区风险时停表。
8. accept PASS 后优先 `finalize`（map-merge + **soft** archive；可再改、再归档）；可选 handoff / dispatch-snapshot / commit-prep。
9. 一半不做：`abandon`（禁 map）；再做：`resume`。`close` deprecated。
10. 未要求 commit/push/review/handoff/dispatch 不做。
11. 与 `/jj-same`：handoff 写 `.workflow/handoffs/`。
12. 与 `$jj-dispatch`：推荐快照写 `.workflow/dispatch/recommendations/`。

详细阶段与布局见 skill `references/phases.md`、`artifact-layout.md`、`post-complete-continue.md`。