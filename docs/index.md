# jj-flow

用**对话**在多个相关项目里把“改功能、迁功能、一起派任务”做完，并且**能核对、能接着做**。

支持：Codex · Claude · Grok · Qoder。

> 聊天里说“做完了”不算数。算数的是仓库里的记录、Git 提交和审查结果。

## 三步开始

1. [安装](installation.md)对话入口（约一分钟）
2. 看[第一次使用](usage.md)，在业务仓库里走完一个小需求
3. 以后按下表选择入口，用日常中文说要做什么

卡住了先看[常见踩坑](pitfalls.md)；拿不准入口可用 [jj](commands/jj.md) 分流。

## 我该用哪个？

| 你想… | 用这个 | 一句话说明 |
|--------|--------|------------|
| 把当前仓接入全局地图、梳理项目、补知识库 | [init](commands/jj-init.md) | 先给提案，你点头才写 |
| 只改当前这一个仓，从做到验收 | [ralph](commands/jj-ralph.md) | 五步闭环，完成后可继续改 |
| 把项目A 做好的能力搬到项目B / 项目C | [same](commands/jj-same.md) | 按目标仓自己的写法适配 |
| 多个项目一起派、一起盯 | [dispatch](commands/jj-dispatch.md) | 预览 → 你批准 → 派发 |
| 把审查结论写进任务 | [review](commands/jj-review.md) | 只读，不改业务代码 |
| 提交、推送、合进集成分支 | [end](commands/jj-end.md) | 只动 Git |

**快速判断：** 一个仓用 **ralph**；要搬家用 **same**；多个仓统一批准用 **dispatch**；只收工用 **end**。

可选（**不算**验收通过）：[team-coordinate](commands/jj-team-coordinate.md) 多角色 · [team-lifecycle](commands/jj-team-lifecycle.md) 固定 SDLC · [team-swarm](commands/jj-team-swarm.md) 多方案搜索 · [evaluated](commands/jj-evaluated.md) 离线复盘。

## 怎么喊

在**业务项目**的对话里使用前缀：Codex 用 `$jj-ralph`，其他工具通常用 `/jj-ralph`；完整平台差异见[宿主说明](concepts-hosts.md)。不想记入口时，直接说 `$jj` / `/jj` 让它分流。

## 它们怎么配合

```text
一个仓库做完 ──ralph──► 可以说“交接到…”
                              │
                              ▼
                         same 迁到别的仓库
                              │
        多个仓库一起派 ──dispatch──► 批准后分别做
                              │
                         end 提交 / 合分支
```

全部入口：[命令总览](commands.md) · 名词：[术语](glossary.md)

## 维护与深入（可后看）

| 主题 | 链接 |
|------|------|
| 架构 | [架构](architecture.md) |
| 设计 | [设计文档](design-docs/index.md) · [Agent Harness](design-docs/harness-engineering.md) |
| 执行计划 | [执行计划](exec-plans/index.md) |
| ADR | [ADR](adr/index.md) |
| 里程碑验收 | [真实 Host](milestones/real-host-acceptance.md) · [M7](milestones/m7-acceptance.md) · [H5](milestones/h5-acceptance.md) |
| 改本仓库文档 | [维护说明](maintenance.md) |
