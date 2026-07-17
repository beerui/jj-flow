# `jj-dispatch` 多项目任务调度

`jj-dispatch` 是运行在独立控制项目中的跨项目控制入口。它负责保存动态项目角色、预览任务、获得批准、创建 Codex task、绑定 thread、汇总结构化回执和恢复中断状态；实际需求实现、bug 修复和同源迁移仍交给其它 `jj-*` 命令。

`jj-dispatch` 当前是 **Codex-only**：只提供 `$jj-dispatch`，没有 Claude Code 的 `/jj-dispatch`。它依赖 Codex App 的 project、thread、worktree 和 sandbox attestation 能力。

## 适用场景

- 一个需求需要由一个主任务统一管理多个已注册项目和多种责任。
- 需求最先出现的项目、正式需求持有项目、领头实施项目和目标项目不是同一个仓库。
- 同一项目包含 development、verification、review 等有依赖的任务，需要稳定 `task_key` 和可恢复状态。
- 需要保证同一项目同时最多一个 active writer，并让写任务使用独占 worktree。
- 主调度任务中断后，需要根据已持久化的 intent、thread 和回执恢复进度。

## 何时不用

- 单项目完整交付使用 [`jj-delivery`](command-jj-delivery.html)。
- 单个业务交付、明确功能或线上问题使用 [`jj-delivery`](command-jj-delivery.html)。
- 同源项目的具体差异分析、迁移实现和同步检查点使用 [`jj-same`](command-jj-same.html)。
- 不需要创建 Codex task，只想手工维护一份计划时，不必引入控制项目。
- Codex App 缺少 project/thread/worktree 或 runtime sandbox 证明时，只能停在 `PREVIEW_ONLY/BLOCKED`，不能降级为无项目、无 worktree 的任务。

## 输入模板

先预览任务集合：

```text
$jj-dispatch PREVIEW
delivery：<稳定交付标识或本轮需求名>
需求引用：<PRD、Codex thread、ANL/BLP 或 handoff_ref，只写引用>
origin_project：<需求或 bug 最先出现的项目>
requirement_owner：<正式需求和 handoff 的持有项目>
lead_project：<本轮首先实施的项目>
targets：<明确授权的目标项目>
responsibilities：<每个项目的责任、phase、access、attempt、depends_on>
验收：<何时可视为 VERIFIED 或 NO_CHANGE_REQUIRED>
```

确认预览后再派发：

```text
$jj-dispatch DISPATCH 批准 delivery=<delivery_id> 的当前 task_keys
```

创建成功但未绑定时恢复：

```text
$jj-dispatch RECONCILE task_key=<delivery_id/project_id/responsibility/attempt>
```

## 完整示例

### 示例 1：先 `PREVIEW`，明确批准后再 `DISPATCH`

在一个不承担本轮业务开发的控制项目中输入：

```text
$jj-dispatch PREVIEW
delivery：支付状态优化
需求引用：@D:\codeup\duijie\dj-frontend-web\.workflow\blueprint\BLP-payment-status-20260717\requirements\REQ-001.md
origin_project：duijie-web
requirement_owner：duijie-web
lead_project：chengjie-web
targets：chengjie-web, chengzai-web
responsibilities：
- chengjie-web/development，phase=development，access=write，attempt=1，depends_on=[]
- chengjie-web/verification，phase=verification，access=read，attempt=1，depends_on=[DEL-payment/chengjie-web/development/1]
- chengjie-web/review，phase=review，access=read，attempt=1，depends_on=[DEL-payment/chengjie-web/verification/1]
- chengzai-web/development，phase=development，access=write，attempt=1，depends_on=[DEL-payment/chengjie-web/review/1]
验收：写任务产出稳定 commit；verification 有证据；terminal writer 的当前 commit 获得 Review PASS。
```

`PREVIEW` 只展示动态角色、依赖、阻塞项和完整 `task_key`，不会创建 task。核对无误后再输入：

```text
$jj-dispatch DISPATCH 批准 delivery=DEL-payment 的当前 task_keys
```

依赖未完成的任务会保持 `WAITING_DEPENDENCY/deferred`。当前 wave 完成后，再次执行同一批准的 `DISPATCH`，只派发下一批尚未创建且依赖已满足的任务。

### 示例 2：恢复 `UNKNOWN` 绑定异常

```text
$jj-dispatch RECONCILE task_key=DEL-payment/chengjie-web/development/1
```

调度器会查找与该 intent 唯一匹配的 Codex thread：

- 恰好一个候选：绑定 thread，补齐 `host_id`、实际 sandbox、environment 和绑定时间，然后继续监控结构化回执。
- 零个或多个候选：本次返回 `BLOCKED`，持久化 intent 继续保持 `UNKNOWN`，不会重复创建 task。

若已确认旧 thread 无法找回，后续操作应明确记录原因，把旧 intent 转为 `BLOCKED`，将 responsibility 的 `attempt` 从 `1` 增到 `2`，重新执行 `PREVIEW` 和批准：

```text
$jj-dispatch PREVIEW delivery=DEL-payment 重试 chengjie-web/development attempt=2，旧 attempt 已确认无法找回，证据=@D:\delivery-control\evidence\lost-thread.md
```

### 示例 3：恢复已关闭的主调度任务

```text
$jj-dispatch 恢复 delivery=DEL-payment，检查所有已绑定任务，消费最新结构化回执，并按 depends_on 派发下一 wave。
```

