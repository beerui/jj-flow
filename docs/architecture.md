# 架构

## 一句话

`jj-flow` = **项目族编排协议**：same 迁移、ralph 单仓闭环、dispatch 多项目调度。  
可选会话引擎：team-coordinate / team-lifecycle / team-swarm（**不**推进 checkpoint）。  
产品中心是编排与证据门禁，不是重写外部 coding agent。

## 三条主路径

```text
same:     源证据 → 目标差异 → 原生架构实施 → 验证 → 同步检查点
ralph:    需求 → 计划 → 实施/验证 → 验收 → 归档 → 能力地图
dispatch: plane → tick → host actions → receipts → 下一检查点
```

可选（会话执行/搜索，非交付真相）：

```text
coordinate: 动态多角色 → TC-* artifacts（可引用进 evidence）
lifecycle:  固定 SDLC   → TLV4-* spec/plan/artifacts
swarm:      对抗搜索   → TAS-* best-solution
```

## 模块（定位）

| 区域 | 职责 |
|------|------|
| `skills/jj-*` | 对话协议 SSOT（多端 install） |
| `src/dispatch*.mjs` | 控制面状态机、tick、CAS、host 契约 |
| `src/ralph.mjs` | 单仓机械步骤 |
| `src/scenarioRunner.mjs` / `dispatchTrace.mjs` | 可重放场景与纯 replay |
| `src/hostTrialRunner.mjs` | 半真实 Host trial |
| `src/harnessGc.mjs` / `check-harness.mjs` | 仓库 Harness 门禁与熵扫描 |
| `docs/` | 用户文档 SSOT → `npm run docs:build` |

代码级地图：仓库根 **`ARCHITECTURE.md`**。

## 不变量（摘要）

1. 只有持久证据推进状态  
2. 控制面单写者；worker 回报 receipt  
3. `task_key` 可恢复；临时 subagent 不是身份  
4. Reviewer 只读；Developer 仅在获批写工作区  
5. 外部副作用归宿主；runtime 无 daemon、不自动 merge  
6. 真 Host 未验收前 `max_unattended_level = A1`

## 成熟度边界

| 已关闭 | 仍 open |
|--------|---------|
| M6 / M7 半真实 / H5 GC / Mode S 日常、[AI-native SDLC 翻译](design-docs/ai-native-sdlc.html)、[机械实验场](design-docs/jj-flow-labs.html)（`lab:check` 进 `verify`；`evidence_class` 硬门；`lab-harness` gym host） | 真 Host Wave 2、A2+、evaluated 完整 LLM 回放闭环、实验场 Live Agent |

## ADR

[ADR 索引](adr/index.html) · [0001 外部工具边界](adr-0001-external-tool-boundary.html) · [0002 控制面](adr-0002-project-family-control-plane.html)
