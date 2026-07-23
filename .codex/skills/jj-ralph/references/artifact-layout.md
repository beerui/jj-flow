# Ralph 产物布局

```text
.workflow/ralph/
  business-map.json
  archive/YYYY-MM-DD-{slug}/
  RALPH-{slug}-{YYYYMMDD}/
    run.json
    progress.md
    analyze.md
    plan.md
    tasks/TASK-*.md            # 可选
    acceptance.md
    reviews/REV-*.json         # 可选
    archive-manifest.json
```

## 规则

1. run 直接挂在 `.workflow/ralph/RALPH-*/`，与 `business-map.json`、`archive/` 同级。
2. 不使用中间层目录；不创建 `.workflow/jj-ralph/`。
3. handoff 写 `.workflow/handoffs/<HOF-ID>/`；dispatch 快照写 `.workflow/dispatch/recommendations/<SNAP-ID>/snapshot.json`。
4. 创建 JSON 先复制 skeleton，再填字段：
   - [run.skeleton.json](run.skeleton.json)
   - [archive-manifest.skeleton.json](archive-manifest.skeleton.json)
   - [capability.skeleton.json](capability.skeleton.json)

## Codex 落盘清单

| 动作 | 写什么 |
| --- | --- |
| init | `.workflow/ralph/<run_id>/run.json` + stubs |
| map-find | 读 `business-map.json` |
| archive | `archive-manifest.json` + `archive/…` |
| map-merge | 更新 `business-map.json` |
| handoff | `.workflow/handoffs/<HOF-ID>/` |
| dispatch-snapshot | `.workflow/dispatch/recommendations/<SNAP-ID>/snapshot.json` |
| commit-prep | 完成报告/`progress.md` 中的提交建议 |
| review-record | `reviews/REV-*.json` + 回写 `run.json` |

默认不自动 `git commit` / `push`。

## 脚本

优先：`scripts/ralph_ops.mjs`（init/status/archive/map-merge/handoff/dispatch-snapshot）。
