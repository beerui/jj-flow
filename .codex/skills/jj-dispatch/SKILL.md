---
name: jj-dispatch
description: 项目族编排中的多项目调度入口；在控制项目中负责动态来源、领头/目标、任务派发、状态汇总和可恢复绑定，不替代 jj-same 迁移执行。
---

# jj-dispatch

## 定位

`$jj-dispatch` 运行在一个独立的控制项目中。控制项目可以是空项目，也可以是任意一个不承担本轮业务开发的仓库；它保存项目族、任务、Codex thread、状态、决策和 artifact 引用，不复制业务需求正文、源码或目标项目验证正文。

基线项目只是默认的领头项目，不是永久源项目。每轮都要分别记录：

- `origin_project`：需求或 bug 最先出现的项目；
- `requirement_owner`：持有正式 `ANL-SOURCE / BLP/REQ / Handoff Snapshot` 的项目；
- `lead_project`：本轮首先实施的项目；
- `lead_responsibilities`：当 lead 不在 `targets` 中时，本轮要先执行的责任任务，默认是一个 development 写任务；
- `reference_implementation`：通过验证后可供其它目标复用的 commit 和 snapshot；
- `targets`：本轮明确授权分析或同步的目标项目。

## 四个动作

### `PREVIEW`

默认动作。只读取控制项目 manifest，展示角色映射、目标清单、任务 key、依赖和阻塞项，不创建 thread，不修改目标项目，也不把任务降级成 projectless 任务。

### `DISPATCH`

只有用户明确批准本轮任务集合后才能执行。批准记录必须冻结本次 `task_keys`；新增项目、责任或重试 attempt 后必须重新 `PREVIEW` 和批准。先把 `dispatch_intent` 写入控制项目，再由 Codex App host 创建对应 project thread。同一项目可以声明多个 write responsibility（例如 frontend/backend），但必须在 `depends_on` 中形成单一串行链；运行时同一项目最多一个 active write，写任务使用目标项目独占的 worktree。产品、测试和 Review 默认是只读责任，只能消费已提交的 commit；当前 MVP 仍加载 Reviewer profile，责任专属 profile 由后续版本补齐。

稳定 `task_key` 为：

```text
delivery_id / project_id / responsibility / attempt
```

同一 key 重复执行必须复用已有 intent，不能创建第二个任务。创建 thread 成功但控制项目未能完成绑定时，把 intent 标为 `UNKNOWN`，后续只能 `RECONCILE` 或人工 `BIND_THREAD`。

### `RECONCILE`

恢复中断的派发。只有找到唯一匹配的 thread 才能自动绑定；零个或多个候选时本次操作返回 `BLOCKED`，持久化 intent 仍保持 `UNKNOWN`，禁止盲目重试。

如果确认 thread 无法找回，先把 `UNKNOWN` 显式标记为 `BLOCKED`（记录原因和 evidence ref），再递增 responsibility 的 `attempt`，重新 `PREVIEW`/批准。不能复用原 task key，也不能直接再次创建同一 thread。

### `BIND_THREAD`

把已创建的 Codex thread 与稳定 `task_key` 绑定。thread 停止、标题变化或回复“完成”都不是交付完成证据；必须消费结构化回执、提交、目标测试和 Review 结果。

## Codex App host 执行顺序

控制项目 skill 不把 host API 封装进 npm CLI，但在 Codex App 中按以下顺序调用能力：

1. 用 `list_projects` 解析每个注册项目的 Codex `projectId`；路径、Git identity 和 `projectId` 分开记录。
2. 按批准快照生成 `task_key`，先写入 `dispatch_intents`，再调用 `create_thread`。写责任必须指定目标项目的独占 worktree；只读责任消费已提交 commit。
3. 创建成功后立即执行 `BIND_THREAD`；写回失败就标记 `UNKNOWN`，不能直接再次 `create_thread`。绑定时必须记录 `host_id`、`agent_name`、期望 `sandbox_mode`、实际 `effective_sandbox_mode`、`sandbox_evidence_ref`、`environment` 和 `bound_at`。TOML 只是默认配置，不能证明子会话实际继承的 sandbox；host 拿不到 runtime effective sandbox attestation 时必须拒绝绑定。`access=read` 只能使用 `jj-workflow-reviewer`、`read-only`、`project-read`，不得绑定 worktree。
4. 用 `list_threads`、`read_thread` 和 `send_message_to_thread` 监控和补充上下文。标题、停止状态和自然语言“完成”不能替代结构化回执。
5. 子任务回执至少包含 `task_key`、`attempt`、项目、责任、分支/worktree、commit（若适用）、artifact refs、验证结果、未解决项和下一步。调度器消费回执后才推进目标状态、reference 或 checkpoint。
6. 单次 `tick/resume`（CLI：`jj dispatch-tick`）消费 receipt、按 `expected_revision` 做 CAS，并输出 `actions` / `decision_required` / `next_wait`。恢复时必须对仍为 `PENDING_THREAD` 的 intent 重放 `CREATE_THREAD` actions。`--write` 走文件级 CAS，revision 冲突返回 `REVISION_CONFLICT` 且不覆盖。
7. 每个 target 开发前必须有已批准的 `ANL-TARGET`、`difference_ref`、`knowledge_refs` 与 `DIRECT/ADAPT/SYNC/NO_CHANGE_REQUIRED/BLOCKED` 决策；未就绪目标只进入 `decision_required`，不得阻塞其它已就绪目标。不可绕过目标分析门禁。

