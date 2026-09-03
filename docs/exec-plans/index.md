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
| [Grok dispatch Mode S 执行](active/2026-07-30-grok-dispatch-execution.html) | Phase 2a live + Mode W/P **机械已落地**；Host Wave 2 / A2 **已关闭** | 可选 remote land / Revert-remerge |
| [Dispatch / Mode S 升级 backlog](active/2026-07-31-dispatch-upgrade-backlog.html) | C4–C6 + Mode W + Mode P + Host Wave 2 **promoted** | 可选 remote land |
| [文档站 VitePress 迁移与文案改版](active/2026-09-03-docs-site-vitepress.html) | Phase A 站点迁移 → Phase B 使用文档改版 | A1 骨架 |

说明：active 中可含「主路径已完成、仍作指针」的条目；新工作优先开新 plan 或更新「仍后置」表，避免重复实现已 promoted 项。

## 已完成计划

| 计划 | 结果 |
| --- | --- |
| [Ralph 工作区 P2+ lite](completed/2026-09-03-ralph-plans-workspace-p2-lite.html) | P2+a `--lite` / `brief` / `close` 别名写五键、budget ≤ 3、FAIL/BLOCKED 或 scope 膨胀升 full 同目录；P2+b 启发式判档只建议（无 flag 仍 full，tiny ≠ lite）+ skill / 命令文档口语。schema 仍 1.2；收口批已升 gym pin（`lab:check` 回绿）并修复 lite 预算出口残留 BLOCKED |
| [Ralph 工作区 P2](completed/2026-09-02-ralph-plans-workspace-p2.html) | P2a `task-*` + `.state/` + schema 1.2；P2b same/review 定位；P2c migrate/adopt + 去掉 1.0 标题回退。lite 未开 |
| [Ralph 工作区 P1](completed/2026-09-02-ralph-plans-workspace-p1.html) | P1a 五模块拆分、P1b 布局 8→4 + schema 1.1、P1c 归档原地翻转；P2 另开 |
| [Grok Host Adapter Phase 2 / Wave 2](completed/2026-09-01-grok-host-adapter-phase2.html) | 真 Grok 试跑 + 人工审查升 A2；JSON 不得自关 |
| [实验场 Loop gym / Family gym](completed/2026-08-31-jj-flow-labs.html) | 机械实验场 Implemented；PR1–PR10 合入 `main`；`lab:check` 进 `verify`。Live Agent 仍为手册 / evaluated |
| [AI-native SDLC 对齐](completed/2026-08-31-ai-native-sdlc.html) | 切片 0–7：可选 intent、Current 解析、审查政策、两次打脸、测试完整性、派生指标、确定性评测、宿主样例、事故回环 |
| [Dispatch / Ralph 任务回退](completed/2026-07-31-dispatch-ralph-rollback.html) | R1–R4 已交付；Ralph R3-3 于 2026-08-01 由**无终态冻结** supersede（同 run resume / soft archive / ABANDONED） |
| [Grok Host Adapter Phase 1 — 契约扩展](completed/2026-07-27-grok-host-adapter.html) | 契约与纯状态测试完成；Phase 2/3 真 Host 未启动 |
| [Harness Engineering 收口与真实 Host 路径](completed/2026-07-18-harness-hardening.html) | 仓库侧收口完成；Grok 真 Host 后由 [验收页](../milestones/real-host-acceptance.html) completed / A2 |
