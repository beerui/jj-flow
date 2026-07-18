# Agent Harness 系统设计

> 状态：Implemented
>
> 验收证据：`docs/milestones/h5-acceptance.md`、`docs/milestones/h5-gc-baseline.json`、`tests/harness-gc.test.mjs`、`npm run verify`
>
> 实施边界：Repository Harness 已实现；真实 Codex App Host、自动修复 Gardener 和 A4 集成不包含在本状态内
>
> 适用范围：`jj-flow` 仓库自身的开发、验证、审查和长期维护
>
> 核心目标：让 Agent 能从仓库中理解系统、执行工作、验证结果并纠正偏差，只把真正需要判断的事项交给人

## 1. 原始问题

`jj-flow` 已经有较强的编排协议：稳定 `task_key`、control-plane manifest、revision CAS、结构化 receipt、只读 Reviewer、独占 worktree 和 fail-closed 门禁。问题不在于再加一层“更聪明”的调度，而在于这些能力能否被未来的 Agent 稳定发现、正确使用并持续维护。

当前最直接的风险是知识没有统一的机器索引：`README.md`、`AGENTS.md`、`ARCHITECTURE.md`、design docs、schemas 和 tests 各自正确，但 Agent 仍需自行判断应该先读什么、哪些规则具有权威性。继续提高自治会放大导航错误，而不是提高可靠性。

因此，Harness Engineering 的第一目标不是自动 merge，也不是更多 Agent，而是建立一个闭环：

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
| 仓库是记录系统 | 权威设计、ADR、计划和契约必须进入 Git；manifest 只索引这些 versioned 文件 | 不把聊天、memory 或未提交的本地状态当事实 |
| 优先 Agent 可读性 | 命令支持 JSON；错误包含原因、证据和下一动作；场景可以一键重放 | 不为追求“AI 原生”重写成熟的 Node.js 基础能力 |
| 强制不变量，不微观管理实现 | 用 schema、结构测试和自定义检查器约束边界 | 不规定每个函数如何写，也不锁死可替换工具 |
| UI、日志、指标都应可被 Agent 观察 | jj-flow 是 CLI/协议系统，优先提供事件 trace、状态 diff 和 scenario report | 暂不引入完整 Prometheus/TraceQL 栈 |
| 持续清理熵 | 定期检查文档漂移、重复规则、孤儿计划、schema/validator 偏差 | 不允许清理任务静默删除业务产物 |
| 人类掌舵，Agent 执行 | 人只处理业务歧义、风险接受和不可逆操作 | 不把“完全无人审查”当目标 |

## 3. 当前基线

评分只表示 Harness 成熟度：`0` 为缺失，`1` 为人工能力，`2` 为部分机械化，`3` 为端到端机械化。

| 维度 | 当前 | 证据与缺口 |
| --- | ---: | --- |
| 导航地图 | 3 | `AGENTS.md` 保持短小，根 `ARCHITECTURE.md` 给出代码地图；两者都由项目检查和 Harness manifest 强制要求 |
| 真相一致性 | 3 | `harness-manifest.json` 声明 versioned authorities、历史非权威资料和禁止路径；Doctor 只从这些事实生成诊断 |
| 不变量执行 | 3 | schema、合同测试、CAS、sandbox/worktree、protocol parity、host action allowlist、文档新鲜度和 design status 门禁均已接入 `npm run verify` 与 CI |
| 可重放反馈 | 3 | `jj scenario` 已覆盖 happy path、中断恢复、部分目标失败和 handoff 契约，统一 report 可做纯状态 replay |
| 可观测性 | 2 | `jj doctor --json` 和 trace 已覆盖仓库内诊断；完整跨 host telemetry 仍延期 |
| 自主闭环 | 2 | Reviewer/Developer 返工闭环已有半真实证据；真实 Codex App Host 验收仍待完成 |
| 熵控制 | 2 | `harness:gc` 已机械扫描并进入 CI；自动修复 Gardener 仍关闭 |

结论：先修复 Repository Truth Plane，再建设更高自治。直接从自动派发或自动合并开始，路径更长且风险更高。

## 4. 目标架构

