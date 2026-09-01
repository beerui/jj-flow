# AI-native SDLC 对齐（翻译进 jj-flow）

> 状态：Implemented
>
> 验收证据：`tests/jj-ralph-contract.test.mjs`（intent / Current 路径 / two-strikes / 测试完整性 / review nit / metrics）；`tests/jj-evaluated-contract.test.mjs`（`evals/regression`）；`npm run evaluated:check`；`npm run verify`
>
> 关联：`jj-ralph.md`、`jj-evaluated.md`、`jj-team-lifecycle.md`、ADR 0001 外部工具边界
>
> 来源：[The AI-Native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook)（Louis Claxton，2026-08-21）
>
> 执行：[2026-08-31 AI-native SDLC](../exec-plans/completed/2026-08-31-ai-native-sdlc.md)
>
> 定位：把 playbook 的控制习惯**翻译**进 same / ralph / dispatch，而不是再开一条六阶段主路径。

## 1. 问题

Agent 写代码已经快过旁边的想清楚、检查、上线和记教训。jj-flow 已有书面产物和失败即停的门，但下列控制仍缺或只接了一半：

- 发起人原话（intent）没有单独落盘
- 审查没有分趟政策（功能 / 安全 / 是否符合当前计划）
- 路径核对读整份 `plan.md`，作废条目会把账算乱
- 同样的错第二次，没有写回「下次别这样」的说明书候选
- 修缺陷时可以削弱或删除测试
- 没有从过程记录派生的快慢/返工指标
- 改技能/规则时没有「旧事故变成固定考题」的 CI 门
- 宿主护栏只存在于口头，没有可复制样例
- 事故/用户纠正不会走回同一需求或新 intent

## 2. 目标

1. 每一步结束时留下**下一阶段能读的书面材料**；聊天不能推进状态（已有不变量，本设计不放松）。
2. 人只出现在判断门和不可逆操作（push / merge / release）。
3. 在**现有协议内**补齐 intent、当前计划解析、审查政策、两次打脸写回、测试完整性、派生指标、确定性配置评测、宿主护栏样例、事故回环。
4. `tiny` 仍然轻：单点样式改动不加仪式。

## 3. 非目标

| 非目标 | 原因 |
| --- | --- |
| 新 ralph 阶段 `INTENT` 或 `gates.intent` | 会分叉状态机；intent 是可选文件 |
| 第二份需求文件 `spec.md` | `analyze.md` 已是规格 |
| 合代码/合并后自动开下一枪 | 外部副作用属于宿主；控制面单写者 |
| CI 里调用大模型 | 贵、绑死宿主、会压迫自动改技能 |
| 评测分数自动晋升技能正文 | `$jj-evaluated` 禁止无批准 promote |
| 本包装入生产监控机器人 | ARMS 等只当证据提供者 |
| 改 dispatch CAS / receipt / `task_key` / VERIFIED | 本设计不碰调度检查点语义 |
| 把 `.claude/settings.json` 当协议 SSOT | 宿主形态，不是产品契约 |
| 让 `jj-team-lifecycle` 成为默认交付路径 | 会话引擎不得推进 checkpoint |

## 4. 关键裁决

1. **翻译，不抄文件名。** Playbook 的 `CLAUDE.md` / `REVIEW.md` / hooks 对应 `AGENTS.md`、`skills/jj-review/references/review-policy.md`、`examples/host-guardrails/`。
2. **主路径仍是三条。** team-lifecycle / coordinate / swarm 只干活，不过 ralph / dispatch 检查点。
3. **Schema 只加可选字段。** 保持 `jj-flow/ralph-run/1.0` 与 `jj-flow/ralph-review/1.0`。旧 run / REV 必须仍能校验。
4. **Reviewer 永远只读。** 两次打脸的说明书落地由 Developer / ralph 写代码侧完成。
5. **CI 评测必须便宜且失败即停。** 确定性 `evals/regression/` + `npm run evaluated:check` 进入 `verify`。LLM 回放留在离线 `$jj-evaluated`。
6. **宿主 hook 只做例子。** 不进 npm 协议，不替宿主执行 deploy。

## 5. 产物链

```text
intent.md（可选；发起人原话；tiny 跳过）
  → analyze.md（MUST + 标出的担心；人接受 ANALYZE）
    → plan.md ## Current（人接受 PLAN）
      → 代码 diff + 测试 + deliver-attempt
        → REV-n.json（分趟审查；对照 Current）
          → acceptance.md（证据等级不得弱于承诺）
            → finalize：能力地图 + 快照 + 指标 + 说明书校正候选
              → 事故 / 两次打脸 / 用户纠正
                  → 同 run resume，或新 intent，或 evals/regression 考题
```

接受一份产物后，由对话指令（`$jj-ralph` / `$jj-review` / `$jj-evaluated`）进入下一刀。Git merge **不**触发作业。

### intent 与 analyze 的分工