当前 Beta 没有常驻 daemon。主调度任务关闭后，需要重新进入控制项目执行恢复；子任务不能直接修改控制 manifest。

## 执行过程

1. 读取控制项目的 `control-plane.json`，核对已注册项目、路径、Git identity 和 Codex `projectId`。
2. 根据本轮动态角色和 responsibilities 生成稳定 `task_key`：`delivery_id / project_id / responsibility / attempt`。
3. 执行 `PREVIEW`，展示完整任务集合、依赖、访问方式、阻塞项和将冻结的批准快照；此时不创建 task。
4. 用户明确批准后执行 `DISPATCH`：先持久化 `dispatch_intent`，再由 Codex App host 创建目标 project task。
5. 写责任绑定目标项目独占 worktree；只读责任只消费已提交 commit，不携带 worktree。
6. 创建成功后立即绑定 thread，并记录 host、agent、实际 sandbox 和环境证明。绑定失败时进入 `UNKNOWN`，禁止盲目重试。
7. 子任务只返回结构化回执。主调度器核对 attempt、commit、依赖、worktree、验证和 Review 证据后，单写更新控制 manifest。
8. Review 为 `NEEDS_CHANGES` 时，先收口旧下游任务，再统一递增相关 attempt，重新 `PREVIEW`、批准和派发。

## 输出/完成标准

- `PREVIEW` 清楚列出 `origin_project`、`requirement_owner`、`lead_project`、`reference_implementation`、`targets`、responsibilities、依赖和稳定 `task_key`。
- `DISPATCH` 只使用用户批准的完整 task key 集合；目标、责任、依赖或 attempt 变化后必须重新批准。
- 同一 `task_key` 重复执行会复用已有 intent，不创建第二个 task。
- 同一项目同时最多一个 active write；多个写责任通过 `depends_on` 形成单一串行链。
- 子任务回执能追溯到项目、责任、branch/worktree、commit、artifact/evidence refs、验证、未解决项和下一步。
- `VERIFIED` 只在 terminal writer 当前 commit、Review PASS 和目标 commit 一致时成立。
- `NO_CHANGE_REQUIRED` 必须有当前 `ANL-TARGET`、差异证据、目标 `HEAD` 和 `unresolved=[]`；不会伪造 Developer commit、VRF 或 Review。

## 关键门禁与状态

### `PREVIEW` 与 `DISPATCH`

- `PREVIEW` 是默认动作，只读、不创建 task、不修改目标项目。
- `DISPATCH` 必须由用户明确批准。批准冻结本轮完整 `task_keys`；新增项目、责任、依赖或重试 attempt 后，旧批准失效。

### 主要状态

```text
DRAFT -> PREVIEW_ONLY -> APPROVED -> DISPATCHING -> RUNNING
      -> EVIDENCE_READY -> VERIFIED
任何阶段 -> BLOCKED
绑定异常 -> UNKNOWN -> RECONCILE
```

- `WAITING_DEPENDENCY`：前置 `task_key` 尚未完成，当前任务保持 `deferred`，不会提前创建 thread。
- `UNKNOWN`：task 可能已创建，但控制面绑定失败。只能 `RECONCILE` 或人工 `BIND_THREAD`，不能重复创建。
- `BLOCKED`：能力、依赖、绑定、证据或 sandbox attestation 不满足，必须先解除阻塞。

### Review 与同步检查点

- Review 只接受 `PASS` 或 `NEEDS_CHANGES`，finding 必须带稳定 ID、严重级别、文件、行号、说明、状态和验收标准。
- 同步目标无论是 `VERIFIED` 还是 `NO_CHANGE_REQUIRED`，都必须有 `FRESH` handoff、snapshot ref/hash、source/target branch 与 `HEAD` 和差异决策引用。
- thread 停止、标题变化或自然语言回复“完成”都不是检查点证据。

## 常见误区

- 跳过 `PREVIEW`，直接要求创建所有 task。任务集合必须先展示并获得明确批准。
- 把控制项目当成业务源项目，复制 PRD 正文、源码 diff 或验证正文。控制项目只保存引用和协调状态。
- 让子任务直接修改 `control-plane.json`、扩大目标集合或给自己标记 Review PASS。
- 在同一项目并行启动多个 writer，或让只读 Reviewer 使用 worktree。
- `UNKNOWN` 后再次创建同一 `task_key`，造成重复任务。应先 `RECONCILE`。
- 把 agent TOML 的期望 sandbox 当成运行时证明。绑定必须记录 host 返回的实际 sandbox attestation。
- 把 `$jj-dispatch` 当成同步实现器或常驻 daemon。具体迁移交给 `$jj-same`，主调度关闭后需要显式恢复。
- 在 Claude Code 中尝试 `/jj-dispatch`。首版只支持 Codex `$jj-dispatch`。

## 相关命令

- [`jj-same`](command-jj-same.html)：执行具体同源迁移、差异适配和同步检查点。
- [`jj-delivery`](command-jj-delivery.html)：承担完整需求交付。
- [`jj-delivery`](command-jj-delivery.html)：承担交付、明确功能与真实 bug 的定位修复。
- [`jj-delivery`](command-jj-delivery.html)：在目标项目内提供质量审查和可追溯 findings（经 `$quality-review`）。
- [`jj` CLI](command-cli.html)：生成本地调度建议，不替代 Codex App 的 project task 调度。
