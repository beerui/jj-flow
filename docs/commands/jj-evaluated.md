# evaluated — 基于真实交付记录的离线复盘

`evaluated` 是面向工作流调优的**实验性离线复盘工具**。它把真实项目交付过程中产生的对话导出记录、Git 提交历史、交接快照与审查产物整理成可回放的样本（`episode`），帮你量化分析“哪一步耗时最长、为什么发生了返工、哪条规则值得沉淀进技能协议”。

::: info 可选复盘工具边界
`evaluated` 只做**事后离线诊断与改进建议**，不会推进任何业务需求的 `ralph` 或 `dispatch` 验收状态；且任何针对 `skills/` 的改进候选都必须经过**人工审核批准**后才会合入，绝不会自动修改生产技能（禁止 auto-promote）。
:::

| 宿主工具 | 调用写法 |
| :--- | :--- |
| **Codex** | `$jj-evaluated …` |
| **Grok / Qoder** | `/jj-evaluated …` |

## 一、适用场景与前置要求

**什么时候用 `evaluated`：**
* 刚跑完一次复杂的跨仓迁移（如项目A → 项目B），想复盘为什么中间发生了返工或等待耗时过长。
* 修改了某个技能协议后，想用历史真实样本跑一次回归校验（regression），确认没有破坏既有行为。

**开始前准备：**
1. **准备真实交付证据**：需要真实的会话导出 JSON/JSONL（`episode`）以及对应的 Git 提交或 `.workflow/` 任务产物；缺少证据或时间戳质量字段（`clock_quality`）时校验会直接报错，绝不靠估算编造数据。
2. **确认隐私边界**：离线评估全在本机完成；未经你明确授权，不会将原始业务对话上传至任何外部服务。

## 二、标准执行流程（4 步科学复盘）

1. **校验样本完整性（Validate）**：运行内置校验器检查 `episode.json` 的事件结构、时间戳来源（`timestamp_provenance`）与时钟质量（`clock_quality`）。
2. **计算基线与防泄漏切分（Baseline & Split）**：统计耗时、工具调用轮数与返工次数，并严格校验样本集切分（`optimization` 优化集、`holdout` 留出验证集、`regression` 回归集三者互不重叠）。
3. **提出改进候选并验证（Candidate & Regression）**：针对复盘发现的具体瓶颈提出有界改进方案，在回归用例集上执行确定性校验。
4. **生成报告等待人工拍板（Report）**：在 `.workflow/evaluated/<episode-id>/report.md` 输出完整基线表与回归结果，由维护者决定是否采纳。

## 三、完整实战示例

```text
你：
$jj-evaluated 对最近一次 项目A→项目B handoff 做时长与复用诊断

Agent：
1. 样本校验：已校验 `EP-20261013-login-handoff.episode.json`（共 38 个事件，clock_quality=verified）
2. 基线统计：
   - 总耗时：4m 12s（其中目标仓重复全仓 grep 耗时 1m 45s）
   - 返工轮数：1 轮（因未先读源仓 handoff 范围导致遗漏单测）
3. 改进候选：在目标仓调研派单中显式列出源仓精确文件路径，禁止无边界全仓扫描（通过 15 项历史回归测试）
4. 复盘报告已生成：`.workflow/evaluated/EP-20261013-login-handoff/report.md`（Promotion status: PENDING_HUMAN_REVIEW）
```

## 四、常用说法与维护脚本速查

在对话中调用：

```text
$jj-evaluated validate episode.json
$jj-evaluated 对项目A、项目B 最近一轮交付做返工诊断
$jj-evaluated 离线评估：禁止自动 promote，只出 report
```

维护者也可在终端直接调用内置确定性校验脚本：

```bash
# 校验单个 episode 样本格式
node skills/jj-evaluated/scripts/evaluated_ops.mjs validate --episode path/to/episode.json --json

# 校验 optimization / holdout / regression 样本集切分无重叠
node skills/jj-evaluated/scripts/evaluated_ops.mjs check-split --manifest path/to/split.json --json

# 运行全量历史回归断言
npm run evaluated:check
```

## 五、文件记录在哪里？

```text
.workflow/evaluated/<episode-id>/
└── report.md    # 包含基线数据表（Baseline table）、候选方案与人工推广状态（Promotion status）
```

## 相关阅读

* [命令总览与选型指南](../commands.md)
* [Agent Harness 工程设计](../design-docs/harness-engineering.md)
* [evaluated 设计文档](../design-docs/jj-evaluated.md)
