# Ralph 归档 → Portfolio 知识库贡献（Knowledge Contribute）

> 状态：Proposed
>
> 关联：`portfolio-knowledge.md`、`jj-ralph.md`、ADR 0001 外部工具边界  
> 问题：归档只写本仓 `business-map` + 快照，**不会**更新全局 Portfolio KB；用户希望归档时能**方便**补充全局知识库。

## 1. 目标

1. **归档后一条路径**即可把本轮交付的「可复用知识」投喂到全局 KB 管道。  
2. 保持 **聊天非权威、candidate 默认、人审晋升**（不静默污染 active）。  
3. **jj-flow 不内嵌全量 KB 引擎**；Portfolio 仍外置（jj-portfolio / `knowledge_root`）。  
4. 无 KB、不可达、用户关闭时 **不挡归档**（fail-open 对 archive 主路径）。

## 2. 非目标

| 非目标 | 原因 |
| --- | --- |
| finalize 同步 `promote` 到 active | 违反审核策略，质量不可控 |
| 把过程性 STAGNATION 等当 durable 知识 | 已污染 map lessons，勿再灌 KB |
| jj-flow npm 打包整库正文 | 与 portfolio-knowledge 边界冲突 |
| 替代本仓 `business-map.json` | 本仓地图仍由 map-merge 负责 |

## 3. 现状与缺口

```text
今天：
  accept PASS → map-merge（本仓 CAP）→ archive 快照
  knowledge_refs ← 仅 init 时从 KB 只读挂载
  无：archive → KB 写回 / extract 触发

期望：
  accept PASS → map-merge → archive
                 └→（可选）贡献包 + extract 钩子 → KB candidate
                      └→ 人审 promote → active → 下次 init 可 attach
```

## 4. 架构裁决（推荐）

### 4.1 推荐：**贡献包（必选能力）+ 可选 extract 钩子**

| 层 | 归属 | 职责 |
| --- | --- | --- |
| **A. Contribution package** | jj-flow / ralph | 归档时从 run 生成 **版本化贡献清单**（只写本仓 run 目录） |
| **B. Extract / upsert 钩子** | 可选调用外置 `kb` CLI 或 HTTP | 把贡献包落成 KB **candidate** |
| **C. Promote** | 仅 Portfolio KB 侧 | 人审 / policy → active |

**不推荐** jj-flow 直接写 entry 正文并改 `search.json`（双写、版本分裂、边界破坏）。

```text
finalizeRun / archiveRun（成功后）
  → buildKnowledgeContribution(run)     // 纯函数，本地
  → write runDir/knowledge-contribution.json
  → if hook enabled && kb available:
        invokeExtractHook(package)      // best-effort；失败只记 progress，不 fail archive
  → report: path + hook status + next human step
```

### 4.2 为何不是「只写 portfolio」

- KB 有 schema、去重、审核状态机；jj-flow 直写易绕过。  
- extract 侧已有 map/wiki 抽取器，**统一入口 = extract** 更可演进。  
- 贡献包可离线、可 CI、可 agent 二次编辑后再投喂。

### 4.3 与 business-map 的关系

| 产物 | 范围 | 时机 |
| --- | --- | --- |
| business-map | **本仓** CAP | map-merge |
| knowledge-contribution | **拟投喂全局** 的结构化摘要 | archive 后 |
| KB active entry | **全局** 可检索 | extract + promote **之后** |

map-merge 的 CAP 可作为贡献包输入（title/modules/lessons 过滤后），但 **不等价于** 已入 KB。

## 5. 贡献包契约（草案）

路径：`.workflow/ralph/<run_id>/knowledge-contribution.json`  
（归档时一并拷入 archive 快照。）

```json
{
  "schema_version": "jj-flow/ralph-knowledge-contribution/0.1",
  "run_id": "RALPH-…",
  "created_at": "ISO-8601",
  "source": {
    "repo_root": "…",
    "project_key": "cj-web",
    "git_head": "abc1234…",
    "branch": "feat/…",
    "archive_path": ".workflow/ralph/archive/…",
    "last_archived_at": "…"
  },
  "intent": {
    "title": "…",
    "goal": "…",
    "scope_in": [],
    "scope_out": []
  },
  "capability_hint": {
    "id": "CAP-…",
    "title": "…",
    "modules": [],
    "keywords": [],
    "acceptance_paths": []
  },
  "candidates": [
    {
      "type": "capability|pattern|lesson|standard",
      "title": "…",
      "summary": "…",
      "keywords": [],
      "body_ref": "acceptance.md#…",
      "confidence": 0.0,
      "durable": true,
      "provenance": {
        "run_id": "RALPH-…",
        "files": [],
        "source_kind": "ralph_archive"
      }
    }
  ],
  "existing_knowledge_refs": [],
  "policy": {
    "suggest_status": "candidate",
    "auto_promote": false
  }
}
```

### 5.1 从 run 抽取候选的规则（默认保守）

**纳入 `candidates`（durable=true）：**

- accept 清单中 **PASS** 且有证据路径的 MUST 结论（短摘要）  
- operator 显式 `finalize --lessons` / 人工 durable lessons  
- capability title + 稳定 modules（相对路径）  
- 用户/agent 在 analyze 标明的 `## 可复用知识` 段（可选约定）

**默认排除：**

- `deriveAutoLessonsFromRun` 过程项（STAGNATION / MAX_ITERATIONS / intensity=strict 串）  
- 中间失败 attempt 叙述  
- 无证据的聊天句  

**confidence：** 有 commit + accept PASS → 中高；仅 working_tree → 低。

## 6. 钩子设计

### 6.1 配置（naming.json / env）

