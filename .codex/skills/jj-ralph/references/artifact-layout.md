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
| map-find | 读 `business-map.json`（优先脚本） |
| finalize | map-merge + archive |
| archive | `archive-manifest.json` + `archive/…` |
| map-merge | 更新 `business-map.json` |
| handoff | `.workflow/handoffs/<HOF-ID>/` |
| dispatch-snapshot | `.workflow/dispatch/recommendations/<SNAP-ID>/snapshot.json` |
| commit-prep | 建议 message + 文件清单（不 commit） |
| review-record | `reviews/REV-*.json` + 回写 `run.json` |

默认不自动 `git commit` / `push`。

## 脚本

优先：`scripts/ralph_ops.mjs`（薄封装 `src/ralph.mjs`）：

`init` / `status` / `archive` / `finalize` / `map-merge` / `map-find` / `handoff` / `dispatch-snapshot` / `commit-prep` / `review-record`

路径解析见 SKILL.md；等价 `jj ralph`。

可移植：`scripts/lib/ralph.mjs` 与 `src/ralph.mjs` 同步（`npm run ralph:sync`）；业务仓无需 jj-flow 包。
