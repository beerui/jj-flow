# 记忆与知识库：怎么用、算不算记住

这页讲 **jj-flow 体系里的记忆与知识**——尤其是外置的 **顶层知识库（Portfolio KB）**——给使用者和 Agent 看。

先建立边界：

| 层 | 位置 | 权威吗 | 用来干什么 |
| --- | --- | --- | --- |
| 顶层知识库 Portfolio KB | `D:/a/knowledge` | **是**（`active` + provenance） | 跨项目能力、规范、模式、教训、域知识 |
| 单仓工作流记忆 | `.workflow/ralph/**`、`business-map.json`、verification/review | **是**（run / checkpoint） | 这一次任务有没有真的发生 |
| 聊天 / thread memory | Codex 会话 | **否** | 触发动作、解释现状，**不能**推进 checkpoint |

口令：

**聊天只能触发；文件才算发生过。顶层知识库记“可复用事实”，ralph run 记“这一次交付事实”。**

---

## 1. 你到底该用哪一层

### 1.1 做单仓需求（Loop / ralph）

1. 在业务仓开 `$jj-ralph`
2. `jj ralph init` **会自动**从 Portfolio KB 挂 `knowledge_refs`（若本机有 `D:/a/knowledge`）
3. 实现与验收仍写在 `.workflow/ralph/RALPH-*/`
4. 验收后 `map-merge` / finalize，让 `business-map.json` 更新——下次 **extract** 才能把新能力抽进知识库

### 1.2 做多项目调度（Graph / dispatch）

1. 控制仓跑 `$jj-dispatch`
2. 每个 target 的 worker 在各自业务仓跑 ralph / same
3. 跨项目复用的规范、识票规则、历史 capability 从 Portfolio KB 查，不要靠“我记得上次……”

### 1.3 做同源迁移（same）

1. 源侧 ralph 闭环 + handoff
2. 目标侧 same 实施
3. 两边共同遵守的约定（标准、模式）优先引用 **active** 知识条目

---

## 2. 顶层知识库是什么

路径：`D:/a/knowledge`

它是 **跨项目** 的知识与记忆管理系统：

- 从 `map.md`、各仓 business-map / wiki / specs **自动抽取**
- 默认进 `candidate`，审核后 `promote` 成 `active`
- CLI + Web 管理 + Agent API
- 与 jj-flow 硬接线：ralph init 自动写 `knowledge_refs`

### 2.1 生命周期

```text
extract → candidate → review → promote | reject
                              ↓
                           active
                              ↓
                         deprecate
```

| 状态 | 含义 | 谁能当规范用 |
| --- | --- | --- |
| `candidate` | 抽出来了 / 手建了，未审核 | 仅参考，不默认当标准 |
| `active` | 已审核，可被 Agent 消费 | **是** |
| `deprecated` | 否决或退役，保留审计 | 否 |

### 2.2 条目类型（常用）

| type | 典型来源 | 用途 |
| --- | --- | --- |
| `capability` | business-map | 某项目已交付能力 |
| `lesson` | business-map / specs | 教训与经验 |
| `standard` | wiki / specs | 规范约定 |
| `pattern` | wiki | 可复用模式 |
| `memory` | wiki / 手工 | 记忆片段 |
| `domain` | 合成 | 业务域卡片 |
| `project_card` | map.md | 项目定位卡片 |

### 2.3 权威原则

**权威：** entry JSON、`index/*`、provenance（source_path / run_refs / evidence）、Git commit、verification

**非权威：** 聊天正文、thread memory、未 promote 的 candidate（可参考但不当铁律）

---

## 3. 5 分钟上手（本机）

### 3.1 启动 Web 管理端

```powershell
cd D:\a\knowledge\tools
node kb.mjs start --port=8787
node kb.mjs status
```

浏览器打开：http://127.0.0.1:8787

