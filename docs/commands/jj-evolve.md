# `jj-evolve` 项目演进

`jj-evolve` 用于维护 `jj-flow` 项目本身。它消费 `jj-validate` 的自检结果、`.workflow` 路线图和用户反馈，先修正已经确认的漂移或方向错误，再推进下一项有证据支持的项目能力。

## 适用场景

- `jj-validate` 已发现 `FAIL` 或重要 `PENDING`，需要修改代码、文档、测试或命令资产。
- 用户反馈当前命令、安装体验、文档或调度协议不符合真实使用，需要形成最窄修正。
- 当前阶段门禁已满足，路线图存在明确的下一项待实现能力。
- 发布或真实项目试用暴露协议缺口，需要补测试和用户文档后收口。

## 何时不用

- 还没有可信自检结果、用户反馈或路线图目标时，先使用 [`jj-validate`](command-jj-validate.html)。
- 普通业务功能、线上问题或同源迁移不使用它，分别选择 [`jj-delivery`](command-jj-delivery.html) 或 [`jj-same`](command-jj-same.html)。
- 只需要报告当前状态，不希望修改文件时，停在 `jj-validate`。
- 不要用它把 `jj-flow` 扩成重型 CLI 流水线、多智能体执行引擎或 Maestro core 的复制品。

## 输入模板

```text
$jj-evolve
演进目标：<要修正的失败或要推进的路线图能力>
自检证据：<jj-validate 结果、失败日志、artifact 或 commit>
用户反馈：<真实使用中出现的问题或方向纠正>
优先级：<先修 FAIL / 先修用户反馈 / 再推进路线图>
约束：<不得改变的项目定位、兼容性和范围>
验收：<测试、文档、命令资产和项目检查的完成标准>
```

Claude Code 使用 `/jj-evolve`。如果没有明确演进目标，命令会从最近自检和路线图中选择下一项；但不会在证据不足或路线图已完成时凭空创造功能。

## 完整示例

### 示例 1：先修复自检发现的命令资产漂移

```text
$jj-evolve
演进目标：修复 jj-same handoff 双门禁在 Codex skill、Claude command 和用户文档中的不一致。
自检证据：最近 jj-validate 将“PARTIAL_HANDOFF 一律阻塞编码”标记为 FAIL，并列出了 Codex skill、Claude command 和用户文档的冲突位置。
用户反馈：源评审或 UAT 待补不应阻止已经满足 EXECUTION_READY 的目标开始迁移。
优先级：先修 FAIL，再补回归测试，不推进其它路线图项目。
约束：不复制 Maestro core；不改变现有 handoff schema；只调整判断、文档和目标测试。
验收：Codex/Claude 入口语义一致；相关契约测试通过；npm run docs:check 和 git diff --check 通过。
```

### 示例 2：在自检通过后推进调度恢复能力

```text
/jj-evolve
演进目标：推进路线图中的 jj-dispatch 可恢复绑定能力。
自检证据：最近 jj-validate 中文档、命令资产和现有测试均为 PASS；路线图下一项是 UNKNOWN -> RECONCILE 的唯一候选恢复。
用户反馈：创建 task 成功但控制面绑定失败后，不能重复创建任务。
优先级：先补恢复状态机和契约测试，再更新 Codex-only 用户文档。
约束：不实现常驻 daemon；不新增 Claude /jj-dispatch；不自动 merge、push 或 release。
验收：同一 task_key 不会重复创建；零个或多个候选保持 BLOCKED；唯一候选可恢复绑定；聚焦测试、项目检查和文档检查通过。
```

### 示例 3：路线图已完成时转入维护

```text
$jj-evolve
演进目标：根据最近自检决定下一步，不预设新增功能。
自检证据：roadmap 已无未完成 milestone，npm run verify 通过。
用户反馈：希望先在真实项目中试用当前 beta，再决定下一轮能力。
优先级：维护和试用优先。
约束：不为了保持“持续演进”而新增命令或协议层。
验收：输出真实项目试用清单、观察指标和下一次触发演进的证据条件；无必要代码改动时明确 NO_CHANGE_REQUIRED。
```