```text
┌──────────────── Repository Truth Plane ────────────────┐
│ AGENTS map | ARCHITECTURE map | design/ADR/spec/plan   │
│ harness manifest | executable schemas + tests          │
└──────────────────────────┬──────────────────────────────┘
                           │ context package
┌──────────────────────────v──────────────────────────────┐
│ Harness Control Plane                                  │
│ doctor | invariant checks | scenario runner | policies │
└───────────────┬──────────────────────────┬──────────────┘
                │                          │
        ┌───────v────────┐         ┌───────v────────────┐
        │ jj-same        │         │ jj-dispatch       │
        │ migration/sync │         │ task/CAS/receipts │
        └───────┬────────┘         └───────┬────────────┘
                └──────────────┬───────────┘
                               │ allowlisted host actions
                    ┌──────────v───────────┐
                    │ Codex/Claude/Git     │
                    │ target worktrees     │
                    └──────────┬───────────┘
                               │ evidence + trace
                    ┌──────────v───────────┐
                    │ verify/review/rework │
                    │ entropy collection   │
                    └──────────────────────┘
```

Harness Control Plane 不接管 `jj-same` 或 `jj-dispatch` 的业务职责。它只保证 Agent 获得正确上下文、在正确权限中执行，并收到足以自我纠正的反馈。

## 5. Repository Truth Plane

### 5.1 权威层级

不同问题使用不同事实源，不能用一个文件回答所有问题：

| 问题 | 权威事实源 |
| --- | --- |
| 当前代码如何运行 | source、schema、tests、package scripts |
| 系统职责和边界是什么 | `ARCHITECTURE.md`、Accepted ADR、Accepted design doc |
| 产品希望实现什么 | versioned product spec、验收标准 |
| 一次交付推进到哪里 | control-plane manifest、Git commit、verification/review artifact |
| Agent 下一步读什么 | `AGENTS.md` 和文档索引 |

聊天、thread 展示状态、memory 和本机缓存只能提供线索，不能覆盖这些事实源。

### 5.2 渐进式披露

- `AGENTS.md`：只保存全局不变量和导航入口，继续保持短小。
- `ARCHITECTURE.md`：保存稳定物理代码地图和系统边界，不追随每次实现变化。
- `docs/design-docs/`：保存跨模块目标设计和 Locked/Free/Deferred 决策。
- `docs/adr/`：保存已经接受且需要长期追溯的架构决策。
- `docs/exec-plans/`：复杂实施计划的版本化位置，分 `active/` 与 `completed/`；索引、状态和站点构建由 Harness 门禁检查。
- `.codex/skills/`、`.claude/commands/`、schemas 和 tests：保存可执行协议。
- 未被 manifest 索引的本地目录、聊天和 memory：不参与仓库事实判断，也不能推进检查点。

### 5.3 Harness Manifest

versioned `harness-manifest.json` 集中声明机器需要发现的内容，而不是把规则埋在 prose 中。当前已登记权威文档、验证能力、架构不变量、自主等级和禁止路径；后续扩展职责包括：

- 权威文档及其用途；
- 可调用能力、命令和输出格式；
- 每项不变量对应的检查命令；
- 可重放场景及验收信号；
- 自主等级所需 capabilities 和人工批准点；
- 明确禁止作为状态源的本地路径。

Manifest 只做索引，不复制文档正文。其 schema 必须被 `npm run verify` 校验。

## 6. 机械门禁

`scripts/check-harness.mjs` 和 `npm run harness:check` 已并入 `npm run verify`。检查失败时，每条 finding 都包含 `rule_id`、`path`、`reason` 和 `next_action`。

已实现：

1. `AGENTS.md`、`ARCHITECTURE.md`、design index、ADR index 和 manifest 必须存在并可互相发现。
2. `AGENTS.md` 只做地图，超过约定行数或复制大段下游文档时失败。
3. Manifest、schema、npm scripts、invariant enforcer 和 autonomy approval 的结构必须一致。
4. manifest 声明的 forbidden path 出现时检查失败，避免隐藏状态重新成为事实来源。
5. dispatch runtime、control-plane schema、receipt schema、skill contract 和 fixtures 的关键枚举必须一致。
6. runtime 只输出 allowlist 中的 host action；每个 action 显式携带 required capabilities、agent、sandbox、environment 和 worktree policy。
7. 当前文档不得把已移除命令当活入口；历史资料目录明确排除，不参与当前事实判断。
8. 新 design 和 ADR 必须同时进入各自索引与文档站构建清单；Implemented design 必须引用测试或版本化验收产物。

