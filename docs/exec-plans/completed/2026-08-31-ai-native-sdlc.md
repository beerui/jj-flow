# Exec plan — AI-native SDLC 对齐

> 状态：completed
>
> 负责人：jj-flow
>
> 开始日期：2026-08-31
>
> 完成日期：2026-08-31
>
> 关联设计：[AI-native SDLC 对齐](../../design-docs/ai-native-sdlc.md)
>
> 边界：翻译进 same / ralph / dispatch / review / evaluated。不新增交付主路径，不改 dispatch 检查点语义，CI 不调用大模型。

## 目标

按设计文档切片 0→7 把 playbook 习惯落入现有协议：可选发起人原话、当前计划解析、审查分趟、两次打脸写回、测试完整性、派生指标、确定性配置评测、宿主护栏样例、事故回环。

## 非目标

见设计 §3。本计划不把 lifecycle 会话引擎升成第四条主路径。

## 执行清单

### 切片 0 — 设计与执行记录入库

- [x] `docs/design-docs/ai-native-sdlc.md`（入库时 Proposed；关闭时 Implemented）
- [x] 设计索引 + 站点构建清单
- [x] 本 exec plan + 执行索引
- [x] harness-manifest 权威条目
- [x] CHANGELOG Unreleased 指针
- [x] `npm run docs:check` 与 `npm run harness:check`

### 切片 1 — 产物链：intent + Current 解析

- [x] 可选 `intent.md` / `artifact_refs.intent`（tiny 跳过）
- [x] `extractPlanCurrentSection`；声称路径只用 Current
- [x] ANALYZE 必须回应 intent 未决问题并写出标出的担心
- [x] `ralph:sync` + `tests/jj-ralph-contract.test.mjs`

### 切片 2 — 审查政策 + 对照 Current

- [x] `skills/jj-review/references/review-policy.md`
- [x] finding 可选 `pass` / `importance`；nit 上限；跳过生成物
- [x] 审查强制对照 `plan.md` ## Current
- [x] `ralph_ops review-record` 与 `jj ralph review-record` 对齐 findings 标志

### 切片 3 — 两次打脸 + 测试完整性

- [x] 执行 `budget.max_same_strategy_failures`
- [x] 第二次失败写 `instruction-correction.md`（Reviewer 不写 AGENTS.md）
- [x] 修缺陷删除/掏空测试 → 重要 finding；tiny 纯样式不误伤

### 切片 4 — 派生指标

- [x] `computeRunMetrics`；`jj ralph metrics --json`
- [x] 可选 `run.metrics`；缺时钟为 null，不挡 ACCEPT

### 切片 5 — 确定性配置评测

- [x] `evals/regression/` 至少含 EP-20260828 的黄金不变式
- [x] `evaluated_ops` regression 子命令 + `npm run evaluated:check` 进入 `verify`
- [x] skill：事故/用户纠正 → 加考题；禁止自动 promote

### 切片 6 — 宿主样例 + 并行容量

- [x] `examples/host-guardrails/`（声明不是协议）
- [x] ralph / dispatch skill：2–3 路，审查跟不上就停

### 切片 7 — 事故回环

- [x] 同需求 resume；新需求才新 intent
- [x] 与切片 5 考题交叉引用

## 下一刀

无。残留风险见下表，不阻塞关闭。

## 完成定义

1. 设计状态改为 Implemented，且 `> 验收证据：` 指向合约测试或版本化产物。
2. 切片 1–7 勾选完成；`npm run verify` 绿。
3. 未引入 INTENT 阶段、LLM CI、dispatch 检查点改语义。

## 残留风险（关闭后仍成立）

- Current-only 路径核对会改变既有漂移测试夹具（预期，不是回退）。
- 测试「变松」（断言变弱但文件还在）仍靠审查判断，机械门只抓删文件/掏空。
- 配置评测只保护已写成不变式的事故；新坑要人补题。

## 决策日志

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-08-31 | 翻译进现有三条主路径，不开第四条 | 文章的六阶段是会话剧本，不是 jj-flow 交付事实源 |
| 2026-08-31 | intent 可选、tiny 跳过 | 单点样式不能加仪式 |
| 2026-08-31 | CI 只跑确定性考题 | 避免密钥、费用和自动改技能的压力 |
| 2026-08-31 | Reviewer 不写 AGENTS.md | 只读审查不变量 |
| 2026-08-31 | 宿主 hook 放 examples | 外部副作用属于宿主 |