## 执行过程

1. 读取 `.workflow/project.md`、`.workflow/roadmap.md`、`.workflow/state.json` 和最近一次 `jj-validate` 证据。
2. 将问题按优先级排序：明确 `FAIL`、用户指出的方向错误、阻塞发布或真实使用的问题、路线图下一项。
3. 从原始需求和项目定位反推最短方案，确认哪些文件必须改、哪些扩展不属于本轮。
4. 保持 `jj-flow` 为 Maestro 上层薄协议：复用 Maestro 的分析、计划、执行、测试和审查能力，不在本项目重写 core。
5. 实施最窄代码、文档和测试修改；命令资产有多平台版本时同步更新对应入口，Codex-only 能力保持平台边界。
6. 运行与改动匹配的聚焦测试、`npm run check`、`npm run docs:check` 和 `git diff --check`；涉及调度协议时至少覆盖其契约测试，必要时运行 `npm run verify`。
7. 汇总已修复失败、路线图推进情况、验证证据、残余风险和下一次演进条件。

## 输出/完成标准

- 每项修改都能追溯到 `jj-validate` 结果、用户反馈或明确路线图目标。
- 已确认的 `FAIL` 和方向错误优先收口，没有被新功能开发掩盖。
- 修改范围保持最窄，没有复制 Maestro core、引入常驻 daemon 或无授权外部执行能力。
- Codex skills、Claude commands、用户文档、npm 包资产和测试按真实平台边界保持一致。
- 实际运行的测试和检查有明确结果；未运行或需外部确认的项目保持 `PENDING`。
- 路线图状态和 `.workflow` 证据随真实完成情况更新；没有可做事项时允许输出 `NO_CHANGE_REQUIRED`，不制造伪进度。

## 关键门禁与状态

### 输入门禁

至少需要以下一种可信输入：

- 当前 `jj-validate` 的 `FAIL/PENDING` 及证据。
- 明确、可复现的用户反馈。
- `.workflow/roadmap.md` 中尚未完成且前置条件已满足的能力。

如果不同输入发生冲突，优先修正真实失败和用户确认的方向错误；不能自行选择会改变项目定位的方案。

### 边界门禁

- `jj-flow` 只提供 Maestro 上层的需求收集、控制面和交付编排协议。
- 不重写 Maestro 的 plan、execute、review、test 或 harvest。
- 不把命令演进成重型 CLI 流水线；真实执行仍由 Codex/Claude Code 和 Maestro skills 完成。

### 完成门禁

- 代码、文档、命令资产和测试的事实一致。
- 聚焦测试和项目检查通过；失败项没有被写成完成。
- 用户文档说明真实输入、状态、输出和平台限制。
- 若目标涉及调度协议，必须验证 PREVIEW/DISPATCH、恢复、单 writer、Review 或 checkpoint 等受影响契约。

## 常见误区

- 没有运行 `jj-validate` 或读取最近自检，就直接挑一个想做的功能。
- 自检已有 `FAIL`，却优先实现新的路线图能力。
- 把“减少用户操作”理解为取消批准、Review、sandbox 或同步检查点门禁。
- 只改 Codex skill，不同步 Claude command、用户文档或测试；反之亦然。
- 为了统一入口给 Codex-only 的 `$jj-dispatch` 新增未经支持的 Claude command。
- 只运行单元测试，不检查文档构建、npm 包资产或项目边界。
- 路线图已完成仍不断添加协议层，而不转向维护、真实项目试用和证据收集。

## 相关命令

- [`jj-validate`](command-jj-validate.html)：生成演进所需的自检状态和证据。
- [`jj-delivery`](command-jj-delivery.html)：在演进实现后审查 correctness、边界和测试缺口。
- [`jj-same`](command-jj-same.html)：验证演进后的迁移和持续同步协议是否满足真实项目使用。
- [`jj-dispatch`](command-jj-dispatch.html)：验证演进后的控制平面调度和恢复行为。
