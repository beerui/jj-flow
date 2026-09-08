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
产物：`.workflow/ralph/task-<slug>/`、`business-map.json`。
权威 skill：`skills/jj-ralph/`（`ralph_ops.mjs` / `jj ralph`）。

## 执行要点

1. 解析脚本：repo skill → `$CODEX_HOME/skills/jj-ralph/scripts/` → `jj ralph`。
2. **用户口语优先**（「再改 tip」「刚才那个」「先不做了」）；**禁止**要求用户先报 `task-…`。同需求 → resume/继续，勿默认 init。活跃 `RALPH-*` 先 `jj ralph migrate`。
3. 不要整读 `business-map.json`，空 CAP 合法。单点示例见 `tiny-example.md`。**不要** `--lite`，**不要** `--intensity`。截图 / 「这里」先读图。需求确认不了先问，写 `## 存疑`，不要猜着做。用户说「先不写代码」只写 Goal + 存疑、不过关。同会话「继续 / 按审查改 / 改坏了」→ resume，禁止 init（CLI `--thread-id` / `host.thread_id` 也算同会话）。审查只出 findings，等用户说「按审查改」再改。
4. 聊天不推进检查点。三份人读文件保持短合同：`task_plan.md` = Goal / 验收 / Steps；`progress.md` 按日追加；机器事件在 `.state/events.jsonl`。交付 PASS 必须走 `ralph_ops`，检查产物后合并记录 analyze/plan/deliver；脚本不可用时先恢复，不能经机械 CLI 降级后直接 finalize。并行读文件，用 offset/limit，禁止重读已注入内容。Grok 默认不调 MasterGo MCP。
5. 同操作失败最多 2 次后换策略；校正写 `instruction-correction.md`，审查者只读、不写 `AGENTS.md`。
6. 默认收尾：`gate accept PASS` → **MUST** `finalize`。审查与 `review-record` 仅在用户要求、`next=review|commit-scoped-review` 或门禁要求时跟随；`next` 不授予 Git 提交权限。`working_tree` PASS 不能替代 commit 审查。`index.md` 出现 `## 归档提示` 时只提示、不自动归档；拿不准先问。
7. 一半不做：`abandon`；再做：`resume`。
8. 未要求 commit/push/review/handoff/dispatch 不做。
9. 交接：「交接到…」→ `/jj-same`。Git 收工 → `/jj-end`（只 Git）。

从 DELIVER 起读 `phases.md`；机械目录 `ops.md`，恢复见 `post-complete-continue.md`、`rollback.md`。
