# 执行计划

复杂、跨模块的改造必须在这里留下版本化执行记录。计划只记录目标、边界、进度、决策和验收证据，不替代代码、schema 或测试事实。

## 状态约定

| 目录 | 状态 | 规则 |
| --- | --- | --- |
| `active/` | `active` 或 `blocked` | 尚有未完成工作，必须记录下一步和阻塞原因 |
| `completed/` | `completed` | 验收命令已运行，结果和剩余风险已记录 |

## 活跃计划

| 计划 | 状态摘要 | 下一刀 |
| --- | --- | --- |
| [实验场 Loop gym / Family gym](active/2026-08-31-jj-flow-labs.html) | 机械实验场 Implemented；`lab:check` 已进 `verify` | 无机械待办。PR10 / Live Agent 另开需求 |
| [Grok dispatch Mode S 执行](active/2026-07-30-grok-dispatch-execution.html) | Phase 2a **live 已验收**；Mode W/P / Host Wave 2 仍 open | Mode W 或 Wave 2 证据 |
| [Dispatch / Mode S 升级 backlog](active/2026-07-31-dispatch-upgrade-backlog.html) | C4–C6 **promoted**；Mode W/P / Wave 2 后置 | 未关闭项见文内表 |

说明：active 中可含「主路径已完成、仍作指针」的条目；新工作优先开新 plan 或更新「仍后置」表，避免重复实现已 promoted 项。

## 已完成计划

| 计划 | 结果 |
| --- | --- |
| [Dispatch / Ralph 任务回退](completed/2026-07-31-dispatch-ralph-rollback.html) | R1–R4 已交付；Ralph R3-3 于 2026-08-01 由**无终态冻结** supersede（同 run resume / soft archive / ABANDONED） |
| [Grok Host Adapter Phase 1 — 契约扩展](completed/2026-07-27-grok-host-adapter.html) | 契约与纯状态测试完成；Phase 2/3 真 Host 未启动 |
| [Harness Engineering 收口与真实 Host 路径](completed/2026-07-18-harness-hardening.html) | 仓库侧收口完成；真实 Host 见 [PENDING](../milestones/real-host-acceptance.html) |
