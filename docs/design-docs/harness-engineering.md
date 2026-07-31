# Agent Harness 系统设计

> 状态：Implemented
>
> 范围注记：H0–H5 Repository Harness；不含真实 Host Wave 2 / A4 / 自动修复
>
> 验收证据：`docs/milestones/h5-acceptance.md`、`docs/milestones/h5-gc-baseline.json`、`docs/milestones/m7-acceptance.md`、`tests/harness-gc.test.mjs`、`tests/scenario-runner.test.mjs`、`npm run verify`
>
> 实施边界：Repository Harness 已实现；**真实** Codex App / Grok Host attestation、自动修复 Gardener 和 A4 集成 **不包含** 在本状态内（见 [真实 Host 验收](../milestones/real-host-acceptance.html)）
>
> 适用范围：`jj-flow` 仓库自身的开发、验证、审查和长期维护
>
> 核心目标：让 Agent 能从仓库中理解系统、执行工作、验证结果并纠正偏差，只把真正需要判断的事项交给人
>
> **活地图**：当前模块与产品面以根目录 `ARCHITECTURE.md` 与 [架构](../architecture.html) 为准；本文保留目标原则与 H0–H5 验收记录，§3/§4 已按 2026-07 产品面回写。

## 1. 原始问题

`jj-flow` 已经有较强的编排协议：稳定 `task_key`、control-plane manifest、revision CAS、结构化 receipt、只读 Reviewer、写工作区策略（默认 project-branch，isolation 时 exclusive-worktree）和 fail-closed 门禁。问题不在于再加一层“更聪明”的调度，而在于这些能力能否被未来的 Agent 稳定发现、正确使用并持续维护。

风险是知识没有统一的机器索引：`README.md`、`AGENTS.md`、`ARCHITECTURE.md`、design docs、schemas 和 tests 各自正确，但 Agent 仍需自行判断应该先读什么。继续提高自治会放大导航错误。

因此 Harness Engineering 的第一目标不是自动 merge，而是闭环：

```text
明确意图 -> 找到权威上下文 -> 在隔离环境执行 -> 获得机器可读反馈
    ^                                               |
    |                                               v
更新规则/工具 <- 归因失败是缺工具、缺约束还是缺知识 <- 验证与审查
```

## 2. 从文章吸收什么

| 文章经验 | 在 jj-flow 中的落点 | 不照搬的部分 |
| --- | --- | --- |
| 给 Agent 一张地图，不是一本手册 | 保持 `AGENTS.md` 简短；用 `ARCHITECTURE.md` 和分层 docs 做渐进式披露 | 不把所有 workflow 细节复制进 `AGENTS.md` |
| 仓库是记录系统 | 权威设计、ADR、计划和契约必须进入 Git；manifest 只索引 versioned 文件 | 不把聊天、memory 或未提交本地状态当事实 |
| 优先 Agent 可读性 | 命令支持 JSON；错误含原因、证据和下一动作；场景可一键重放 | 不为“AI 原生”重写成熟 Node 基础能力 |
| 强制不变量，不微观管理实现 | schema、结构测试和自定义检查器约束边界 | 不规定每个函数如何写 |
| UI、日志、指标都应可被 Agent 观察 | 优先 event trace、状态 diff 和 scenario report | 暂不引入完整 Prometheus 栈 |
| 持续清理熵 | `harness:gc` 扫描漂移、重复规则、schema 偏差 | 不允许清理任务静默删除业务产物 |
| 人类掌舵，Agent 执行 | 人处理业务歧义、风险接受和不可逆操作 | 不把“完全无人审查”当目标 |

## 3. 当前成熟度（2026-07 回写）

评分：`0` 缺失 · `1` 人工 · `2` 部分机械 · `3` 端到端机械。

| 维度 | 当前 | 证据与缺口 |
| --- | ---: | --- |
| 导航地图 | 3 | `AGENTS.md` + `ARCHITECTURE.md` + design/exec 索引；Harness 强制行数与可发现性 |
| 真相一致性 | 3 | `harness-manifest.json` 登记 authorities、forbidden paths、scenario/schema；Doctor 只读诊断 |
| 不变量执行 | 3 | schema、合约测试、CAS、host allowlist、protocol parity、docs 索引/站点门禁进 `npm run verify` |
| 可重放反馈 | 3 | 4 个确定性 scenario + pure trace replay；无真实 host 副作用 |
| 可观测性 | 2 | `jj doctor --json`、trace、scenario report、plane-self-check；跨 host 完整 telemetry 仍延期 |
| 自主闭环 | 2 | 半真实 A2/A3 返工已有 M7 证据；**真实 Host 验收仍 pending**；`max_unattended_level=A1` |
| 熵控制 | 2 | `harness:gc` 只读评分进 CI；自动修复 Gardener 关闭；语义正文漂移靠人工/后续规则 |