推荐的责任顺序是：产品/需求澄清 -> lead development -> 各目标 development -> test -> review。每一步都由调度器确认上一责任的结构化证据后再派发下一责任；不要让子会话自行派生新任务。

Review 必须走持久化闭环：审查者回报 `PASS` 或 `NEEDS_CHANGES`，每条 finding 记录 `id/severity/file/line/description/status/acceptance`。`NEEDS_CHANGES` 由调度器调用 `requestRework`；仍为 `PENDING_THREAD/BOUND/UNKNOWN` 的旧下游任务必须先完成或阻塞，再统一递增 developer、下游验证和下一次 review 的 `attempt`，清空批准快照并重新 `PREVIEW`。下一次 `PASS` 必须显式把上一轮 OPEN finding 标为 `RESOLVED` 或 `WAIVED`。目标 `VERIFIED` 前，必须有 downstream terminal writer 的当前 Review PASS，且与 terminal writer `produced_commit` 和目标 commit 完全一致。

每个 responsibility 必须同时声明 `phase`（`planning`、`development`、`verification` 或 `review`）、`attempt`（从 `1` 开始）和 `depends_on`（任务 key 数组，可为空）。调度器只按 `depends_on` 放行；依赖未完成时返回 `WAITING_DEPENDENCY`/`deferred`，不会提前创建 thread。依赖完成后再次执行同一批准的 `DISPATCH`，只创建下一波未生成的任务；修改依赖或 attempt 必须重新预览并批准。

## 委派规则

调度智能体只负责拆解、分配和汇总。实际工作仍交给：

- `$jj-same`：按 handoff/sync checkpoint 做同源迁移、差异适配和持续同步；
- 目标项目内的开发 / `$quality-review` / 测试角色：消费已提交 artifact，返回结构化证据。

调度智能体可以请求 Codex App 创建角色会话，但子会话不能自行创建可见任务、修改控制 manifest 或扩大目标集合。开始前检测 `list_projects`、`list_threads`、`create_thread`、`read_thread`、`send_message_to_thread`、项目 worktree 和 sandbox capability；任一必需能力缺失时停在 `PREVIEW_ONLY/BLOCKED`。同一项目同时最多一个 active write task。全部流程禁止调用 `maestro explore`。

## 状态与门禁

推荐状态链：

```text
DRAFT -> PREVIEW_ONLY -> APPROVED -> DISPATCHING -> RUNNING
       -> EVIDENCE_READY -> VERIFIED
任何阶段 -> BLOCKED；派发绑定异常 -> UNKNOWN -> RECONCILE
```

`reference_implementation` 初始必须为 `null`。只有领头项目或已授权目标的 commit 稳定，并且有 `PASS` 验证证据、snapshot 引用和 hash 时才能设置；不能因为它是基线或领头项目就自动成为 reference。任一目标失败时保留它原有的同步 checkpoint，不推进整个项目族的基线。

目标回执使用 `VERIFIED` 或 `NO_CHANGE_REQUIRED`。`VERIFIED` 必须提供经过 terminal writer 当前 Review PASS 的新 commit、source head 和验证证据；`NO_CHANGE_REQUIRED` 用当前 planning/analysis responsibility 产生的 `ANL-TARGET`、`difference_ref`、目标 HEAD 和 `unresolved=[]` 形成零改动检查点，显式把未派发的 development/verification/review responsibility 标记为 `SKIPPED`，不要求或伪造 Developer commit、VRF 或 Review。同步目标两种状态都必须提供 `FRESH` handoff、snapshot ref/hash、source/target branch 与 HEAD、差异决策引用；任一字段缺失或为 `STALE` 都不得推进 checkpoint。

## 控制项目文件

控制项目的最小持久化结构见 [control-project.md](references/control-project.md) 和 [control-plane.schema.json](references/control-plane.schema.json)。建议：

- `control-plane.json`：唯一权威当前状态，带单调递增 `revision`；MVP 允许在其中保留 `events` 审计数组；
- `events.ndjson`：可由控制项目 host 从审计数组导出的追加式日志，不作为第二份可编辑状态真相；
- `README.md`：项目注册、批准和恢复说明。

不要把业务源码、完整 PRD、目标验证正文复制进控制项目。只保存稳定路径、thread id、commit、snapshot、验证和需求引用。

## 与 `jj-same` 的关系

`$jj-dispatch` 是跨项目控制平面，不是同步实现器。它可以把一次批准的目标交给 `$jj-same`，但 `jj-same` 仍负责目标分析、差异适配、验证和 sync checkpoint。旧调用 `源=A 目标=B,C` 兼容映射为 `origin=A、requirement_owner=A、lead=A、reference_implementation=null、targets=[B,C]`；只有已有稳定 commit、snapshot 和 PASS 验证证据时，才把 reference materialize 为完整对象。新建控制项目的任务优先使用显式动态角色。

## 明确不做

- 不实现常驻 daemon、数据库或完整多智能体执行引擎；
- 不自动 checkout、merge、push、release；
- 不因 thread 停止或模型文字回复推进检查点；
- 不新增 Claude `/jj-dispatch`，首版只提供 Codex 调度入口；
- 不把控制项目变成业务源项目，业务产物仍归属实际 `requirement_owner` 或目标项目。