你会看到：筛选、多视图、审核队列、批量 promote/reject、Auto-Promote、查重报告、增量/全量抽取。

停止：

```powershell
node kb.mjs stop
```

### 3.2 全量 / 增量抽取

```powershell
# 全量（首次或结构大变）
node D:\a\knowledge\tools\kb.mjs extract

# 日常增量（只扫变更源）
node D:\a\knowledge\tools\kb.mjs extract --incremental
```

抽取源：

| Extractor | 源 | 默认状态 |
| --- | --- | --- |
| map | `D:/a/map.md` | project_card → active |
| business_map | `<repo>/.workflow/ralph/business-map.json` | capability/lesson → candidate |
| wiki | `<repo>/.workflow/wiki-index.json` | standard/pattern/memory → candidate |
| specs | `<repo>/.workflow/specs/*.md` | standard/lesson → candidate |
| domain | 合成 | domain → active |

再次 extract **保留** 已审核状态，不会把你 promote 过的条目打回 candidate。

### 3.3 查询与 Agent 挂载

```powershell
# 人类检索
node D:\a\knowledge\tools\kb.mjs query 零息 --project=cj-web --status=active

# Agent 任务包（推荐）
node D:\a\knowledge\tools\kb.mjs knowledge-for-task --q=零息 --project=cj-web --limit=10

# 项目记忆快照
node D:\a\knowledge\tools\kb.mjs project-memory cj-web
```

### 3.4 审核与晋升

```powershell
# 策略打分（可按项目过滤）
node D:\a\knowledge\tools\kb.mjs policy --project=cj-web --limit=20

# 人工复核队列
node D:\a\knowledge\tools\kb.mjs human-review --project=cj-web --limit=20

# 单条决定
node D:\a\knowledge\tools\kb.mjs review-decide <entry-id> --decision=promote --notes="验收过"
# 也支持：--id=<entry-id>

# 高分自动晋升（先 dry-run）
node D:\a\knowledge\tools\kb.mjs auto-promote --limit=5
node D:\a\knowledge\tools\kb.mjs auto-promote --limit=5 --apply
```

规则在 `D:/a/knowledge/config/default.json`：

- 不同项目阈值不同（如 cj-web 更松、dj-web 更严）
- 不同域（erp / recognize / admin）有 bonus 与 prefer_sources
- `require_human_below_score`：分不够高必须人工

### 3.5 去重与记忆健康

```powershell
node D:\a\knowledge\tools\kb.mjs memory-health
node D:\a\knowledge\tools\kb.mjs dedup          # dry-run
# 确认无误后再：
# node D:\a\knowledge\tools\kb.mjs dedup --apply
```

弱 wiki 空壳（`Entries` / 暂无条目）**不会**被误合并；summary 冲突会 hold。

### 3.6 健康自检（doctor）

每次改完知识库工具、换机器、或怀疑索引坏了，先跑：

```powershell
node D:\a\knowledge\tools\kb.mjs doctor
```

期望输出：

| 字段 | 含义 |
| --- | --- |
| `status` | `PASS` / `FAIL` |
| `checks` | kb_root / map / catalog / search_index / entries_index / config / web_app / load_entries / has_active |
| `next_actions` | PASS 时为 `ready`；FAIL 时列出要修的检查项 |

报告还会写入 `D:/a/knowledge/index/doctor-report.json`。FAIL 时进程退出码为 2。

配套：

```powershell
node D:\a\knowledge\tools\kb.mjs validate
node D:\a\knowledge\tools\kb.mjs test
node D:\a\knowledge\tools\kb.mjs stats
```

---

## 4. 和 jj-flow / ralph 怎么接

### 4.1 自动硬接线（默认开）

```powershell
jj ralph init --run-id RALPH-demo-20260727 --title "零息协议 URL" --goal "..." --project cj-web --json
```

效果：

