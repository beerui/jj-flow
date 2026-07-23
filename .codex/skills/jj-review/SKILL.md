---
name: jj-review
description: 单仓只读代码审查；把 PASS/NEEDS_CHANGES/BLOCKED、findings、task/review 会话写到当前仓库 ralph run 的 reviews/REV-*.json 并回写 run.json。在审查、code review、评审 commit/diff、关联 task/review 会话，或 $jj-ralph 完成后补审查记录时使用。跨项目调度与正式 VERIFIED 门禁用 $jj-dispatch。直接读写约定路径，不依赖 CLI。
---

# jj-review

对当前仓库的现有 ralph run 做只读审查，直接落盘报告。快路径，不改业务代码，不建 fix 任务，不走 dispatch。

## 立即动作

1. 定位现有 run：读 `.workflow/ralph/RALPH-*/run.json`。用户给了 `run_id` 用它；否则选**最新** run，排序：`run.json.updated_at` 降序，并列再比 `run_id` 降序。**无 run → BLOCKED，禁止 init。**
2. 读 `analyze.md` / `plan.md` / `progress.md` / `acceptance.md` 与相关 diff/commit。产物空且无明确 commit/diff → BLOCKED。
3. 结论仅 `PASS` / `NEEDS_CHANGES` / `BLOCKED`。
4. finding 字段：`id` / `severity` / `file` / `line` / `description` / `status` / `acceptance`。
5. 直接写报告（复制 [review-report.skeleton.json](references/review-report.skeleton.json)）：
   - `reviews/REV-n.json`（n = 现有最大 + 1；无则 1）
   - 回写 `run.json.review` 与 `artifact_refs.latest_review_ref`
   - append 一行到 `progress.md`
6. 完成只报告：`run_id`、`review_id`、`outcome`、报告路径、是否返工。

字段、回写结构与 outcome 校验见 [report-layout.md](references/report-layout.md)。

## 硬规则

1. 只读；不改业务代码、不 init run、不创建 fix 任务。
2. 必须落盘 `reviews/REV-*.json`。
3. `PASS` / `NEEDS_CHANGES` 必须有 `reviewed_commit`（≥7 位）；OPEN finding 规则见 report-layout。
4. 证据不足用 `BLOCKED`（commit 可空，写清缺什么）。
5. 跨项目正式闭环用 `$jj-dispatch`。

## 输入

- `run_id`（可选；默认最新 ralph run）
- `reviewed_commit`（PASS/NEEDS_CHANGES 必填）
- `task_thread` / `review_thread`（可选）

## 示例

```text
$jj-review run=RALPH-login-reminder-20260722 task_thread=019f8c85-... review_thread=019f8cb8-...
$jj-review 评审当前 commit 的登录提醒改动
```
