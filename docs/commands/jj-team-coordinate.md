# team-coordinate — 这一轮动态拆多角色

**可选入口：** 它只帮你安排这一轮怎么分析或实现，单独跑完不算验收通过；验收仍看 [ralph](jj-ralph.md) / [dispatch](jj-dispatch.md) 的记录。

**它帮你做什么：** 根据当前问题临时生成角色（例如分析、实现、检查），再按角色协作完成一轮多模块工作。角色和产物都属于本次会话，不会变成交付任务身份。

**它不做什么：** 不替代单仓闭环、同源迁移或多项目调度，也不会凭聊天内容推进 ralph / dispatch 的门禁。

| 你用的工具 | 怎么喊 |
|------------|--------|
| Codex / Grok / Qoder | `$jj-team-coordinate …` |
| Claude | `/jj-team-coordinate …` |

## 什么时候用

- 一个需求横跨多个模块，适合让不同角色各看一块
- 想从安全、性能、兼容等角度同时分析
- 你明确要求“多角色”“Team Coordinate”或动态拆分

**不该用它的情况：** 小改动直接用 [ralph](jj-ralph.md)；要迁仓用 [same](jj-same.md)；要固定规格流水线用 [lifecycle](jj-team-lifecycle.md)；要多假设搜索用 [swarm](jj-team-swarm.md)。

## 开始前

1. 在要处理的业务仓库对话里使用，并说清目标和范围。
2. 只在确实需要多角色时使用；单点改动会增加沟通成本。
3. 知道宿主能力不同：有的会并行，有的会降级为串行，但都会保留同一套产物契约。

## 第一次这样用

**你说：**

```text
$jj-team-coordinate 支付回调与订单状态分角色并行分析并实现
```

**Agent 会做：**

1. 先分析任务，生成本轮角色和依赖关系。
2. 创建会话记录，再按宿主能力派发角色（可并行，也可能串行降级）。
3. 汇总各角色的实现、分析和验证产物，遇到失败会说明原因，不把缺失结果当完成。
4. 结束时给出摘要和产物路径；如果它嵌在 ralph / review / dispatch 里，只提供可引用证据，不改父流程门禁。

**你会看到：** 类似下面的进度与收尾：

```text
已生成 3 个角色：分析、实现、检查
team 会话完成：产物见 .workflow/.team/TC-…/
下一步：归档会话 / 保留继续 / 导出结果（请选择）
```

**怎样算做完：** 你拿到本轮的角色产物和摘要；业务交付是否通过，还要回到 ralph 或 dispatch 完成各自验收。

## 常用说法

```text
$jj-team-coordinate 多角度分析登录改动的影响面
$jj-team-coordinate 把支付模块拆成分析、实现、测试三个角色
$jj-team-coordinate resume
```

## 做完之后

| 你想做什么 | 下一步 |
|------------|--------|
| 把产物作为实现证据 | 在 [ralph](jj-ralph.md) 的验收记录里引用路径 |
| 继续本轮会话 | 说 `resume` /「继续」 |
| 正式验收当前仓 | 回到 [ralph](jj-ralph.md) |
| 多项目分别验收 | 使用 [dispatch](jj-dispatch.md) |

## 进阶

直接调用时没有强制的长提示；嵌在 ralph、review 或 dispatch 中，开始派角色前只会有一行透明提示。宿主没有 TeamCreate / maestro 时会使用文件消息总线或可用代理降级，不会因为缺少某个 API 就伪造完成。

## 记录在哪

```text
.workflow/.team/TC-<简述>-<日期>/
  team-session.json
  role-specs/
  artifacts/
```

## 相关

[ralph](jj-ralph.md) · [lifecycle](jj-team-lifecycle.md) · [swarm](jj-team-swarm.md) · [命令总览](../commands.md)
