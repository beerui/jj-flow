# ADR 0002：用独立控制项目承载动态项目族调度

## 状态

Accepted for MVP

## 背景

多个同源项目通常由一个基线项目复制而来，但需求可能首先出现在 B 或 C，且各项目会独立演进。把某个仓库永久当作源项目会让需求归属、交接和同步检查点混在一起，也会把调度会话和业务开发会话互相污染。

## 决策

新增 Codex 专用 `$jj-dispatch` skill，并用一个独立控制项目保存项目注册、delivery、任务、thread 绑定、状态、决策和 artifact 引用。每轮显式区分：

- `origin_project`；
- `requirement_owner`；
- `lead_project`；
- `lead_responsibilities`（lead 不在 targets 时的默认开发任务）；
- `reference_implementation`；
- `targets`。

控制项目可以是空项目，也可以是一个不承担本轮开发的项目。业务需求正文、源码和目标验证正文继续留在它们的归属项目中，控制平面只保存稳定引用。

首版只做可恢复协议和 Codex App host 适配边界，不把 App thread API 写进 npm CLI，不实现 daemon、数据库、自动 merge/push/release，也不新增 Claude `/jj-dispatch`。`$jj-delivery`、`$jj-fix`、`$jj-same` 继续负责实际交付、修复和同源迁移。

## 关键约束

1. `PREVIEW` 默认只读；用户明确批准后才进入 `DISPATCH`。
2. 创建 thread 前先落盘 `dispatch_intent`，用 `delivery/project/responsibility/attempt` 生成稳定 `task_key`。
3. 创建成功但绑定失败时进入 `UNKNOWN`，只能唯一 `RECONCILE` 或人工 `BIND_THREAD`，禁止盲目重试。
4. 每个写任务使用目标项目独占 worktree；测试和 Review 消费已提交 commit。
5. `reference_implementation` 初始为 `null`，只有 lead 或已授权目标的稳定 commit 和 PASS 验证证据存在时才能设置。
6. 目标失败不推进该目标的同步 checkpoint，也不替其它目标宣告完成。

## 后果

优点：调度状态与业务仓库解耦，来源和领头角色可以按需求变化；每个会话边界清晰，失败可恢复且不会重复派发。

代价：首版仍需要 Codex App host 提供 project/thread/worktree capability；控制项目不会替代各目标自己的分析、实现、验证和评审，用户仍需明确批准派发和处理歧义候选。

## 与既有调用兼容

旧的 `源=A 目标=B,C` 语义映射为 `origin_project=A`、`requirement_owner=A`、`lead_project=A`、`reference_implementation=null`、`targets=[B,C]`。只有已有稳定 commit、snapshot 和 PASS 验证证据时，才将 reference 写成完整对象。没有显式控制项目时，`jj-same` 仍按原 handoff/sync 契约运行。
