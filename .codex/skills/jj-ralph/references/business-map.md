# 能力地图

路径：`.workflow/ralph/business-map.json`  
契约：[business-map.schema.json](business-map.schema.json)

## 节点字段

| 字段 | 含义 |
| --- | --- |
| `id` | `CAP-*` |
| `title` / `summary` | 标题与一句话 |
| `status` | `active` \| `done` \| `deprecated` |
| `reqs` | 需求 ID |
| `modules` | 相关源码路径 |
| `acceptance` | 验收文档路径 |
| `run_refs` | 来源 `RALPH-*` |
| `keywords` / `lessons` | 检索关键词与经验 |
| `handoff_refs` | handoff 路径 |

新建/合并节点时复制 [capability.skeleton.json](capability.skeleton.json)。

## 写入时机

- ANALYZE：可在 `analyze.md` 记草案；地图节点可选 `active`。
- ARCHIVE / accept PASS 后：必须把强证据字段合并进 `business-map.json`。
- 不删除历史 capability；废弃标 `deprecated`。

## map-find

1. 读 `business-map.json`，按标题/关键词/模块片段检索。
2. 命中后按 `run_refs` 打开 `.workflow/ralph/RALPH-*/run.json`、`progress.md`、`acceptance.md`。
3. `discover_paths` 若出现在工具输出中，是检索时计算的路径列表，**不落库**。
4. 若有 `handoff_refs`，去 `.workflow/handoffs/<HOF-ID>/` 读需求；不在 ralph 目录实现迁移。
