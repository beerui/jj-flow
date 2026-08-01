# Ralph 归档时的「提升」怎么做

> 状态：Accepted（E1/E2/E3-cli 已实现；http hook 与 portfolio extract 契约对齐待联调）  
> 关联：`jj-ralph.md`、`portfolio-knowledge.md`、`ralph-knowledge-contribute.md`  
> 实现：`buildElevationFromRun`、`process_lessons`、`knowledge-contribution.json`、`invokeKnowledgeContributeHook`、`jj ralph knowledge-contribute --hook`

## 1. 结论（产品）

归档时的提升分 **三档**，默认只做前两档中的 **L1 必做 + L2 半自动**：

| 档 | 名称 | 默认 | 含义 |
| --- | --- | --- | --- |
| **L1** | 本仓能力提升 | **必做**（finalize 内） | 写入 `business-map.json`，供本仓 `map-find` |
| **L2** | 全局候选投喂 | **写包必做；钩子可选** | 写 `knowledge-contribution.json`，可选 extract → KB **candidate** |
| **L3** | 全局 active 晋升 | **不做** | 仅 Portfolio 人审 / `promote` |

```text
用户：做完了 / 归档
        │
        ▼
   ┌─ L1 本仓 map 提升 ──────────────────── 默认开、失败则整次 finalize 失败
   ├─ 快照 archive/ ─────────────────────── 审计
   └─ L2 贡献包 ─────────────────────────── 默认写盘
          └─（可选）extract 钩子 ─────────── candidate only
                 └─ 人审 promote ─────────── L3（KB 侧）
```

## 2. 提升 ≠ 归档本身

| 概念 | 是什么 |
| --- | --- |
| **归档（archive）** | 冻结「当时那一版」run 目录副本 |
| **提升（elevate）** | 从本轮交付中抽出 **可复用、可检索** 的能力/知识，写到索引层 |
| **晋升（promote）** | 全局 KB：`candidate → active`（跨仓规范） |

今天 `finalize` = L1 + archive，混在一起；设计上拆开命名，便于过滤与报告。

## 3. L1：本仓能力提升（怎么提）

### 3.1 触发

| 入口 | L1 |
| --- | --- |
| `jj ralph finalize` / skill accept 后默认 finalize | ✅ |
| 仅 `archive`（无 map-merge） | ⚠️ 应视为残缺；skill **优先 finalize** |
| `ABANDONED` | ❌ 禁止 |
| accept ≠ PASS 且无 force | ❌ |

### 3.2 输入 → CAP 字段

从 **当前 run**（非聊天）组装一条 capability：

| CAP 字段 | 来源 | 规则 |
| --- | --- | --- |
| `id` | `run.capability_ids[0]` 或 `CAP-` + run_id 派生 | 稳定优先；用户/agent 可在 analyze 指定 CAP |
| `title` | `run.title` | 覆盖写最新 |
| `summary` | `run.goal` | 覆盖写最新 |
| `status` | 默认 `done` | 可参数覆盖 |
| `modules` | finalize 参数 / scope.in / 实际 diff 路径 | **合并** union |
| `keywords` | 参数 + title/goal 分词 | union；可降噪（停用词） |
| `acceptance` | acceptance 路径 | union |
| `run_refs` | `[run.run_id]` | union（同 CAP 多轮 run） |
| `lessons` | 见 §3.3 分类 | 分桶后合并 |

### 3.3 Lessons 分桶（提升质量核心）

今天 `deriveAutoLessonsFromRun` 把 STAGNATION 等直接并进 `lessons`，会脏。设计改为：

| 桶 | 字段（map 扩展或约定前缀） | 内容 | 进 map-find 主检索？ |
| --- | --- | --- | --- |
| **durable** | `lessons`（或 `lessons_durable`） | 产品/工程不变式；accept 证据支撑；operator 显式 lesson | ✅ 主 |
| **process** | `process_lessons`（或 `lessons` 前缀 `process:`） | STAGNATION / MAX_ITERATIONS / intensity 提示 | ⚠️ 弱检索 / 可关 |
| **discard** | 不写 map | 中间失败叙事、无证据句 | ❌ |

**默认 durable 抽取：**

1. `finalize --lessons "a|b"` 显式传入  
2. `acceptance.md` 中 PASS 行的短结论（可选启发式，Wave 1）  
3. analyze 约定段 `## 可复用知识` / `## Durable lessons`（可选）

**默认 process：** 仅 `deriveAutoLessonsFromRun` 输出。  
**配置：** `ralph.elevation.include_process_lessons` 默认 `false` 进主 `lessons`（与现状相反，属行为收紧；可用 flag 恢复旧行为）。

### 3.4 合并策略（同 CAP 再归档）

```text
已有 CAP-x + 新 run 再 finalize
  title/summary/status ← 新 run（current truth）
  modules/keywords/acceptance/run_refs ← union
  durable lessons ← union；若 supersede 语义（同 run 纠正）可标记替换（可选）
  process lessons ← 有界：每 CAP 最多保留 last-N 或仅最新 run
```

**同 run 多次 re-archive：** 同一 `run_id` 只出现一次在 `run_refs`；字段以最新 accept 为准 + union。

### 3.5 检索怎么用提升结果

```text
map-find(query)
  → 扫 business-map.capabilities（id/title/summary/keywords/modules/lessons/run_refs）
  → 命中 CAP
  → discover_paths = .workflow/ralph/<run_id>/{run.json,progress,analyze,plan,acceptance}
```

