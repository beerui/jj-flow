# jj-flow 架构

## 概览

`jj-flow` 是项目族编排工作流，解决两个相关问题：

- `jj-same` 在同源但已分叉的仓库之间迁移功能，或持续同步后续变更。
- `jj-dispatch` 从独立控制项目协调一次涉及动态项目集合的交付。

产品本体是编排协议，包括持久身份、证据门禁、可恢复状态转换，以及控制工作与业务代码之间的边界。Codex、Claude Code、Maestro、Git、YApi 和 ARMS 是协议外部的宿主或证据提供者，不定义产品的架构中心。

系统有两条主路径：

```text
same:     需求或 handoff -> 源证据 -> 目标差异分析 -> 按目标原生架构实施
          -> 验证 -> 同步检查点

dispatch: control-plane manifest -> 单次确定性 tick -> host actions
          -> task receipts -> review/verification evidence -> 下一检查点
```

## 代码地图

### 对话入口资产

- `.codex/skills/jj-same/` 定义同源迁移和持续同步协议。`SKILL.md` 是入口；`references/` 保存 handoff、项目族、产物路由和同步契约；`scripts/` 负责采集源证据。
- `.codex/skills/jj-dispatch/` 定义 Codex 专用的控制项目调度协议。其 `references/` 描述控制项目，以及 manifest 和 task receipt 的 JSON 契约。
- `.codex/skills/jj/` 仅为兼容路由，把请求转到原生 `jj-same` 或 `jj-dispatch` 入口。
- `.claude/commands/` 保存 Claude Code 对应命令。`jj-dispatch` 有意不在此暴露。
- `.codex/agents/` 描述只读 Reviewer 和可写 Developer 角色。这里声明的是期望角色；实际 sandbox 和 worktree 以宿主运行时证明为准。

修改用户可见的工作流行为时，应从对应 skill 或 command 资产开始。只有安装或控制平面运行时行为才应先进入 npm CLI。

### Dispatch 协议与运行时

- `src/dispatchControlPlane.mjs` 是纯控制平面状态机。它负责 manifest 校验、稳定 `task_key`、派发批准、task 绑定与对账、任务和审查结果、返工，以及目标完成状态。
- `src/dispatchRuntime.mjs` 是单次 tick 的宿主边界。它校验并幂等应用 receipts，计算下一批 host actions，并通过 `persistPlaneCas` 以 revision compare-and-swap 方式持久化 manifest。
- `src/dispatchHostContract.mjs` 定义 runtime 可输出的 host action 类型、receipt 枚举，以及 read/write 对应的 agent、sandbox、environment 和 worktree policy。`.codex/skills/jj-dispatch/references/host-action-contract.json` 是 skill 侧结构化契约，Harness 检查两者与 schemas、fixtures 的一致性。
- `src/dispatchTrace.mjs` 为纯状态转换记录 before/after hash、输入、输出与 evidence refs，并在 replay 时重新执行状态转换；记录到的 host actions 只计数，不执行。
- `src/scenarioRunner.mjs` 登记 4 个确定性场景，覆盖 dispatch happy path、中断恢复、部分目标失败和 `jj-same` handoff 契约。`src/handoffContract.mjs` 对 handoff snapshot 做 fail-closed 校验。
- `src/hostTrialRunner.mjs` 位于核心状态机之外，在系统临时目录创建控制仓、真实 Git repo 和独占 worktree，验证 CAS、receipt、中断对账及 Reviewer/Developer 返工。它是半真实 Host adapter，不创建或伪造 Codex App task。
- `.codex/skills/jj-dispatch/references/control-plane.schema.json` 和 `task-receipt.schema.json` 是 JavaScript 模块外部消费的序列化契约。修改协议时，必须同步 schemas、skill 说明、fixtures 和运行时校验。
- `tests/jj-dispatch-contract.test.mjs` 检查跨文件的 dispatch 契约；`tests/dispatch-runtime.test.mjs` 覆盖 tick、receipt、恢复和 CAS 行为；`tests/scenario-runner.test.mjs` 覆盖确定性、篡改检测、无副作用与 CLI replay。

状态模块不会创建 task、切换仓库或启动 daemon。它们只返回供 Codex App 宿主执行的 actions。执行结果通过结构化 receipts 返回，并且只有通过协议校验后才能进入状态机。

### 包与维护代码

- `bin/jj.mjs` 是最小可执行入口；`src/cli.mjs` 负责解析命令。
- `src/installSkill.mjs` 安装 Codex skills/agents 和 Claude commands；`src/releaseLog.mjs` 补充当前安装版本的发布说明。
- `src/cli.mjs` 中的 `dispatch-tick` 暴露一个用于维护和调试的运行时 tick。它默认只预览，写入必须经过 CAS 边界；它不是业务交付主入口。
- `src/dispatch.mjs`、`src/recipes.mjs`、`src/evidence.mjs`、`src/guards.mjs`、`src/maestroExecution.mjs` 和 `src/knowledgeLoop.mjs` 实现 CLI 侧的 `same` 辅助 recipe、证据归一化和门禁报告。它们是支撑工具，不是对话工作流的事实来源。
- `src/evidenceProviders.mjs` 把外部输出适配为统一证据结构；`src/maestroCompatibility.mjs` 支持可选工具的兼容性检查。
- `scripts/check-project.mjs` 检查仓库资产不变量；`scripts/build-docs.mjs` 把 `docs/` 下的 Markdown 构建为文档站。
- `harness-manifest.json` 是 Agent 的机器可读仓库地图；它同时登记 scenario registry、运行命令、预期状态和无副作用策略。`scripts/check-harness.mjs` 校验权威资产、导航、能力、自主等级、协议 parity、scenario/schema parity 和禁止的本地状态路径；`src/harnessDoctor.mjs` 只读汇总 Git、Harness 和 host capabilities，供 `jj doctor` 使用。
- `src/harnessGc.mjs` 是只读 gardener：把 Harness 漂移、文档/schema 覆盖、规则 owner 和维护重复转换为分级 findings 与质量分。`docs/milestones/h5-gc-baseline.json` 保存与当前 runner fingerprint 匹配的验收基线；首版不自动修复。