结论：Repository Truth Plane 与机械门禁已闭合。下一跳是 **真实 Host attestation（Wave 2）**，不是再堆文档散文。

## 4. 目标架构（与产品面对齐）

```text
┌──────────────── Repository Truth Plane ────────────────┐
│ AGENTS | ARCHITECTURE | design/ADR/plan | harness      │
│ manifest | schemas | tests | skill inventory           │
└──────────────────────────┬──────────────────────────────┘
                           │ context package
┌──────────────────────────v──────────────────────────────┐
│ Harness Control Plane                                   │
│ doctor | check-harness | scenario | trace | harness:gc  │
└────┬───────────┬───────────┬───────────┬────────────────┘
     │           │           │           │
┌────v────┐ ┌────v────┐ ┌────v────┐ ┌────v─────┐
│ jj-same │ │ jj-ralph│ │jj-dispat│ │jj-review │
│ migrate │ │ 闭环/地图│ │ 调度CAS │ │ REV 映射 │
└────┬────┘ └────┬────┘ └────┬────┘ └────┬─────┘
     │           │           │           │
     │      handoff/snap     │           │
     └───────────┴─────┬─────┴───────────┘
                       │ allowlisted host actions
            ┌──────────v───────────┐
            │ Codex / Grok / Qoder │  Claude 薄命令（无 dispatch）
            │ Git · project-branch │  isolation → exclusive-worktree
            └──────────┬───────────┘
                       │ evidence + trace
            ┌──────────v───────────┐
            │ verify / review loop │
            │ portfolio knowledge  │
            │ jj-evaluated (MVP)   │
            └──────────────────────┘
```

Harness Control Plane **不**接管 same / ralph / dispatch 的业务职责。它只保证 Agent 获得正确上下文、在正确权限中执行，并收到足以自我纠正的反馈。

相关横切：

- 控制状态默认 `control_root`（`~/.jj-flow`），业务仓发起调度  
- Portfolio KB 外置；ralph 硬接线 `knowledge_refs`  
- Skill SSOT：`.codex/skills/`（多端 install）；Claude 仅 `.claude/commands/` 薄入口  

## 5. Repository Truth Plane

### 5.1 权威层级

| 问题 | 权威事实源 |
| --- | --- |
| 当前代码如何运行 | source、schema、tests、package scripts |
| 系统职责和边界 | `ARCHITECTURE.md`、Accepted ADR、Implemented design |
| 产品希望实现什么 | versioned product spec、验收标准、Proposed design |
| 一次交付推进到哪里 | control-plane / ralph run、Git commit、verification/review artifact |
| Agent 下一步读什么 | `AGENTS.md` 和文档索引 |

聊天、thread 展示状态、memory 和本机缓存只能提供线索，不能覆盖这些事实源。

### 5.2 渐进式披露

- `AGENTS.md`：全局不变量和导航入口，保持短小  
- `ARCHITECTURE.md`：稳定物理代码地图和系统边界  
- `docs/design-docs/`：跨模块目标设计；Implemented 后须与产品面回写或明确“历史实施记录”  
- `docs/adr/`：已接受且需长期追溯的决策  
- `docs/exec-plans/`：复杂实施计划（`active/` / `completed/`）  
- `.codex/skills/`、schemas、tests：可执行协议  
- 未索引本地目录、聊天、memory：不参与仓库事实判断  

### 5.3 Harness Manifest

`harness-manifest.json` 集中声明权威文档、能力、不变量、场景、自主等级和禁止路径。只做索引，不复制正文；schema 由 `npm run verify` 校验。

## 6. 机械门禁

`scripts/check-harness.mjs` 与 `npm run harness:check` 已并入 `npm run verify`。失败 finding 含 `rule_id`、`path`、`reason`、`next_action`。

已实现：

1. 地图与索引文件存在且可互相发现  
2. `AGENTS.md` 行数与职责边界  
3. Manifest / schema / scripts / autonomy 结构一致  
4. forbidden path 出现则失败  
5. dispatch runtime / schema / skill / fixture 枚举 parity  
6. host action allowlist 与 policy 字段  
7. 已移除命令不得当活入口；`docs/other`、`docs/evaluations` 可排除  
8. 新 design/ADR 进索引与站点构建；Implemented 须引用测试或版本化验收  

约束只覆盖边界和正确性，不锁死模块内部实现。

## 7. Agent 可读反馈

### 7.1 Doctor