注意：路径指向 **权威 run 目录**，不是 `archive/` 为主（archive 是审计副本）。

### 3.6 用户/报告话术（L1）

```text
已提升本仓能力：CAP-login-reminder
- modules: 2
- durable lessons: 2
- process lessons: 0（已隔离）
- run_refs: RALPH-…
```

用户 **不需要** 说 map-merge。

## 4. L2：全局候选（怎么提）

详见 `ralph-knowledge-contribute.md`。此处只定与 L1 的衔接。

### 4.1 触发

| 时机 | 行为 |
| --- | --- |
| finalize 成功后 | **必写** `knowledge-contribution.json`（从 **同一套 elevation 分类结果** 生成） |
| 用户「投喂知识库」 | `knowledge-contribute --hook` |
| hook=cli/http | 外置 extract → **candidate only** |

### 4.2 L1 → L2 字段映射

| L1 (CAP) | L2 candidate |
| --- | --- |
| title / summary | title / summary |
| modules / keywords | keywords + body 模块列表 |
| durable lessons | type=lesson 或并入 capability body |
| process lessons | **默认不进 L2** |
| run_refs + git head | provenance |
| existing knowledge_refs on run | relations / 避免重复 |

L2 **不得**比 L1 更脏：L1 已过滤的 process 默认不投喂全局。

### 4.3 失败策略

| 失败 | 影响 |
| --- | --- |
| L1 map-merge 失败 | **整次 finalize 失败**（主提升） |
| L2 写包失败 | 应极少；失败则 finalize 失败或降级记 progress（实现选：写包失败 = 硬失败更简单） |
| L2 hook 失败 | **不影响** 已成功的 L1 + archive |

## 5. L3：全局 active（怎么提）

**不在 jj-flow 归档路径内。**

```text
KB: human-review / promote / auto-promote(policy)
```

jj-flow 最多在报告里提示：「候选已投喂，请在知识库审核晋升」。

## 6. 端到端流程（推荐默认）

```text
accept PASS
  → elevateLocal (map-merge with lesson buckets)     // L1
  → archive snapshot                                  // 审计
  → write knowledge-contribution.json                 // L2 package
  → [if config.hook] extract → candidate              // L2 hook, fail-open
  → report:
       本仓能力已更新 CAP-…
       全局：已写贡献包 | 钩子 ok/skip/fail
       口语下一步：需要进全局库就说「投喂知识库」
```

### 6.1 skill 决策树

```text
用户：做完了 / 归档 / 收尾
  → finalize（含 L1+L2 包）
用户：投喂知识库 / 补充全局知识
  → knowledge-contribute --hook（若包已存在可只 hook）
用户：不要进地图
  → 显式 finalize --no-map（可选，非默认；或 tiny 策略）
用户：不做了
  → abandon，无 L1/L2
```

## 7. 配置草案

```json
{
  "ralph": {
    "elevation": {
      "local_map": true,
      "include_process_lessons_in_map": false,
      "process_lessons_cap_per_capability": 5,
      "contribution_package": true,
      "knowledge_hook": "none",
      "knowledge_hook_fail_open": true
    }
  }
}
```

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `local_map` | true | L1 |
| `include_process_lessons_in_map` | false | 收紧现状脏 map |
| `contribution_package` | true | L2 包 |
| `knowledge_hook` | none | none \| cli \| http |

## 8. API 草图

```js
// 统一 elevation 结果（L1 与 L2 共用）
export function buildElevationFromRun(run, options, cwd) {
  return {
    capability,           // 给 map-merge
    durable_lessons,      // string[]
    process_lessons,      // string[]
    contribution          // knowledge-contribution object
  };
}

export function elevateLocalMap(runId, options, cwd) { /* map-merge 用 buildElevation */ }
export function writeContribution(runId, elevation, cwd) { /* ... */ }
export function finalizeRun(...) {
  const el = buildElevationFromRun(...);
  elevateLocalMap(...);
  archiveRun(...);
  writeContribution(...);
  maybeHook(...); // fail-open
}
```

## 9. 与现状差异（实现时注意）

| 现状 | 目标 |
| --- | --- |
| auto lessons 直接进 `lessons` | 默认进 process 桶 |
| finalize = map + archive | + 贡献包；报告分「本仓提升 / 全局候选」 |
| 无全局投喂 | L2 包 + 可选钩子 |
| 用户不知是否被索引 | 完成报告固定写 CAP id |

兼容：`include_process_lessons_in_map: true` 恢复旧 map 行为。

## 10. 验收标准

1. finalize 后 `business-map` 含 CAP 且 `run_refs` 含本 run。  
2. `map-find` 能用 title/关键词找回并展开 discover_paths。  
3. 默认 process 不进主 `lessons`（或可测开关）。  
4. 存在 `knowledge-contribution.json`；hook 失败 archive 仍成功。  
5. ABANDONED 无 map、无贡献包。  
6. 用户文档：口语「做完归档」= 本仓提升；「投喂知识库」= L2。

## 11. 分波

| Wave | 交付 |
| --- | --- |
| **E0** | 文档 + 报告话术；明确 L1 即今日 finalize（行为说明） |
| **E1** | lessons 分桶 + finalize 报告 CAP；合约测试 |
| **E2** | contribution 包（= knowledge-contribute Wave 0） |
| **E3** | hook + skill「投喂」 |

## 12. 一句话

**提升 = 归档时把本轮可复用结论写进可检索索引：默认写本仓 CAP 地图；顺带写全局候选包；绝不在归档时自动 promote 全局 active。**