| 文件 | 谁写 | 写什么 |
| --- | --- | --- |
| `intent.md` | 发起人（可与 Agent 一起起草，发起人改正） | 问题、想要的结果、谁受影响、不能碰什么、未决问题 |
| `analyze.md` | 工程侧 ANALYZE | MUST、`evidence_class`、标出的担心；必须回答或原样带走 intent 的每一条未决问题 |

`tiny` 或不传 intent：不写 `intent.md`，`artifact_refs.intent` 为 `null`。

## 6. Playbook → jj-flow

| Playbook | 今天 | 本设计要做 |
| --- | --- | --- |
| `intent.md` | 直接从 `analyze.md` 起 | 可选 `intent.md` + `artifact_refs.intent`；不是新阶段 |
| `spec.md` + 技能约束 | `analyze.md` | 保留；ANALYZE 必须写 **标出的担心** |
| `plan.md` 再动手 | 有 `## Current`，**没有章节解析器** | 只认 `## Current`（无则兼容旧 `## Tasks`）；路径核对与审查对照都只用 Current |
| 两次打脸写说明书 | `process_lessons`；`max_same_strategy_failures` 存了不用 | 执行该预算；第二次写 run 内校正候选；Developer 可写入业务仓 `AGENTS.md`「Agent corrections」 |
| 技能即制度知识 | `skills/<id>/` 已是 SSOT | 保持；补审查政策、测试完整性、评测入题手续 |
| 构建期硬拦 | 无（知识库 hook 无关） | **仅** `examples/host-guardrails/` |
| 并行会话 | dispatch worktree；Reviewer 只读 | 技能正文：2–3 路；审查跟不上就停加；核对的人只报告 |
| 自检反馈环 | `verify` + `evidence_class` | 修缺陷可加严测试，不可删/掏空测试 |
| 配置变更评测 | evaluated MVP；CI 只跑 `verify` | 确定性回归考题；事故→加题；CI 不跑模型 |
| 审查政策 | 落盘 REV；无分趟、无 nit 上限 | `review-policy.md`：bugs / security / compliance；Important vs nit；跳过生成物和 CI 已覆盖路径 |
| 对照计划 | accept 门读**整份** plan 反引号 | 审查时对照 Current；accept 路径集也收窄到 Current |
| 发布批准门 | `$jj-end` 红灯 | 保持；例子里可写生产门，jj-flow 仍不执行 deploy |
| 运维回环 | 无 | 手续：纠正/事故 → resume 或新 intent + 回归考题。无守护进程 |
| 快慢指标 | 无 | 从已有 progress/gates **派生**；缺时间戳就标未知，不编造 |

## 7. 落地切片（依赖顺序）

实现事实以代码、schema、测试为准。切片 0–7 已落地；本设计为 Implemented。

| 切片 | 内容 | 主要路径 | 证明 |
| --- | --- | --- | --- |
| **0** | 本文 + 执行计划入库 | `docs/design-docs/`、`docs/exec-plans/active/` | `docs:check`、`harness:check` |
| **1** | 可选 intent；Current 解析；ANALYZE 标出担心 | `src/ralph.mjs`、ralph skill、`schemas/ralph-run.schema.json` | `tests/jj-ralph-contract.test.mjs`、`ralph:check` |
| **2** | 审查政策 + 对照 Current | `skills/jj-review/`、`validateReviewReport`、`ralph_ops review-record` 与 CLI 对齐 | ralph / review 合约测试 |
| **3** | 两次打脸候选 + 测试完整性 | `recordDeliverAttempt`、`must-evidence.md`、developer agent | 第二次失败写候选；修缺陷删测试不得静默过 |
| **4** | 派生指标 | `computeRunMetrics`、`jj ralph metrics` | 夹具 JSON 稳定；缺时钟 → null |
| **5** | 确定性配置评测 | `evals/regression/`、`evaluated_ops`、`package.json` `evaluated:check` | 改黄金句失败；`verify` 含该脚本 |
| **6** | 宿主护栏样例 + 并行上限说明 | `examples/host-guardrails/`、ralph/dispatch skill 一行 | 样例声明「不是协议」；dispatch 契约不变 |
| **7** | 事故回环手续 | `post-complete-continue.md`、evaluated skill | 同需求 resume；新需求才新 intent |

切片 1 收窄「声称要改的路径」是行为变化：Landed / Superseded 中的路径不再算当前账。现有路径漂移测试必须改夹具，而不是放宽门。

## 8. 治理

- 书面材料推进状态；聊天、thread、memory 不能过门。
- Reviewer 只读；Developer 只在当前任务获批工作区写。
- 不可逆操作只准备、不执行，直到用户明确要求（`$jj-end`）。
- Skill SSOT 是顶层 `skills/<id>/`，不是 `.claude` / `.codex` / `.cursor`。
- npm 发布仍走 GitHub Actions，不用本地 `npm publish`。

## 9. 未决（已选默认；实现时勿再打开）

| 问题 | 默认 |
| --- | --- |
| 要不要 intent 文件 | 可选；`tiny` 跳过 |
| CI 评测要不要跑模型 | 不要；只要确定性考题 |
