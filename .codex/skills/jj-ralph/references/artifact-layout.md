# Ralph 产物布局

```text
全局命名权威（本机）：
  D:/a/config/naming.json
  D:/a/map.md                 # role / path
```

```text
.workflow/ralph/
  business-map.json
  archive/YYYY-MM-DD-{kebab-slug}/
  completed/RALPH-{kebab-slug}-{YYYYMMDD}/   # COMPLETED 工作目录归宿（可选）
  RALPH-{kebab-slug}-{YYYYMMDD}/             # 仅活跃 run
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
2. **命名必须遵循** `D:/a/config/naming.json`（缺省时用 skill/代码内置 defaults，但本机应以该文件为准）：
   - `run_id` = `RALPH-{kebab-slug}-{YYYYMMDD}`（禁止 camelCase、禁止双日期如 `RALPH-0724-foo-20260727`）
   - archive 目录 = `YYYY-MM-DD-{kebab-slug}`（禁止 `0724-...`、禁止无日期前缀；`_meta/*` 除外）
   - COMPLETED 后可将工作目录移入 `completed/`，**不改名**；冻结副本仍在 `archive/`
3. 不使用其它中间层目录；不创建 `.workflow/jj-ralph/`。
4. handoff 写 `.workflow/handoffs/<HOF-ID>/`；dispatch 快照写 `.workflow/dispatch/recommendations/<SNAP-ID>/snapshot.json`。
5. 创建 JSON 先复制 skeleton，再填字段：
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