`jj doctor --json`：版本、Git、权威文件、capabilities、可进入 autonomy level、阻塞与下一动作。只读，不修复、不派发。

### 7.2 Scenario Runner

`jj scenario run <scenario> --json`（及 `npm run scenario:check`）：

- `dispatch-happy-path`
- `dispatch-interrupted-resume`
- `dispatch-partial-target-failure`
- `same-handoff-contract`

内存状态 + 固定 fixture，不接触真实业务仓，不执行 host actions。

### 7.3 Trace 与 Replay

trace envelope：`run_id` / `delivery_id` / `task_key`、revision 前后、receipt/approval 引用、actions、evidence refs、失败分类。`jj trace replay` 只重放纯状态转换。

### 7.4 半真实 Host trial

`npm run host:trial`：临时 Git/worktree + CAS + Review 返工；`codex_app_threads=false`。证据：`docs/milestones/m7-host-trial.json`。

## 8. 自主等级

| Level | 能力 | 默认策略 |
| --- | --- | --- |
| A0 Inspect | 读取仓库、doctor、解释状态 | 自动允许 |
| A1 Propose | 分析、计划、PREVIEW、候选 actions | **当前 max_unattended**；不产生未批准外部写入 |
| A2 Isolated Execute | 获批写工作区修改并验证 | 需批准快照 + **真实** sandbox attestation + rollback |
| A3 Review Loop | Reviewer/Developer 自动返工 | 需稳定 scenario、attempt 上限、escalation |
| A4 Integrate | merge、push、release | 默认关闭 |

升级依据机械证据，不依据“模型看起来更强”。业务歧义、证据冲突、权限扩大、预算耗尽或不可逆操作 → 结构化 `decision_required`。

## 9. 熵与垃圾收集

`harness:gc` 首版只产出 findings，不直接删除/重写：

- versioned docs 与实现结构不一致（索引/schema/覆盖）  
- 未登记本地状态或未索引文档  
- 重复/无 owner 规则  
- 已完成但未归档的 exec plan  
- 无测试消费的 schema 字段  
- 重复局部 helper  

**已知盲区**：散文级“设计正文与产品面脱节”不在默认阻断规则内；依赖 design 回写与人工审查（本文 §3/§4 即此类维护）。

人类反复意见应优先转成 lint、schema、测试或 helper。

## 10. 实施顺序（历史验收，全部完成）

| 阶段 | 状态 | 要点 |
| --- | --- | --- |
| H0 设计入库 | 已完成 | 本设计 + 索引 + 项目检查 |
| H1 真相源 | 已完成 | manifest、doctor、清理隐藏状态 |
| H2 边界代码化 | 已完成 | `check-harness` 进 verify/CI |
| H3 可重放反馈 | 已完成 | scenario + trace + schemas |
| H4 Host 闭环 | 已完成 **semi-real** | M7；真实 Host 另里程碑 |
| H5 持续熵清理 | 已完成 | `harness:gc` 只读 + baseline |

详细证据见对应 `docs/milestones/*` 与 `tests/*`。

## 11. 决策边界

### Locked

- versioned repository 是唯一系统记录  
- `AGENTS.md` 是地图，不是百科全书  
- 外部副作用由 host 执行；核心 runtime 无 daemon  
- 架构边界用机械检查；局部实现自由  
- A4 默认关闭；真实 Host 未关闭前 max 保持 A1  

### Free

- manifest / trace 字段细化  
- linter / 报告渲染可替换  
- scenario runner 可独立 CLI 模块  

### Deferred

- 自动 merge / push / release  
- 常驻写权限 gardener  
- 完整分布式追踪栈  
- 将 Harness 抽象为通用多项目平台  
- 语义设计漂移的强制 GC 规则  

## 12. 系统级验收

设计全部实现后应满足（H0–H5 已满足 1–5、7 的机械部分；6 依赖真实 Host）：

1. 新 Agent 从 fresh clone 定位边界、入口和验证方式  
2. 权威文档缺失或禁止本地状态出现时门禁失败  
3. 可写任务有批准快照、写工作区绑定、验证与 rollback 路径（半真实已证明；真实 attestation 待 Wave 2）  
4. dispatch happy path / 中断恢复 / 部分失败可一键重放  
5. 状态推进可从 trace 关联输入、action、receipt、commit、evidence  
6. Agent 自行处理可恢复错误；`decision_required` 才消耗人类注意力（真 Host 后强化）  
7. 结构漂移经 gardener findings 小批次收敛  

成功指标不是“Agent 写了多少代码”，而是可靠变更消耗的人类注意力是否下降，同时错误上下文、越权写入和不可恢复状态是否没有增加。
