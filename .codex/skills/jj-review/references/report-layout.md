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

## 审查来源（优先）

1. 用户提供的审查结果 → 映射 → 落盘（`source=user_provided`）
2. 宿主内置 review → 映射 → 落盘（`source=host_builtin`）
3. 仅当 1/2 不可用：最小内联审查（`source=fallback_inline`）

细则见 [host-review.md](host-review.md)。**禁止**在宿主审查已给出结论后再做第二套平行自审覆盖结果（除非用户明确要求复审）。

维护路径与对话路径同 schema：`jj ralph review-record --source … [--host-review-json …]` 会写入溯源字段；勿再假设 CLI 会丢掉 provenance。

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
| summary | 一句话（可含宿主结论摘要） |
| findings | 数组；见下表 |
| evidence_refs | 可选路径列表；宜含宿主 review 产物 |
| recorded_at | ISO-8601 |
| source | 推荐：`host_builtin` \| `user_provided` \| `fallback_inline` |
| host_review | 推荐对象：method / entry / artifact_paths / note |

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
- <iso> review REV-1 PASS commit=<sha> source=host_builtin task_thread=<id> review_thread=<id>
```

## 边界

- 不替代 dispatch 的正式 VERIFIED 审查门禁。
- 不替代宿主审查引擎；本 skill 负责绑定 run 与契约落盘。
- 维护场景可选既有 `jj ralph review-record`；对话执行默认可直接写文件。
