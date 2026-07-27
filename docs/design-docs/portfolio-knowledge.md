# Portfolio Knowledge（顶层知识库）设计

> 状态：Implemented
>
> 验收证据：`tests/portfolio-knowledge.test.mjs`、`tests/jj-ralph-contract.test.mjs`、`D:/a/knowledge/tools/tests/policy-dedup.test.mjs`、`npm run verify`
>
> 实施边界：外置库 `D:/a/knowledge`（git 仓 [jj-portfolio](https://github.com/beerui/jj-portfolio)）+ jj-flow 硬接线读取；不替代 control-plane / ralph run checkpoint

## 目标

1. 跨项目沉淀可复用知识（capability / standard / pattern / lesson / domain）
2. 可抽取、可审核、可索引、可 Web 管理
3. 与 jj-flow / ralph 硬接线：任务初始化自动挂 `knowledge_refs`
4. 明确 **聊天非权威**，文件与 provenance 才是权威

## 非目标

- 替代 ralph run.json / dispatch receipt
- 静默把不确定知识自动当成生产规范（默认 candidate + human gate）
- 在 jj-flow npm 包内嵌全量业务知识正文

## 分层

| 层 | 路径 | 权威 |
| --- | --- | --- |
| L0 注册表 | `D:/a/map.md`、`D:/a/config/naming.json` | 项目定位 |
| L1 Portfolio KB | `D:/a/knowledge/**` | active entries |
| L2 项目工作流 | 各仓 `.workflow/**` | 单次交付事实 |

## 数据模型

Entry schema：`portfolio/knowledge-entry/1.0`

- identity：id / type / status
- content：title / summary / keywords / body
- placement：project_key / domain
- trace：provenance / relations / timestamps

状态机：`candidate → active → deprecated`

## 管道

```text
map.md / business-map / wiki / specs
        → extractors
        → upsert(preserve reviewed)
        → index projections
        → CLI / Web / Agent API
        → ralph init attach knowledge_refs
```

## jj-flow 接线

- `src/portfolioKnowledge.mjs`：解析 KB root、读 search index、打分排序
- `ralph init`：默认 attach；`--no-knowledge-refs` 关闭
- skill portable lib 同步 `portfolioKnowledge.mjs`
- knowledge loop 包字段：`knowledge_refs` / `portfolio_knowledge`

## 审核策略

- `config/default.json`：project_rules / domain_rules / require_human_below_score
- CLI：policy / human-review / review-decide / auto-promote
- 去重：弱 stub 带 source_id；冲突 hold；merge 合并 keywords/evidence

## 运维

- Web：`kb.mjs start --port=8787`
- 增量：`extract --incremental`
- doctor / validate / test / stats

## 用户文档

见 [记忆与知识库上手](../memory-knowledge-guide.html)。

## 可用性门槛

知识库系统「完善可用」至少满足：

1. `kb.mjs doctor` 返回 `PASS`
2. 有 active 条目可供 ralph 挂载
3. extract → human-review → promote 闭环可走通
4. Web 管理端可 start/stop
5. 文档站有使用者指南（[记忆与知识库](../memory-knowledge-guide.html)）

## CLI 表面（运维）

| 命令 | 作用 |
| --- | --- |
| extract / index | 抽取与重建索引 |
| query / knowledge-for-task / agent-context | 检索与 Agent 挂载包 |
| policy / human-review / review-decide | 审核策略与人工决定 |
| auto-promote / promote / reject | 晋升与否决 |
| dedup / memory-health / doctor | 去重、健康、自检 |
| serve / start / stop / status | Web 管理端 |