约束只覆盖边界和正确性。模块内部如何组织、使用何种验证库、如何表达提示词，仍由实现者自主决定。

## 7. Agent 可读反馈

### 7.1 Doctor

只读命令 `jj doctor --json` 回答“这个仓库现在能安全做什么”：

- 当前版本、Git 状态和关键文件是否齐全；
- manifest 声明的权威文件、禁止路径和 required links 是否满足；
- Codex/Claude/Maestro capabilities 是否可用；
- schema、skill、tests 和 docs 是否漂移；
- 可以进入的 autonomy level；
- 阻塞原因和精确下一动作。

Doctor 不修复、不安装、不派发，只提供确定性诊断。

### 7.2 Scenario Runner

新增 `jj scenario run <scenario> --json`，把现有单元测试提升为 Agent 可直接调用的任务级反馈：

- `dispatch-happy-path`：PREVIEW、批准、分析、开发、review、target verification；
- `dispatch-interrupted-resume`：中断、UNKNOWN、RECONCILE、receipt replay；
- `dispatch-partial-target-failure`：一个目标失败，不影响其他目标推进；
- `same-handoff-contract`：handoff snapshot、目标差异和 freshness 契约一致性。

每次运行使用内存状态和固定 fixture，不接触真实业务仓库，也不执行 host actions。输出统一 scenario report 和 trace；失败必须指出最早违反的不变量。

### 7.3 Trace 与 Replay

在现有 control-plane events 之上定义 trace envelope：

- `run_id`、`delivery_id`、`task_key`；
- `revision_before` / `revision_after`；
- 输入 receipt 和 approval 的稳定引用；
- 产生的 actions、decisions、waits 和 evidence refs；
- host 返回的 sandbox/worktree attestation；
- 失败分类与 remediation。

`jj trace explain` 用于人和 Agent 阅读，`jj trace replay` 只重放纯状态转换，不重复外部副作用。

## 8. 自主等级

| Level | 能力 | 默认策略 |
| --- | --- | --- |
| A0 Inspect | 读取仓库、doctor、解释状态 | 自动允许 |
| A1 Propose | 分析、计划、PREVIEW、生成候选 actions | 自动允许，不产生外部写入 |
| A2 Isolated Execute | 在获批目标独占 worktree 中修改并验证 | 需要批准快照、sandbox attestation 和 rollback 路径 |
| A3 Review Loop | Reviewer/Developer 自动返工直到 PASS 或预算耗尽 | 需要稳定 scenario、最大 attempt 和明确 escalation |
| A4 Integrate | merge、push、release | 默认关闭；必须有显式策略和不可逆操作批准 |

升级等级依据机械证据，不依据“模型看起来更强”。出现业务歧义、证据冲突、权限扩大、预算耗尽或不可逆操作时，统一转换为结构化 `decision_required`，只在这些位置消耗人的注意力。

## 9. 熵与垃圾收集

新增周期性 `harness:gc` 扫描，但首版只产出 findings 或 PR，不直接删除和重写：

- versioned docs 与实现不一致；
- 未登记的本地状态目录或未索引文档；
- 重复、冲突或无 owner 的规则；
- 已完成但未归档的 exec plan；
- 无测试消费的 schema 字段和 fixture；
- 长期未出现的 host action 或错误分支；
- 反复出现的局部 helper、错误处理和提示模式。

人类审查中反复出现的意见，应优先转成 lint、schema、测试或可复用 helper。只有无法机械表达的判断才保留为文档原则。

## 10. 实施顺序

### H0：设计进入记录系统（已完成）

本设计文档、设计索引、文档导航和项目文件检查进入仓库。此阶段不改变运行时。

验收：新 Agent 能从 `AGENTS.md` 或文档首页找到本设计；缺失设计文件时 `npm run check` 失败。

### H1：修复真相源（已完成）

- 引入 `harness-manifest.json` 及 schema；
- 删除本仓库遗留的隐藏状态读取和项目验证逻辑；
- 实现 `jj doctor --json` 对 versioned truth、required links 和 forbidden paths 的检查；
- 清理当前过时的“薄适配层”和旧入口知识。