- `run.json` 写入 `knowledge_refs` / `knowledge_summary`
- `analyze.md` 出现 knowledge 段
- 可能写 sidecar `knowledge-attach.json`
- `jj ralph status` 打印 knowledge_refs

关闭：

```powershell
jj ralph init ... --no-knowledge-refs
```

指定检索：

```powershell
jj ralph init ... --project cj-web --knowledge-query "零息 支付金额"
```

实现位置：`src/portfolioKnowledge.mjs`（jj-flow ≥ 0.1.1-beta.31）。

### 4.2 对话里怎么说

单仓闭环时不必手填知识路径，直接：

```text
$jj-ralph
目标=零息订单业务协议 URL 取后端字段
范围=仅订单详情/协议展示
验收=字段与跳转符合后端
```

Agent 应：

1. 用 map 定位项目
2. 消费 run 上的 `knowledge_refs`（或再查 knowledge-for-task）
3. 改代码并写 verification
4. 结束后更新 business-map / 必要时手建 candidate

### 4.3 交付后如何“记住”

```text
ralph 验收 PASS
  → map-merge / finalize 更新 business-map
  → kb extract --incremental
  → policy / human-review
  → promote 高置信 capability/lesson
  → 下次 ralph init 自动挂上
```

---

## 5. 值班 Checklist

### 每天 / 每周

| 步骤 | 命令或动作 | 完成标准 |
| --- | --- | --- |
| 1. 增量抽取 | `kb.mjs extract --incremental` | stats 更新、无 validate 错误 |
| 2. 看审核队列 | Web「审核队列」或 `human-review` | 高分 suggest-promote 有人处理 |
| 3. 小批量 promote | dry-run 再 `--apply` | active 增长合理，无误升 |
| 4. 记忆健康 | `memory-health` | 弱摘要 / 过期有处理计划 |
| 5. 去重 dry-run | `dedup` | 无意外大合并 |

### 做任务时

| 步骤 | 谁 | 完成标准 |
| --- | --- | --- |
| 定位项目 | map.md | 命中 path / aliases |
| 挂知识 | ralph init 或 knowledge-for-task | run 上有 knowledge_refs |
| 实施 | 业务仓改动 + 验证 | commit + verification |
| 回写 | business-map / wiki / specs | 下次 extract 能抽到 |
| 晋升 | promote active | 可复用事实离开 candidate |

### 禁止事项

- 用聊天结论当 active 规范
- 未 dry-run 就全量 `dedup --apply` / 大批量 `auto-promote --apply`
- 把 candidate 当已验收标准写进生产决策
- 以为“会话里提过”就等于知识库已记住

---

## 6. Web 管理端怎么用

打开 http://127.0.0.1:8787 后：

1. **筛选**：类型 / 状态 / 项目 / 域 / 关键词
2. **视图**：表格、卡片、树、看板、图谱、域、项目板、审核队列
3. **单条**：Promote / Reject / 批注 / 改摘要 / 看 Agent Context
4. **批量**：全选当前列表 → 批量 Promote 或 Reject
5. **Promote 建议项**：按审核建议一键处理
6. **Auto-Promote**：对策略判定为 auto-promote 的高分条目（会先确认）
7. **查重报告**：先看再决定是否 CLI apply
8. **增量 / 全量抽取**：ETL 入口

可选鉴权与局域网：见知识库 `docs/ops-and-access.md`。

---

## 7. Agent 契约（给执行者）

1. 项目定位：`D:/a/map.md`
2. 优先 `status=active`
3. 把 `knowledge_refs` 写进 plan / run.json / handoff，不要只留在回复里
4. 缺知识 → `create` candidate 或等 extract，**不要**只在聊天里编造长期事实
5. checkpoint 仍只认：control-plane、run.json、commit、verification/review

推荐查询：

| 场景 | 查询 |
| --- | --- |
| cj-web 功能 | `--project=cj-web` + capability/standard/pattern |
| 跨产品识票 | `--domain=recognize --status=active` |
| 编码规范 | `--type=standard` + 关键词 convention |

