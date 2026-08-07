# team-coordinate — 会话内动态多角色

需要 **多角色并行** 或 **按任务动态拆角色** 时用。  
产物写在业务仓 `.workflow/.team/TC-*/`。

| 工具 | 怎么喊 |
|------|--------|
| Codex / Grok / Qoder | `$jj-team-coordinate` |
| Claude | `/jj-team-coordinate` |

## 什么时候用

- 跨多模块一起改，适合分角色  
- 多角度分析（安全 / 性能 / 兼容等）  
- 显式说「Team Coordinate / 多角色 team」  

**不是：** 单仓验收闭环（用 [ralph](command-jj-ralph.html)）；多项目调度（用 [dispatch](command-jj-dispatch.html)）；固定 PRD/架构流水线（用 [lifecycle](command-jj-team-lifecycle.html)）；方案对抗搜索（用 [swarm](command-jj-team-swarm.html)）。

**不会** 推进 ralph / dispatch 的 checkpoint。跑完只留下 artifact，可由父 skill **引用**。

## 怎么说

```text
$jj-team-coordinate 支付回调与订单状态分角色并行改
```

```text
/jj-team-coordinate 多角度分析登录改动的影响面
```

嵌在 ralph DELIVER 里时，只会多一句类似：

```text
开启 team 模式，开始任务跨模块实现 约 10-25分钟
```

直接调用 **没有** 强制长 banner。

## 写在哪

```text
.workflow/.team/TC-<简述>-<日期>/
  team-session.json
  role-specs/
  artifacts/
```

## 相关

[命令总览](commands.html) · [lifecycle](command-jj-team-lifecycle.html) · [swarm](command-jj-team-swarm.html) · [ralph](command-jj-ralph.html)
