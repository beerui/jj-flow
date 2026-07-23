# Ralph 产物布局

业务项目使用：

```text
.workflow/ralph/
  business-map.json                 # 累积能力地图（跨 run，机器可读）
  ralphs/RALPH-{slug}-{YYYYMMDD}/
    run.json                        # 状态与检查点
    progress.md                     # 循环日志（每轮追加）
    analyze.md                      # 需求分析与 REQ 账本
    plan.md                         # 计划与 TASK
    tasks/TASK-*.md                 # 可选拆分
    acceptance.md                   # 验收清单与证据
    reviews/REV-*.json              # optional jj-review reports
    archive-manifest.json           # 归档后写入
  archive/YYYY-MM-DD-{slug}/        # 冻结副本（只追加）
```

## 规则

1. **run 目录在 `ralphs/`**，不使用 `runs/`。
2. **不创建** `.workflow/jj-ralph/` 私有目录。
3. **交接实现不在 ralph 目录内**：handoff 包写入 `.workflow/handoffs/<HOF-ID>/`，由 `jj-same` 读取需求后在目标仓实施。
4. **分发快照**写入 `.workflow/dispatch/recommendations/<SNAP-ID>/snapshot.json`，供 `jj-dispatch` 消费。
5. `jj-flow` 本仓不把 `.workflow` 当仓库事实源；上述路径约束业务目标仓。

## 快速机械命令

对话侧完成分析/编码；下列 CLI 保证归档、地图、提交清单快速可用且格式正确：

```bash
jj ralph init --run-id RALPH-demo-20260722 --title "…" --goal "…"
jj ralph status [--run-id RALPH-…]
jj ralph archive --run-id RALPH-…
jj ralph map-merge --run-id RALPH-…
jj ralph map-find --query "密码 登录"
jj ralph handoff --run-id RALPH-…
jj ralph dispatch-snapshot --run-id RALPH-…
jj ralph commit-prep --run-id RALPH-…
jj ralph review-record --run-id RALPH-… --outcome PASS --task-thread … --review-thread …
```

默认 **不** 自动 `git commit` / `push`。
