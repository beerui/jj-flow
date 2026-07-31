---
name: jj-review
description: 单仓只读审查适配器：优先调用当前宿主内置 review/code-review，把结论映射为 ralph run 的 reviews/REV-*.json 并回写 run.json。在审查、code review、评审 commit/diff、关联 task/review 会话，或 jj-ralph 完成后补审查记录时使用。跨项目调度与正式 VERIFIED 门用 jj-dispatch。不替代宿主审查引擎，不改业务代码。
---

# jj-review

对现有 ralph run 做**只读审查记录**。审查本身优先交给**当前宿主内置**的 review 能力；本 skill 负责范围绑定、结果映射与落盘。

不改业务代码，不 init run，不建 fix 任务，不走 dispatch。

## 立即动作

1. **定位 run**
   读 `.workflow/ralph/RALPH-*/run.json`。用户给了 `run_id` 用它；否则选**最新** run（`updated_at` 降序，并列再比 `run_id` 降序）。**无 run → `BLOCKED`，禁止 init。**

   无 run 时输出模板（停止，不 init）：

   ```text
   status: BLOCKED
   reason: no_ralph_run
   next: 先在本仓完成 $jj-ralph init 或指定 run_id；本 skill 禁止 init
   ```

2. **确定审查范围**
   读 `analyze.md` / `plan.md` / `progress.md` / `acceptance.md`。
   解析目标：`reviewed_commit` / 工作区 diff / 用户指定路径。
   产物空且无明确 commit/diff → `BLOCKED`。

3. **用户已提供审查结果时优先映射**（`source=user_provided`）
   用户给出 review 产物路径、粘贴 findings、或点名已完成的审查会话 → **直接映射落盘**，不必再调宿主 review。
   见 [host-review.md](references/host-review.md) 发现顺序第 1 条。

4. **否则优先宿主内置 review**（见 [host-review.md](references/host-review.md)）
   - 发现并调用本会话可用的内置 **review / code-review** 入口（不要用测试/CI 的 verify 冒充审查）。
   - 不要自己先做一遍完整审查再“对照”宿主结果。
   - 收集：结论（通过/需改）、findings、摘要、产物路径（若有）。
   - 映射后 `source=host_builtin`。

5. **映射为本 schema**
   - 结论仅 `PASS` / `NEEDS_CHANGES` / `BLOCKED`。
   - finding：`id` / `severity` / `file` / `line` / `description` / `status` / `acceptance`。
   - severity / verdict 映射表见 host-review.md。
   - 在报告中记录 `source` 与 `host_review`（溯源，不推进其它门禁）。

6. **落盘**（复制 [review-report.skeleton.json](references/review-report.skeleton.json)）
   - `reviews/REV-n.json`（n = 现有最大 + 1；无则 1）
   - 回写 `run.json.review` 与 `artifact_refs.latest_review_ref`
   - append 一行到 `progress.md`（含 `source=`）
   - 维护场景优先：`jj ralph review-record` 或 `ralph_ops.mjs review-record`（与直接写文件同 schema，**不丢溯源**）。可复制示例：

   ```bash
   # 经 CLI
   jj ralph review-record --run-id RALPH-login-reminder-20260722 \
     --outcome NEEDS_CHANGES --source host_builtin \
     --reviewed-commit abcdef1 \
     --host-review-json '{"method":"skill","entry":"code-review","artifact_paths":[]}'

   # 或经 skill 脚本
   node <resolved>/ralph_ops.mjs review-record --run-id RALPH-login-reminder-20260722 \
     --outcome PASS --source user_provided --reviewed-commit abcdef1
   ```

7. **完成报告**（简短）
   `run_id`、`review_id`、`outcome`、`source`、报告路径、宿主产物引用、是否需返工。

字段与 outcome 校验见 [report-layout.md](references/report-layout.md)。

## 用户已提供结果（非回退）

只要用户给出完整 findings / 宿主 review 产物 / 审查会话结论：

- `source=user_provided`
- 映射并落盘即可
- **不算** `fallback_inline`

## 回退（仅当宿主审查不可用）

仅在以下情况允许本会话**最小内联审查**（`source=fallback_inline`）：

- 当前宿主无可发现的 review / code-review 入口；或
- 宿主入口调用失败且用户明确要求继续。

回退时仍只读、仍必须落盘 `REV-*.json`，并在 `summary` / `host_review.note` 写明为何未用宿主审查。

## 硬规则

1. **只读**：不改业务代码、不 init run、不创建 fix 任务。
2. **宿主优先**：有内置 review 时禁止跳过它改做平行自审。
3. **必须落盘** `reviews/REV-*.json`（jj-flow 事实源，不是聊天结论）。
4. `PASS` / `NEEDS_CHANGES` 必须有 `reviewed_commit`（≥7 位）；OPEN finding 规则见 report-layout。
5. 证据不足用 `BLOCKED`（commit 可空，写清缺什么）。
6. 跨项目正式闭环用 `$jj-dispatch` / 已安装 skill / 宿主等价入口（Codex/Qoder/Grok）；Claude **无** dispatch slash（intentional）。本 skill 不替代 VERIFIED 门。
7. 规程与示例**不绑定**某一宿主产品名；入口发现用通用能力名（见 host-review 矩阵）。
8. **不要**把 `npm test` / `npm run verify` / 纯 CI 绿灯当成 review `PASS`。

## 输入

- `run_id`（可选；默认最新 ralph run）
- `reviewed_commit`（PASS/NEEDS_CHANGES 必填）
- `task_thread` / `review_thread`（可选）
- 可选：用户已有的宿主 review 产物路径或粘贴结论（`source=user_provided`）

## 示例

```text
$jj-review run=RALPH-login-reminder-20260722
$jj-review 评审当前 commit 的登录提醒改动
$jj-review 把刚才宿主 review 结果记到最新 ralph run
```
