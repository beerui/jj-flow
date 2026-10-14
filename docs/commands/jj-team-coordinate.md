# team-coordinate — 动态拆分多角色协同分析与实现

`team-coordinate` 是 `jj-flow` 提供的**可选多角色协作引擎**。当你的需求横跨多个业务模块、或者希望同时从“架构、安全、实现、测试”等多个维度并行推进时，它会根据当前问题动态生成协作角色与依赖图，并在 `.workflow/.team/TC-…/` 下汇总各角色的分析与代码产物。

::: info 可选辅助引擎边界
`team-coordinate` 仅负责**“本轮会话如何拆解角色与协同执行”**，它单独跑完**不代表**业务交付已验收通过。正式的任务验收与归档仍以 [ralph](jj-ralph.md) 或 [dispatch](jj-dispatch.md) 的记录为准（你可以将 `TC-…/` 下的产物路径作为证据引用进 `ralph`）。
:::

| 宿主工具 | 调用写法 |
| :--- | :--- |
| **Codex / Grok / Qoder** | `$jj-team-coordinate …` |
| **Claude Code** | `/jj-team-coordinate …` |

## 一、适用场景与选型对比

| 你的需求场景 | 推荐使用的入口 |
| :--- | :--- |
| 一个需求横跨多个模块（如支付回调 + 订单状态机 + 对账），希望按模块或视角动态拆角色并行处理 | **使用 `team-coordinate`（本页）** |
| 常规单点需求或修 Bug，不需要拆多个角色 | 去 [ralph · 单仓任务闭环](jj-ralph.md) |
| 希望按固定的“写 PRD 规格 → 计划 → 实现 → 测试 → 审查”标准化流水线走 | 去 [team-lifecycle · 标准 SDLC](jj-team-lifecycle.md) |
| 架构方案尚未确定，希望生成多个候选方案并经过对抗评分选出最佳方案 | 去 [team-swarm · 多方案搜索](jj-team-swarm.md) |

## 二、标准执行流程（4 步动态协同）

1. **评估复杂度与生成角色拓扑**：分析你的问题是否确实需要多角色协作（若只是简单单点问题，会直接建议改用 `ralph`，不盲目创建复杂会话）；确认需要后，生成本轮专属角色（如 `security-analyst`、`order-implementer`、`qa-verifier`）及先后依赖关系。
2. **派发各角色执行**：按宿主平台能力派发子代理（支持多子代理的宿主并行推进，其余环境自动平滑降级为文件消息总线串行执行，产物契约完全一致）。
3. **汇总产物与异常拦截**：收集各角色输出的分析报告、代码修改与验证结果；若某一角色执行失败，会如实报告原因，绝不拿残缺结果冒充全部完成。
4. **收尾与引用**：输出本轮协作摘要与 `.workflow/.team/TC-…/` 产物路径，供你在 `ralph` 验收或后续开发中引用。

## 三、完整实战示例

```text
你：
$jj-team-coordinate 支付回调验签与订单状态流转分角色并行分析并实现

Agent：
已创建动态协作会话 `.workflow/.team/TC-payment-callback-20261013/`：
- 角色 1 [security-analyst]：审查回调签名校验与重放攻击防护（只读分析）
- 角色 2 [order-implementer]：实现幂等订单状态机更新（依赖角色 1 结论）
- 角色 3 [qa-verifier]：编写并发回调与签名失败单元测试（依赖角色 2 完成）

正在派发各角色执行……
- [security-analyst] 已输出验签边界清单：`artifacts/security-notes.md`
- [order-implementer] 已更新 `src/services/orderCallback.ts`
- [qa-verifier] 已新增并通过 5 项幂等与验签测试：`artifacts/test-report.md`

team 会话完成：产物位于 `.workflow/.team/TC-payment-callback-20261013/`
下一步：1. 归档会话；2. 保留继续（说 `resume`）；3. 将产物路径引用至 `$jj-ralph` 完成正式验收。
```

## 四、常用说法速查

```text
# 从多个角度并行分析一个高风险改动的影响面
$jj-team-coordinate 从安全、性能、向后兼容三个角度分析登录鉴权改造的影响面

# 按模块拆分角色协同实现与测试
$jj-team-coordinate 把支付模块拆成分析、实现、测试三个角色协同完成

# 恢复刚才中断的多角色会话
$jj-team-coordinate resume
```

## 五、文件记录在哪里？

```text
.workflow/.team/TC-<简述>-<日期>/
├── team-session.json    # 本次多角色会话状态与角色依赖图
├── role-specs/          # 动态生成的各角色职责定义
└── artifacts/           # 各角色产出的分析文档、代码摘要与验证记录
```

## 相关阅读

* [ralph · 单仓任务闭环](jj-ralph.md)
* [team-lifecycle · 标准 SDLC 流水线](jj-team-lifecycle.md)
* [team-swarm · 多方案搜索](jj-team-swarm.md)
* [命令总览与选型指南](../commands.md)
