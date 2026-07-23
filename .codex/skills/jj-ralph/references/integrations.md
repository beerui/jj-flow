# 与 jj-same / jj-dispatch 的关系

## jj-same（迁移）

Ralph 在**当前单仓**完成分析→实施→验收后，若需要把同一能力迁到同源其它项目：

1. 运行 `jj ralph handoff --run-id RALPH-…`
2. 产物落在 **`.workflow/handoffs/<HOF-ID>/`**（`handoff.json`、`source.md`），**不在** `.workflow/ralph/` 下实现迁移代码。
3. 交接文档引用 ralph 的 analyze/acceptance/business-map；**目标仓实现**由 `$jj-same` 读取 handoff 任务需求后进行。
4. same 可把 handoff 当证据入口，仍按目标原生架构适配，不整目录复制 ralph 文件夹。

## jj-dispatch（多项目调度）

任务在当前仓验收完成后，若要向其它项目分发实现：

1. 运行 `jj ralph dispatch-snapshot --run-id RALPH-…`
2. 产物：`.workflow/dispatch/recommendations/<SNAP-ID>/snapshot.json`
3. 控制项目用 `$jj-dispatch` 读取该快照，创建/批准目标任务；**dispatch 拥有调度身份**，ralph 只提供推荐快照与证据引用。

## 边界

| 能力 | 归属 |
| --- | --- |
| 单仓闭环、能力地图、归档 | `jj-ralph` |
| 同源多仓迁移与同步检查点 | `jj-same` |
| 控制面 task_key / 批准 / 恢复 | `jj-dispatch` |