验收：fresh clone 只依赖 versioned 文件即可完成项目导览；创建 manifest 禁止的本地状态目录时 doctor 明确失败。

### H2：把边界变成代码（已完成）

- 实现 `scripts/check-harness.mjs`；
- 校验 docs 索引、新鲜度、schema/validator/skill parity 和 host action allowlist；
- 把检查并入 `npm run verify` 和 CI。

验收：破坏任一架构不变量时，Agent 能从错误信息直接定位并修复。

### H3：可重放反馈（已完成）

- 实现 scenario runner、统一 report、trace envelope 和纯 replay；
- 先覆盖 dispatch 中断恢复，再覆盖 same handoff 契约；
- 使用内存状态和固定 fixture，保证任务间隔离且不触发外部副作用。

验收：一个命令可复现完整 dispatch 恢复链并输出可审计 trace；重复运行结果确定且不触发真实副作用。

验收证据：`tests/scenario-runner.test.mjs`、`tests/harness-check.test.mjs`、`npm run scenario:check`、`schemas/dispatch-trace.schema.json` 和 `schemas/scenario-report.schema.json`。

### H4：Host 闭环（已完成 semi-real）

与现有 M7 合并：在真实或半真实控制项目中验证 A2/A3，记录失败恢复、人工升级点和 attention cost。

验收：至少一次端到端试跑、一次中断恢复和一次 Reviewer/Developer 返工闭环都有版本化证据。

验收证据：`docs/milestones/m7-host-trial.json`、`docs/milestones/m7-acceptance.md`、`tests/host-trial.test.mjs` 和 `npm run host:trial`。试跑使用真实临时 Git/worktree 与 CAS，但 `codex_app_threads=false`；真实 Codex App thread/sandbox 联调仍是部署环境验证。

### H5：持续熵清理（已完成）

- 增加质量评分和 `harness:gc`；
- 在 `npm run verify` 中定期生成小型、可审查的 findings；
- 首版不自动修复或合并，所有 `auto_fix_eligible=false`。
- 定时 Gardener 只运行扫描、上传报告并对阻断漂移维护一个去重 issue，不获得代码写权限。

验收：漂移在日常小批次中被发现和修复，不依赖集中式大扫除。

验收证据：`docs/milestones/h5-gc-baseline.json`、`docs/milestones/h5-acceptance.md`、`tests/harness-gc.test.mjs`、`schemas/harness-gc-report.schema.json` 和 `npm run harness:gc`。

## 11. 决策边界

### Locked

- versioned repository 是唯一系统记录；不维护第二套隐藏项目状态。
- `AGENTS.md` 是地图，不是百科全书。
- 外部副作用继续由 host 执行，核心 runtime 不引入 daemon。
- 架构边界使用机械检查，局部实现保留自由。
- A4 默认关闭，人类保留不可逆操作和业务风险的最终判断。

### Free

- manifest 和 trace 的具体 JSON 字段可在实现阶段细化。
- schema 库、自定义 linter 的内部组织和报告渲染方式可替换。
- scenario runner 可以复用 Node test helper，也可以形成独立 CLI 模块。

### Deferred

- 自动 merge、push 和 release 策略；
- 常驻后台 gardener；
- 完整日志、指标和分布式追踪栈；
- 将 Harness 抽象成供其他项目使用的通用平台。

## 12. 系统级验收

设计全部实现后，应满足：

1. 新 Agent 从 fresh clone 出发，不依赖聊天或本机 memory，就能定位系统边界、当前入口和验证方式。
2. 权威文档缺失、链接断裂或禁止的本地状态出现时，机械门禁失败，不允许错误上下文静默进入执行。
3. 每个可写任务都有批准快照、独占 worktree、sandbox attestation、验证和 rollback 路径。
4. dispatch 的完整 happy path、中断恢复和部分失败都能在临时环境一键重放。
5. 每次状态推进都能从 trace 关联到输入、action、receipt、commit 和 evidence。
6. Agent 能自行处理测试、审查和可恢复错误，只在 `decision_required` 出现时请求人类判断。
7. 文档和架构漂移通过小批次 gardener findings 持续收敛。

这套设计的成功指标不是“Agent 写了多少代码”，而是完成一个可靠变更所消耗的人类注意力是否持续下降，同时错误上下文、越权写入和不可恢复状态是否没有增加。
