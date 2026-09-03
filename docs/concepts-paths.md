# 目录在哪

## 默认

| 叫什么 | 默认位置 | 干什么 |
|--------|----------|--------|
| 调度状态 | 用户目录下的 `~/.jj-flow` | 多项目派工记录 |
| 项目地图 | `~/.jj-flow/map.md` | 全局项目索引；新项目须你点头才写入 |
| 知识库 | `~/.jj-flow/knowledge` | 跨项目可复用说明；投喂须你点头 |
| 项目族根 | 可配置 | 本机多个仓库的根 |

安装 skill 时会生成空的 map 和知识结构。一般 **不用你手改路径**。接入地图和补知识库走 `$jj-init`（点头才写）。

## 业务仓库里常见目录

```text
.workflow/ralph/
  <task-…>/            # 进行中的任务（人读 md + .state/）
  completed/<task-…>/  # 已归档 / 已放弃
  migrated/            # 旧版迁移残骸
  archive/…            # 1.0 快照（只读；可 prune）
.workflow/handoffs/…   # 交接导出
```

任务目录里：人看 `task_plan.md` / `progress.md` / `findings.md`；机器事件在 `.state/events.jsonl`。

## 相关

[安装](installation.html) · [知识库](concepts-knowledge.html) · [ralph](command-jj-ralph.html)