### 文档与测试

- `docs/` 是用户和维护者文档的源目录。`docs/architecture.md` 解释产品架构，`docs/adr/index.md` 索引架构决策及后果；生成的网站不是文档编辑源。
- `docs/design-docs/` 保存跨模块目标设计及其状态。新 design 和 ADR 必须进入索引与站点构建清单；Implemented design 必须引用测试或版本化验收产物。设计描述未来边界，当前实现事实仍由本文件、代码、schema 和测试共同证明。
- `tests/` 与 JavaScript 模块和协议面对应。`tests/fixtures/` 保存契约样例，`examples/` 保存面向用户的证据和控制项目示例。
- `workflows/` 保存随 npm 包分发的可复用工作流资产。

## 架构不变量

1. 只有持久证据能够推进状态，对话正文不能。control-plane manifest、Git commit、verification/review artifact 和 runtime sandbox attestation 是事实；task 状态、memory 和文字总结不是检查点。
2. 控制项目引用业务产物，但不拥有产物正文。需求、源码、diff 和详细验证结果留在产生它们的业务仓库。
3. 控制平面只有一个写者。Worker 返回 receipt，不直接修改批准快照或推进检查点。
4. `task_key` 是可恢复的调度身份。临时 subagent 和 task/thread 的展示状态不能替代它。
5. Reviewer 保持只读。Developer 只在当前任务获批目标的独占 worktree 中写入。
6. 缺少证据时输出 `PENDING` 或 `BLOCKED`，不能推断为 `PASS`。一个目标失败时，不能推进自身检查点，也不能替其他目标宣告完成。
7. `jj-same` 负责迁移、目标适配和同步检查点；`jj-dispatch` 负责项目选择、批准、任务身份、派发和恢复。两者不重写彼此的职责。
8. 外部副作用属于宿主。dispatch 核心代码只计算和校验状态转换，不创建 task，不 merge、push、release，也不运行后台服务。
9. Maestro 可以提供分析、计划、执行或审查能力，但 `jj-flow` 不 fork Maestro core，也不让某个 Maestro 实现决定协议语义。
10. Trace replay 只重放纯状态转换。场景固定、隔离且不执行真实 host action；任何输入、输出或状态 hash 漂移都必须在最早不匹配步骤失败。
11. 半真实 Host trial 的副作用只能位于系统临时目录，并必须清理。版本化 evidence 必须匹配当前 runner fingerprint；它不能替代真实宿主 thread 与 sandbox attestation。
12. Harness GC 只读运行。P0/P1 可以阻断，P2/P3 只形成维护候选；任何 finding 都不能自行删除、重写或合并仓库内容。

## 横切关注点

### 可恢复性与并发

每个 dispatch 步骤都能从 manifest 恢复。revision 提供乐观并发控制，receipt ID 保证结果应用幂等；创建结果不确定的 task 必须显式 reconcile 或 bind，不能盲目重试。

### 证据与信任

Guard 只消费归一化后的证据。序列化输入、host capabilities、receipt attempt、commit 关系、review findings 和 target decision 都在进入状态机的边界处校验。

### 验证

测试围绕可观察契约组织，而不是内部调用顺序。`npm run scenario:check` 提供任务级确定性回归，`jj trace replay <trace.json> --json` 检查已记录状态链，`npm run host:trial` 执行临时 Git/worktree 的 A2/A3 半真实闭环，`npm run harness:gc` 执行持续熵清理评分。修改 dispatch 协议后，至少运行 `tests/jj-dispatch-contract.test.mjs`、完整 `npm run verify` 和 `git diff --check`。其他修改运行最窄的相关测试，并补充受影响表面的仓库检查。

### 分发

`package.json` 定义发布表面。安装过程只复制 commands 和 agents 资产，不启动工作流。文档从 `docs/` 构建，release 自动化位于运行时模块之外。

## 修改入口

| 需求 | 起点 |
| --- | --- |
| 修改同源迁移或持续同步行为 | `.codex/skills/jj-same/` |
| 修改多项目调度策略 | `.codex/skills/jj-dispatch/` |
| 修改持久调度状态转换 | `src/dispatchControlPlane.mjs` |
| 修改 tick、receipt 或 manifest 持久化 | `src/dispatchRuntime.mjs` |
| 修改 scenario、trace 或 replay | `src/scenarioRunner.mjs`、`src/dispatchTrace.mjs` |
| 修改半真实 Host trial 或 M7 证据 | `src/hostTrialRunner.mjs`、`docs/milestones/m7-host-trial.json` |
| 修改持续熵清理规则或 H5 基线 | `src/harnessGc.mjs`、`docs/milestones/h5-gc-baseline.json` |
| 修改安装或 CLI 维护命令 | `src/cli.mjs`、`src/installSkill.mjs` |
| 修改证据结构或 guard 判断 | `src/evidence.mjs`、`src/guards.mjs` |
| 修改用户文档 | `docs/` |
| 修改文档生成逻辑 | `scripts/build-docs.mjs` |

本文件只描述职责位于哪里，以及重构后仍必须成立的边界，不解释单个函数如何实现。职责发生移动时再更新本文，不追随每一次代码变化。
