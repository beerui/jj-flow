# 能力地图

路径：`.workflow/ralph/business-map.json`
契约：`business-map.schema.json` / `schemas/ralph-business-map.schema.json`

## 节点字段

| 字段 | 含义 |
| --- | --- |
| `id` | `CAP-*` |
| `title` / `summary` | 业务能力标题与一句话 |
| `status` | `active` \| `done` \| `deprecated` |
| `reqs` | 需求 ID |
| `modules` | 相关源码路径 |
| `acceptance` | 验收文档路径 |
| `run_refs` | 来源 `RALPH-*` |
| `keywords` / `lessons` | 供下次检索的关键词与经验 |
| `handoff_refs` | 交接包路径（在 handoffs/ 下） |

## 写入时机

- **ANALYZE 结束**：可在 `analyze.md` 记草案；地图节点可先 `active`（可选）。
- **ARCHIVE / accept PASS 后**：必须 `jj ralph map-merge --run-id …` 合并强证据字段。
- 不删除历史 capability；废弃标 `deprecated`。

## 下次会话如何找到历史

1. 先读 `business-map.json`（或 `jj ralph map-find --query "…"`）。
2. 命中后按 `discover_paths` / `run_refs` 打开对应 `ralphs/RALPH-*/run.json`、`progress.md`、`acceptance.md`。
3. 若有 `handoff_refs`，去 `.workflow/handoffs/<HOF-ID>/` 读需求，**不在 ralph 目录实现迁移**。

检索测试保证：写入地图后，用标题/关键词/模块片段可再次找到该能力与 run。
