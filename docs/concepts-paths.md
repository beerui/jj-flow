# 目录在哪

## 用户目录（`~/.jj-flow`）

| 名称 | 默认位置 | 用途 |
|--------|----------|--------|
| 调度状态 | 用户目录下的 `~/.jj-flow` | 多项目派发记录 |
| 项目地图 | `~/.jj-flow/map.md` | 全局项目索引；写入须经你确认 |
| 知识库 | `~/.jj-flow/knowledge` | 跨项目可复用说明；写入须经你确认 |
| 记忆热层 | `~/.jj-flow/memory/<project_key>.md` | 每个项目一份可复用结论；见[知识与记忆](concepts-knowledge.md) |
| 项目族根 | 可配置 | 本机多个仓库的根 |

安装 skill 时会生成空的 map 和知识结构，一般**无需手动改路径**。接入地图与补知识库请用 `$jj-init`（确认后写入）。

## 业务仓库里常见目录

```text
.workflow/ralph/
  <task-…>/              # 进行中的任务（扁平放在 ralph 根下）
    task_plan.md         # 目标 / 验收 / 步骤
    progress.md          # 按日期的进展与验证证据
    findings.md          # 改动摘要 / 踩坑
    assignments/         # 派单文件（TASK / REVIEW / FIX；迁移场景另有 RESEARCH / HANDOFF）
    .state/              # run.json（状态与门禁）、events.jsonl（机器事件）、reviews/（审查结论）
  completed/<task-…>/    # 已归档 / 已放弃
  migrated/              # 旧版迁移残骸
  archive/…              # 1.0 快照（只读；可 prune）
  index.md               # 活跃 / 已完成索引（在 ralph 根，不在任务目录里）
  business-map.json      # 能力地图（同样在 ralph 根）
  tasks/                 # 旧版嵌套布局遗留；由 migrate 上提
.workflow/.team/TC-* 等  # team-coordinate / lifecycle / swarm 的会话目录
.workflow/evaluated/…    # 离线评估报告（EP-*）
.workflow/review-assignment.md  # 无活跃任务时的审查派单
```

交接说明写在任务自己的 `.state/run.json`（`handoff` 字段）；旧的 `.workflow/handoffs/` 目录已弃用。

## 相关

[安装](installation.md)、[知识与记忆](concepts-knowledge.md)、[ralph](commands/jj-ralph.md)