```json
{
  "dispatch": {
    "knowledge_root": "D:/a/knowledge"
  },
  "ralph": {
    "knowledge_contribute": {
      "enabled": true,
      "hook": "none|cli|http",
      "cli": "node {knowledge_root}/tools/kb.mjs extract --source {package} --status candidate",
      "http_url": null,
      "fail_open": true,
      "require_confirm_in_skill": true
    }
  }
}
```

| 模式 | 行为 |
| --- | --- |
| `hook=none`（默认更安全） | 只写贡献包；skill 报告「可执行 kb extract …」 |
| `hook=cli` | 子进程调用配置命令；超时/非 0 → progress 记 FAIL，**不**回滚 archive |
| `hook=http` | POST 贡献包 JSON；同上 fail-open |

### 6.2 CLI 表面（jj-flow）

```text
jj ralph finalize …                 # 默认：map-merge + archive + 写 contribution
jj ralph knowledge-contribute --run-id RALPH-x [--hook] [--force]
```

- `knowledge-contribute`：对已归档/已 finalize 的 run **重放**生成包 + 可选钩子（补投喂）。  
- finalize 内：`contribute: true|false`（默认 true 写包；钩子仍受 config）。

### 6.3 Skill 用户路径（方便）

归档成功后报告固定块：

```text
知识贡献：
- 已写 knowledge-contribution.json（N 条 candidate 建议）
- 钩子：skipped|ok|failed（原因）
- 下一步（人话）：审核知识库候选 / 或说「投喂知识库」
```

用户说「投喂知识库 / 补充全局知识」→ agent：

1. 读 contribution  
2. 可让用户删掉不合适 candidate  
3. 调 `knowledge-contribute --hook` 或外置 `kb extract`  
4. **不**自动 promote  

## 7. 安全与边界

| 规则 | 说明 |
| --- | --- |
| fail-open | 钩子失败不否定 archive / COMPLETED soft |
| ABANDONED | **不**生成贡献（与 map-merge 一致） |
| 无 knowledge_root | 仍写本地 package；hook 跳过 |
| 密钥/路径 | 不把 secrets、绝对本机隐私路径写入 body |
| 幂等 | `source_id = ralph:{run_id}:{content_hash}`，重复投喂 upsert 不炸 |
| 审计 | progress 一行：`knowledge-contribute written|hook=…` |

## 8. 分波交付

### Wave 0 — 贡献包 only（最小可用）

- `buildKnowledgeContribution(run)` + finalize 落盘  
- skill 报告路径 + 人话下一步  
- 合约测试：字段、ABANDONED 不写、排除 auto lessons  

**验收：** 归档后本地有 package；无 KB 也成功。

### Wave 1 — CLI 重放 + skill「投喂」

- `jj ralph knowledge-contribute`  
- skill 话术绑定  
- 文档：memory-knowledge-guide + jj-ralph 一节  

### Wave 2 — extract 钩子

- 配置 `hook=cli` 对接 jj-portfolio `kb extract --source …`  
- 约定 extract 消费 `ralph-knowledge-contribution/0.1`  
- 集成测试：有 mock kb CLI  

### Wave 3 — 体验增强（可选）

- finalize 后 AskUser「是否投喂」  
- durable 分类 UI / 过滤 STAGNATION 开关  
- 与 re-archive：仅 delta 贡献或全量幂等  

## 9. API 草图（jj-flow）

```js
// src/ralphKnowledgeContribute.mjs
export function buildKnowledgeContribution(run, { cwd, mapCapability } = {}) { /* pure */ }
export function writeKnowledgeContribution(runId, { cwd, force } = {}) { /* write json + progress */ }
export function invokeKnowledgeContributeHook(pkg, { config, cwd } = {}) { /* best-effort */ }
export function knowledgeContribute(runId, { cwd, hook = false } = {}) { /* write + optional hook */ }
```

`finalizeRun` 成功路径末尾：`writeKnowledgeContribution`（不 await 远程 promote）。

## 10. 测试计划

| 用例 | 期望 |
| --- | --- |
| finalize 后存在 contribution | schema + candidates 非过程课 |
| ABANDONED finalize 禁 | 无 package 或显式 skip |
| auto lessons 不进 durable candidates | 过滤 |
| hook fail | archive 仍 ok；progress 记 hook_error |
| 幂等二次 contribute | 同 source_id upsert |
| 无 knowledge_root | package 仍写；hook skipped |

## 11. 风险

| 风险 | 缓解 |
| --- | --- |
| 垃圾知识涌入 candidate | 保守抽取 + 人审；默认不 auto-promote |
| 钩子拖慢 finalize | 异步可选；默认 timeout 短；fail-open |
| extract 协议未定 | Wave 0 只写 package；Wave 2 与 portfolio 对齐 schema |
| 与 re-archive 重复 | source_id + content_hash |

## 12. 决策摘要

| 问题 | 决定 |
| --- | --- |
| 写回 portfolio 还是 extract 钩子？ | **先贡献包，再可选 extract 钩子**；不直写 active |
| 归档是否必须联网/有 KB？ | **否** |
| 用户如何「方便」？ | 归档自动落包 + 一句「投喂知识库」/ CLI 一键 hook |
| 本仓 map 还要吗？ | **要**；全局 KB 是另一条晋升管道 |

## 13. 下一步（实现前）

1. 与 jj-portfolio 确认 `extract --source` 是否消费 JSON package（或需 adapter）。  
2. 落地 Wave 0（jj-flow 单仓可合并）。  
3. 用户文档补「归档后如何进全局知识库」三步：归档 →（可选）投喂 → 审核晋升。
