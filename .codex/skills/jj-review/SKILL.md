---
name: jj-review
description: 单仓轻量代码审查；把审查结论关联到 ralph run，记录 task/review 会话与 findings，不走 dispatch 控制面。
---

# jj-review

单仓审查入口。目标是快：对当前仓库的 ralph run 做只读审查，并把报告挂到 run 上。

不要用：跨项目调度 / 正式 VERIFIED 门禁 -> $jj-dispatch。

## 最小流程

```text
有 run？没有就 jj ralph init
读 run 产物 + Git commit
只读审查（不改代码、不建 fix 任务）
jj ralph review-record 写 reviews/REV-n.json 并回写 run.json
```

## 输入

- run_id（RALPH-...）或当前仓最新 ralph run
- 可选 task_thread / review_thread / reviewed_commit

## 立即动作

1. jj ralph status 定位 run。
2. 读 analyze/plan/progress/acceptance 与相关代码、测试。
3. 结论仅 PASS / NEEDS_CHANGES / BLOCKED。
4. finding：id/severity/file/line/description/status/acceptance。
5. 落盘：

```bash
jj ralph review-record --run-id RALPH-... \
  --outcome PASS|NEEDS_CHANGES|BLOCKED \
  --reviewed-commit <sha> \
  --task-thread <task-session-id> \
  --review-thread <review-session-id> \
  --summary "summary" \
  --findings-file findings.json
```

6. 完成只报告 run_id、review_id、outcome、报告路径、是否返工。

## 产物

```text
.workflow/ralph/ralphs/<run_id>/
  reviews/REV-1.json
  run.json
  progress.md
```

## 规则

1. 只读，不改业务代码。
2. 必须有 reviews/REV-*.json。
3. PASS 无 OPEN finding；NEEDS_CHANGES 至少一个 OPEN。
4. 证据不足用 BLOCKED。
5. 跨项目正式闭环再用 dispatch。

## 示例

```text
$jj-review run=RALPH-login-reminder-20260722 task_thread=019f8c85-... review_thread=019f8cb8-...
```
