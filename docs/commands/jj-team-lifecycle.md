# team-lifecycle — 固定角色走标准 SDLC 流水线

`team-lifecycle` 是 `jj-flow` 提供的**标准化软件开发生命周期（SDLC）辅助引擎**。它使用预定义的固定角色（需求分析、规格编写、技术计划、代码实现、测试验证、代码审查与质量监督），把一个功能从产品规格（PRD / Brief）到代码落地的过程串成标准化流水线。

::: info 可选辅助引擎边界
`team-lifecycle` 负责为你生成标准化的规格文档与分阶段产物（保存在 `.workflow/.team/TLV4-…/`），但它单独跑完**不等于** `ralph` 的 `ACCEPT` 或 `dispatch` 的 `VERIFIED`。完成正式交付验收仍需走 [ralph](jj-ralph.md) 或 [dispatch](jj-dispatch.md)。
:::

| 宿主工具 | 调用写法 |
| :--- | :--- |
| **Codex / Grok / Qoder** | `$jj-team-lifecycle …` |
| **Claude Code** | `/jj-team-lifecycle …` |

## 一、先选适合你的流水线模式（3 选 1）

调用时可通过 `--pipeline` 参数指定本次要走哪一段流水线（拿不准时建议先用最轻量的 `spec-only`）：

| 流水线参数 | 包含阶段 | 适用场景 |
| :--- | :--- | :--- |
| **`--pipeline spec-only`** | 需求分析 → 编写规格（Brief / PRD / 架构）→ 规格质检 | 需求还处于设计阶段，只想先产出一套结构严谨的规格文档，暂不写代码 |
| **`--pipeline impl-only`** | 技术计划 → 代码实现 → 测试验证 → 审查 | 手头已经有写好的 PRD 或规格说明，希望按固定角色完成编码与测审 |
| **`--pipeline full-lifecycle`** | 从需求分析、写规格一直走到代码实现与测试审查 | 需要从零开始走完完整标准化流程的大中型功能（耗时较长，建议先确认范围） |

## 二、标准执行流程

1. **检查输入与锁定流水线**：确认你选择的 `--pipeline` 模式及现有参考资料（如果选了 `impl-only` 却没有提供现成规格，会先提醒你补齐或改走 `spec-only`）。
2. **按固定角色顺序推进**：由协调员（coordinator）依次调度分析、规格、计划、实现、测试、审查角色，并由监督员（supervisor）做阶段一致性检查。
3. **支持按阶段打回修订**：如果对某一阶段的规格或实现不满意，可以使用 `revise <任务编号> <修改意见>` 单独重做该阶段并触发 `recheck`。
4. **输出标准化产物目录**：所有阶段产物归档在 `.workflow/.team/TLV4-…/` 下，可直接交给 `ralph` 引用。

## 三、完整实战示例

### 示例：先用 `spec-only` 产出会员积分过期提醒规格

```text
你：
$jj-team-lifecycle --pipeline spec-only 设计会员积分即将过期的消息提醒功能

Agent：
已启动 SDLC 流水线 `.workflow/.team/TLV4-points-expiry-20261013/`（模式：`spec-only`）：
1. [analyst] 已梳理积分过期触发条件与触达渠道约束 → `spec/product-brief.md`
2. [spec-writer] 已编写接口契约与前端交互规格 → `spec/prd.md`、`spec/architecture.md`
3. [supervisor] 规格一致性检查通过（无遗漏边界条件）

流水线完成！产物目录：`.workflow/.team/TLV4-points-expiry-20261013/spec/`
下一步：
- 如需调整规格，请说：`revise <阶段编号> 你的修改意见`
- 如需按此规格在当前仓正式开发验收，请调用 `$jj-ralph` 并引用上述 `spec/` 路径。
```

## 四、常用说法速查

```text
# 1. 只产出需求规格与架构设计（不写业务代码）
$jj-team-lifecycle --pipeline spec-only 设计会员积分功能

# 2. 已有规格文档，走计划 → 实现 → 测试 → 审查流水线
$jj-team-lifecycle --pipeline impl-only 按 docs/prd.md 实现并完成测审

# 3. 走完整生命周期流水线
$jj-team-lifecycle --pipeline full-lifecycle 从需求规格到代码实现完整走一遍

# 4. 查看进度、中断恢复、修订某一步或重新检查
$jj-team-lifecycle status
$jj-team-lifecycle resume
$jj-team-lifecycle revise SPEC-1 补充未登录态的降级处理
$jj-team-lifecycle recheck
```

## 五、文件记录在哪里？

```text
.workflow/.team/TLV4-<简述>-<日期>/
├── team-session.json    # 流水线模式、阶段进度与角色状态
├── spec/                # 产品简报（product-brief.md）、PRD 与架构规格
├── plan/                # 拆解后的实施计划与任务依赖
└── artifacts/           # 实现摘要、测试报告与质量检查记录
```

## 相关阅读

* [team-coordinate · 动态多角色协同](jj-team-coordinate.md)
* [team-swarm · 多方案搜索](jj-team-swarm.md)
* [ralph · 单仓任务闭环](jj-ralph.md)
* [命令总览与选型指南](../commands.md)
