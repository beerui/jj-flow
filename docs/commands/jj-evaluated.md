# evaluated — 用真实交付记录做离线复盘

**可选入口：** 它只帮你评估和改进工作流，单独跑完不算验收通过；验收仍看 [ralph](jj-ralph.md) / [dispatch](jj-dispatch.md) 的记录。

**它帮你做什么：** 把真实项目的对话导出、Git、handoff、验证和任务工件整理成可回放的 episode，分析耗时、返工和流程问题，再由人决定是否改进 skill。

**它不做什么：** 不编造样本或时长，不自动改生产业务代码，不自动训练模型，也不会未经批准把候选改进写回生产 skill。

| 你用的工具 | 怎么喊 |
|------------|--------|
| Codex / Grok / Qoder | `$jj-evaluated …` |
| Claude | 没有此入口（刻意如此） |

## 什么时候用

- 想复盘项目A → 项目B 的迁移成本、返工或 handoff 复用
- 想比较策略，找出可泛化的流程改进
- 想把 episode 验证、拆分、回归结果留档

**不该用 evaluated 的情况：** 只是想做当前需求用 [ralph](jj-ralph.md)；想推进多项目交付用 [dispatch](jj-dispatch.md)。它是实验性离线评估，不是实时调度器。

## 开始前

1. 准备真实的对话导出或 JSON/JSONL episode，以及能核对的 Git / 任务工件；没有证据不会替你补齐。
2. 明确评估哪些项目、角色和时间范围；不同项目仍保持项目A / 项目B / 项目C 的角色区分。
3. 先确认隐私边界；未经明确授权，不把原始对话发到外部服务。

## 第一次这样用

**你说：**

```text
$jj-evaluated 对最近一次 项目A→项目B handoff 做时长与复用诊断
```

**Agent 会做：**

1. 确定范围和证据来源，先校验 episode 格式。
2. 计算带来源和质量说明的基线，再做不泄漏 holdout 的拆分检查。
3. 针对一个明确问题提出一个有界候选，先便宜回放、再按需做更重的回归。
4. 把结果和风险写入报告，等你明确决定“推广”或“归档”；没有人工批准不会改生产 skill。

**你会看到：**

```text
episode：已校验
基线：时长 / 等待 / 返工（均带来源说明）
候选：1 个，等待人工复核
报告：.workflow/evaluated/…/report.md
```

**怎样算做完：** 报告包含证据、拆分、回放、回归和人工决定；绿色分数本身不能自动推广候选。

## 常用说法

```text
$jj-evaluated validate episode.json
$jj-evaluated 对项目A、项目B 最近一轮交付做返工诊断
$jj-evaluated 离线评估：禁止自动 promote，只出 report
```

## 做完之后

| 你想做什么 | 下一步 |
|------------|--------|
| 认可改进候选 | 明确批准后，按报告把它写入版本化 skill / 规格 |
| 暂不推广 | 归档报告，保留回归资料 |
| 缺数据 | 按报告的 next data-collection action 补采样，不要估算 |
| 继续做业务改动 | 回到 [ralph](jj-ralph.md) 或 [same](jj-same.md) |

## 进阶

最小 runner 位于 `skills/jj-evaluated/scripts/`：可用 `episode-validate.mjs` 校验，`evaluated_ops.mjs` 做 `validate`、`init-report`、`check-split` 和确定性回归。评估报告不是 jj-flow 控制面的事实来源，不能推进任何交付 checkpoint。

## 记录在哪

```text
.workflow/evaluated/<episode-id>/
  report.md
```

## 相关

[命令总览](../commands.md) · [Harness 设计](../design-docs/harness-engineering.md) · [第一次使用](../usage.md)
