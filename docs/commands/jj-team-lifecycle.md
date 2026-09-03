# team-lifecycle — 固定 SDLC 会话流水线

需要 **标准工程过程**（规格文档链 + 可选实现测审）时用。  
固定角色：分析 / 写规格 / 计划 / 实现 / 测试 / 审查 / 门禁。  
产物写在业务仓 `.workflow/.team/TLV4-*/`。

| 工具 | 怎么喊 |
|------|--------|
| Codex / Grok / Qoder | `$jj-team-lifecycle` |
| Claude | `/jj-team-lifecycle` |

## 什么时候用

| 意图 | 建议 |
|------|------|
| 只要 brief / PRD / 架构 / epics | `--pipeline spec-only` |
| 规格已有，要计划→实现→测审 | `--pipeline impl-only` |
| 规格 + 实现整条链 | `--pipeline full-lifecycle`（更重，先确认） |

**不是：** 动态多角色随任务拼装（用 [coordinate](jj-team-coordinate.md)）；对抗搜索（用 [swarm](jj-team-swarm.md)）；正式验收真相（仍是 [ralph](jj-ralph.md) / [dispatch](jj-dispatch.md)）。

**不会** 推进 checkpoint。`spec/` / `plan/` / `artifacts/` 可被 ralph 引用。

## 怎么说

```text
$jj-team-lifecycle --pipeline spec-only 设计会员积分
```

```text
/jj-team-lifecycle --pipeline impl-only 按现有 PRD 实现并测审
```

嵌套 ralph/review/dispatch 时一句：

```text
开启 lifecycle 模式，开始任务会员积分规格 约 20-45分钟
```

## 写在哪

```text
.workflow/.team/TLV4-<简述>-<日期>/
  team-session.json
  spec/
  plan/
  artifacts/
```

## 相关

[命令总览](../commands.md) · [coordinate](jj-team-coordinate.md) · [swarm](jj-team-swarm.md) · [ralph](jj-ralph.md)
