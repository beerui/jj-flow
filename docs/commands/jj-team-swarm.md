# team-swarm — 对抗蚁群搜索

需要 **多假设搜索 / 方案优选 / 对抗评分** 时用。  
算法侧 Python `aco.py`；编排侧 explore → score → converge → synthesize。  
产物写在业务仓 `.workflow/.team/TAS-*/`。

| 工具 | 怎么喊 |
|------|--------|
| Codex / Grok / Qoder | `$jj-team-swarm` |
| Claude | `/jj-team-swarm` |

## 什么时候用

- 架构路径或方案不确定，要多轮搜索收敛  
- 需要对抗评分、多假设竞争  
- 用户明确说蚁群 / TAS / 对抗搜索  

**不是：** 普通多角色写码（用 [coordinate](jj-team-coordinate.md)）；固定规格文档链（用 [lifecycle](jj-team-lifecycle.md)）；多项目调度（用 [dispatch](jj-dispatch.md)）。

**不会** 推进 checkpoint。常见交付物：`artifacts/best-solution.md`（只可引用）。

## 怎么说

```text
$jj-team-swarm 比较三种缓存失效方案并收敛推荐
```

```text
/jj-team-swarm 搜索登录改造的架构路径
```

嵌套时一句：

```text
开启 swarm 模式，开始任务缓存方案搜索 约 15-40分钟
```

需要本机 **Python ≥ 3.10**（stdlib）。Claude 可走 Workflow；Codex/Grok 多为 agent 降级。

## 写在哪

```text
.workflow/.team/TAS-<简述>-<日期>/
  swarm-config.json
  artifacts/best-solution.md
```

## 相关

[命令总览](../commands.md) · [coordinate](jj-team-coordinate.md) · [lifecycle](jj-team-lifecycle.md)
