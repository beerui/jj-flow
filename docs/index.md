# jj-flow

用 **对话** 在多个相关项目里，把「改功能、迁功能、一起派任务」做完，并且 **能核对、能接着做**。

支持：Codex · Claude · Grok · Qoder。

> 聊天里说「做完了」不算数。  
> 算数的是：仓库里的记录、Git 提交、审查结果。

## 我该用哪个？

| 你想… | 用这个 | 说明 |
|--------|--------|------|
| **把当前仓接入全局地图** / 梳理项目 / 补知识库 | [init](command-jj-init.html) | 须你点头才写入 |
| **只改当前这一个仓库**，从做到验收 | [ralph](command-jj-ralph.html) | 单仓闭环 |
| **把 A 仓的能力搬到 B/C 仓** | [same](command-jj-same.html) | 同源迁移 |
| **多个项目一起派、一起盯** | [dispatch](command-jj-dispatch.html) | 多项目调度 |
| 把审查结论记下来 | [review](command-jj-review.html) | 审查落盘 |
| 提交并合进 dev/main | [end](command-jj-end.html) | 收工 |
| 会话内**动态多角色**协作（可选） | [team-coordinate](command-jj-team-coordinate.html) | 不推进验收门 |
| **固定 SDLC** 规格/实现流水线（可选） | [team-lifecycle](command-jj-team-lifecycle.html) | 不推进验收门 |
| **对抗搜索** 多方案（可选） | [team-swarm](command-jj-team-swarm.html) | 不推进验收门 |

还没装？→ [安装](installation.html)  
装好了？→ [五分钟上手](usage.html)  
容易踩坑？→ [常见踩坑](pitfalls.html)

## 怎么用（一句话）

1. 装好 skill  
2. 在 **业务项目** 的对话里打 `$jj-…`（Codex）或 `/jj-…`（Claude / Grok / Qoder）  
3. 用日常说话描述要做什么  

**不要**靠手敲命令行做业务（命令行只给维护用，见侧栏「维护者」）。

| 你用的工具 | 怎么喊 |
|------------|--------|
| Codex | `$jj-ralph`、`$jj-same`、`$jj-dispatch`… |
| Claude | `/jj-ralph`、`/jj-same`…（**没有** `/jj-dispatch`） |
| Grok / Qoder | `/jj-ralph`、`/jj-dispatch`… |

## 它们怎么配合（知道即可）

```text
一个仓库做完 ──ralph──► 可以说「交接到…」
                              │
                              ▼
                         same 迁到别的仓库
                              │
        多个仓库一起派 ──dispatch──► 批准后分别做
                              │
                         end 提交 / 合分支
```

想看全部入口：[命令总览](commands.html)  
名词不懂：[术语](glossary.html)

## 维护与深入（可后看）

| 主题 | 链接 |
|------|------|
| 架构 | [架构](architecture.html) |
| 设计 | [设计文档](design-docs/index.html) · [Agent Harness](design-docs/harness-engineering.html) |
| 执行计划 | [执行计划](exec-plans/index.html) |
| ADR | [ADR](adr/index.html) |
| M7 / H5 | [M7](milestones/m7-acceptance.html) · [H5](milestones/h5-acceptance.html) |
| 真实 Host（Grok 路径 completed / A2） | [验收页](milestones/real-host-acceptance.html) |
| 改本仓库文档 | [维护说明](maintenance.html) |
