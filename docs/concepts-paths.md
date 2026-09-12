# 目录在哪

## 默认

| 名称 | 默认位置 | 用途 |
|--------|----------|--------|
| 调度状态 | 用户目录下的 `~/.jj-flow` | 多项目派发记录 |
| 项目地图 | `~/.jj-flow/map.md` | 全局项目索引；写入须经你确认 |
| 知识库 | `~/.jj-flow/knowledge` | 跨项目可复用说明；写入须经你确认 |
| 项目族根 | 可配置 | 本机多个仓库的根 |

安装 skill 时会生成空的 map 和知识结构，一般**无需手动改路径**。接入地图与补知识库请用 `$jj-init`（确认后写入）。

## 业务仓库里常见目录

```text
.workflow/ralph/
  <task-…>/            # 进行中的任务（人读 md + .state/）
  completed/<task-…>/  # 已归档 / 已放弃
  migrated/            # 旧版迁移残骸
  archive/…            # 1.0 快照（只读；可 prune）
.workflow/handoffs/…   # 交接导出
```

任务目录里常见：`index.md`、`task_plan.md`、`progress.md`、`findings.md`、`business-map.json`；机器事件在 `.state/events.jsonl`。

## 相关

[安装](installation.md)、[知识库](concepts-knowledge.md)、[ralph](commands/jj-ralph.md)
