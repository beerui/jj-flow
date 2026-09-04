# team-lifecycle — 固定角色走一条 SDLC 流水线

**可选入口：** 它只帮你安排这一轮怎么做，单独跑完不算验收通过；验收仍看 [ralph](jj-ralph.md) / [dispatch](jj-dispatch.md) 的记录。

**它帮你做什么：** 用固定角色和固定阶段把规格、计划、实现、测试、审查串起来，适合希望过程标准化的团队。

**它不做什么：** 不替代 ralph 的单仓闭环，不替代 dispatch 的多项目控制，也不会凭聊天推进任何交付门禁。

| 你用的工具 | 怎么喊 |
|------------|--------|
| Codex / Grok / Qoder | `$jj-team-lifecycle …` |
| Claude | `/jj-team-lifecycle …` |

## 什么时候用

| 你的目标 | 选择 |
|----------|------|
| 只产出 brief、PRD、架构或 epics | `--pipeline spec-only` |
| 已有规格，只做计划→实现→测试→审查 | `--pipeline impl-only` |
| 规格和实现整条链都要 | `--pipeline full-lifecycle`（更重，先确认范围） |

**不该用它的情况：** 想按问题动态拼角色用 [coordinate](jj-team-coordinate.md)；想比较多个候选方案用 [swarm](jj-team-swarm.md)；只改一个小需求直接用 [ralph](jj-ralph.md)。

## 开始前

1. 先选流水线：`spec-only`、`impl-only` 或 `full-lifecycle`。
2. 准备现有资料（例如 PRD、约束、测试要求）；没有规格却选 `impl-only` 会先提醒你。
3. 说明是否允许进入实现阶段；固定流水线较重，不确定时先做 `spec-only`。

## 第一次这样用

**你说：**

```text
$jj-team-lifecycle --pipeline spec-only 设计会员积分功能
```

**Agent 会做：**

1. 按固定角色依次分析、写规格并检查一致性。
2. 把结果写入本次 TLV4 会话；需要修改时可按任务编号反馈或重检。
3. 完成后给出规格、计划（若该流水线包含）和其他产物路径，并让你选择归档、保留或导出。

**你会看到：**

```text
流水线：spec-only
角色：分析 → 写规格 → 质量检查
产物：.workflow/.team/TLV4-…/spec/
下一步：归档 / 保留继续 / 导出结果
```

**怎样算做完：** 选定流水线的产物完成且可查；这不等于 ralph ACCEPT 或 dispatch VERIFIED，正式交付仍需走对应主路径。

## 常用说法

```text
$jj-team-lifecycle --pipeline impl-only 按现有 PRD 实现并测审
$jj-team-lifecycle --pipeline full-lifecycle 从需求到实现都走一遍
$jj-team-lifecycle status
$jj-team-lifecycle resume
$jj-team-lifecycle recheck
```

## 做完之后

| 你想做什么 | 下一步 |
|------------|--------|
| 用规格指导当前仓实现 | 回 [ralph](jj-ralph.md) 引用 `spec/` / `plan/` |
| 修改某个阶段 | 说 `revise <任务编号> 反馈…` |
| 继续未完成流水线 | 说 `resume` / `continue` |
| 正式收工 | 验收完成后再用 [end](jj-end.md) |

## 进阶

固定角色包括分析、写规格、计划、实现、测试、审查和监督；宿主能力不足时会降级到文件总线和可用代理，但不会把流水线完成冒充为交付通过。嵌在 ralph / review / dispatch 中只把 `spec/`、`plan/`、`artifacts/` 路径交给父流程引用。

## 记录在哪

```text
.workflow/.team/TLV4-<简述>-<日期>/
  team-session.json
  spec/
  plan/
  artifacts/
```

## 相关

[coordinate](jj-team-coordinate.md) · [swarm](jj-team-swarm.md) · [ralph](jj-ralph.md) · [命令总览](../commands.md)