HTTP（服务启动后）：

```text
GET /api/agent/knowledge-for-task?q=零息&project=cj-web&limit=10
GET /api/agent/context?q=零息&project=cj-web
GET /api/project-memory?project=cj-web
```

---

## 8. 与「系统记忆」的关系（一图）

```text
                 ┌──────────────────────────┐
                 │  Portfolio KB (顶层)      │
                 │  active 可复用知识         │
                 └────────────▲─────────────┘
                              │ extract / promote
         ┌────────────────────┴────────────────────┐
         │ 各业务仓 .workflow (ralph/map/wiki/specs) │
         │ 单次交付事实 + 项目记忆                    │
         └────────────────────▲────────────────────┘
                              │ 实现与验收
                     ┌────────┴────────┐
                     │ 聊天 / thread    │  ← 非权威
                     └─────────────────┘
```

jj-flow 负责 **编排与交付事实**；Portfolio KB 负责 **跨项目可复用记忆**。两者互补，不互相替代。

---

## 9. 故障排查

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| ralph init 的 knowledge_refs 为空 | 无 `D:/a/knowledge` 或无 active 命中 | 建库 / extract / promote；或检查 `PORTFOLIO_KB_ROOT` |
| 全是 candidate、没有有用 active | 从未审核 | `policy` + `human-review` + promote |
| Web 打不开 | 服务未 start | `kb.mjs status` / `start` |
| 抽取不到某项目 | map 无该行或源文件不存在 | 查 `D:/a/map.md` 与 `.workflow/**` |
| 去重想合并空壳 Entries | 已防护 | 正常；真重复看 dry-run groups |
| skill 里没有 portfolioKnowledge | 旧 skill | `jj install-skill --force` 或升级 `@shendu-sdt/jj-flow@beta` |

自检：

```powershell
node D:\a\knowledge\tools\kb.mjs doctor
node D:\a\knowledge\tools\kb.mjs validate
node D:\a\knowledge\tools\kb.mjs test
node D:\a\knowledge\tools\kb.mjs stats
```

---

## 10. 相关链接

- 命令：[$jj-ralph](command-jj-ralph.html) · [Loop/Graph 上手](loop-graph-guide.html) · [使用说明](usage.html)
- 设计：[Portfolio Knowledge 设计](design-docs/portfolio-knowledge.html)
- 外置库文档：`D:/a/knowledge/README.md`、`ARCHITECTURE.md`、`docs/*`
- 版本：jj-flow ≥ **0.1.1-beta.31** 含 ralph 硬接线

## 11. 常见问题

### 系统记忆管理目前有吗？

有，而且分两层：

1. **顶层 Portfolio KB**（`D:/a/knowledge`）：跨项目可复用知识；Web + CLI + Agent API；审核后才 active。
2. **项目工作流记忆**（各仓 `.workflow/ralph/**`、business-map、verification/review）：这一次任务是否真的发生过。

**没有**把聊天 thread 当作系统记忆。Codex 会话记忆只能触发动作，不能推进 checkpoint。

### 顶层知识库包含项目吗？

包含。`map.md` 抽 project_card，business-map 抽 capability/lesson，wiki/specs 抽 standard/pattern/memory；条目带 `project_key` / `domain`，可按项目过滤。

### 如何自动提取规范？

1. 业务仓维护 `.workflow/specs/*.md`、wiki、business-map
2. `kb.mjs extract` 或 `--incremental`
3. `policy` / `human-review` 审核
4. `promote` / `auto-promote --apply` 进 active
5. 下次 `jj ralph init` 自动挂 `knowledge_refs`

### 多项目时知识怎么共享？

Graph/dispatch 不复制聊天；各 target 的 ralph 从同一 Portfolio KB 读 active 条目。项目专属用 `--project=`，跨产品识票等用 `--domain=recognize`。

