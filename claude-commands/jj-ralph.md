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

当前业务仓 Ralph 闭环：ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE。  
产物：`.workflow/ralph/task-<slug>/`、`business-map.json`。
权威 skill：`skills/jj-ralph/`。对话路径不跑 `ralph_ops.mjs` / `jj ralph`。

## 执行要点

1. 已知同会话任务读 `.workflow/ralph/index.md` **活跃**唯一行和该目录 `task_plan.md`。0 或 >1 条活跃 → 询问用户。不要 `jj ralph locate` / `context --run-id`。
2. **用户口语优先**（「再改 tip」「刚才那个」「先不做了」）；**禁止**要求用户先报 `task-…`。同需求 → resume/继续，勿默认 init。
3. 不要整读 `business-map.json`，空 CAP 合法。**不要** `--lite`，**不要** `--intensity`。截图 / 「这里」先读图。需求确认不了先问，写 `## 存疑`，不要猜着做。用户说「先不写代码」只写 Goal + 存疑、不过关。同会话「继续 / 按审查改 / 改坏了」→ resume，禁止 init（`host.thread_id` 也算同会话）。主对话是 team-lead：每轮写 `ASSIGNMENT-TASK`（客服形状：读这些 / 交付 / 不要改 / 先确认再开工 / 等 Task n+1；精确文件）并在本轮 `spawn_subagent`（`jj-implementer`，缺失则 `general-purpose`，`description` 以 `[implementer]` 开头）；同一 cwd 上一轮实施已结束 → `resume_from` 该 id（G-ralph-5）；换人格或换仓则新开。spawn 前先说一句用户可见进度（**派遣开发实现** / **派遣审查**，例如「派遣前端开发实现任务」「派遣 reviewer 审查改动代码」），不要静默等待。审查还在跑时不要再派 `$jj-same`。禁止在主对话改业务代码。说要派单却不 spawn 即失败。「按审查改」写 `ASSIGNMENT-FIX`。审查只出 findings，等用户说「按审查改」再改。大功能 `[OK]`/`[WARN]` 后等用户验收再归档。
4. 聊天不推进检查点。人读文件是短合同：`task_plan.md` = Goal / 验收 / Steps；`progress.md` 按日追加（验证证据写在这里，不跑 `deliver-attempt` / `ralph_ops`）。并行读文件，用 offset/limit，禁止重读已注入内容。Grok 默认不调 MasterGo MCP。
5. 同操作失败最多 2 次后换策略；校正写 `instruction-correction.md`，审查者只读、不写 `AGENTS.md`。
6. 默认收尾：用户验收后 **MUST finalize**（把任务目录搬进 `completed/`，更新 `index.md`，双写 `run.json`）。审查走 `$jj-review`（ASSIGNMENT-REVIEW + findings.md + REV json）；**不要** `review-record` / `context --review` / `finalize` CLI。`working_tree` PASS 不能替代 commit 审查（再写一份 `review_scope=commit` 的 REV 文档）。`index.md` 出现 `## 归档提示` 时只提示、不自动归档；拿不准先问。
7. 一半不做：标废弃并更新 `index.md`；再做：同一目录继续。
8. 未要求 commit/push/review/handoff/dispatch 不做。
9. 交接：「交接到…」→ `/jj-same`。Git 收工 → `/jj-end`（只 Git）。

当前阶段只读 `task_plan.md` 与 `progress.md` 尾部。不要打开 skill `references/` 当开机清单。审查列本轮 ASSIGNMENT 文件并 spawn，不生成 `review-context.json`。
