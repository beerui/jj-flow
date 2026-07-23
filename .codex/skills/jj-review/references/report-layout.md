# review report layout

## 路径

```text
.workflow/ralph/<run_id>/
  run.json
  progress.md
  reviews/REV-n.json
```

## 选 run

- 指定 `run_id` → 用该 run；不存在 → BLOCKED。
- 未指定 → 在 `.workflow/ralph/RALPH-*/run.json` 中选最新：
  1. `updated_at` 降序
  2. 并列比 `run_id` 降序
- 无任何 run → BLOCKED，禁止 init / 手建空 run。

## REV 报告字段

| 字段 | 规则 |
| --- | --- |
| schema_version | `jj-flow/ralph-review/1.0` |
| review_id | `REV-<n>`，n 从 1 递增 |
| run_id | 目标 ralph run |
| outcome | `PASS` / `NEEDS_CHANGES` / `BLOCKED` |
| reviewed_commit | PASS/NEEDS_CHANGES 必填 ≥7 位；BLOCKED 可 null |
| task_thread_id | 可选 |
| review_thread_id | 可选 |
| summary | 一句话 |
| findings | 数组；见下表 |
| evidence_refs | 可选路径列表 |
| recorded_at | ISO-8601 |

### finding

| 字段 | 规则 |
| --- | --- |
| id | 如 `F-1` |
| severity | `high` / `medium` / `low` / `info` |
| file | 相对路径 |
| line | 正整数 |
| description | 问题说明 |
| status | `OPEN` / `RESOLVED` / `WAIVED` |
| acceptance | 关闭条件 |

### outcome 校验

- `PASS`：无 OPEN finding，且有 `reviewed_commit`
- `NEEDS_CHANGES`：≥1 OPEN finding，且有 `reviewed_commit`
- `BLOCKED`：证据不足；写清缺 run / 缺 diff / 缺上下文

## 回写 run.json

```json
{
  "artifact_refs": { "latest_review_ref": "reviews/REV-1.json" },
  "review": {
    "latest_review_id": "REV-1",
    "task_thread_id": "019f8c85-8c32-72c3-b62b-ee9f0753a9e7",
    "reviews": [
      {
        "review_id": "REV-1",
        "path": "reviews/REV-1.json",
        "outcome": "PASS",
        "reviewed_commit": "abcdef1234567",
        "task_thread_id": "019f8c85-8c32-72c3-b62b-ee9f0753a9e7",
        "review_thread_id": "019f8cb8-14e9-79b3-bf40-30ba6c89ef2c",
        "recorded_at": "2026-07-23T08:00:00.000Z"
      }
    ]
  }
}
```

`progress.md` 追加一行：

```text
- <iso> review REV-1 PASS commit=<sha> task_thread=<id> review_thread=<id>
```

## 边界

- 不替代 dispatch 的正式 VERIFIED 审查门禁。
- 维护场景可选既有 `jj ralph review-record`；对话执行默认直接写文件。
