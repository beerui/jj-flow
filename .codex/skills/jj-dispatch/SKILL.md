---
name: jj-dispatch
description: 在独立控制项目中做多项目族调度：确认 origin/requirement_owner/lead/targets，执行 PREVIEW→批准→DISPATCH→tick/resume，维护可恢复 task_key 绑定与 receipt 汇总。在跨项目派发、控制面 delivery、多目标同步编排、TASK-ID 恢复、多仓状态汇总时使用。单仓闭环用 jj-ralph；迁移实现用 jj-same；单仓审查用 jj-review。不替代迁移执行。
---

# jj-dispatch

在独立控制项目中做跨项目调度。控制项目可为空仓或不承担本轮业务开发的仓库；只存项目族、任务、thread、状态、决策和 artifact 引用，不复制需求正文、源码或目标验证正文。

控制面权威实现是仓库 `src/dispatchControlPlane.mjs` 与 schema；本 skill 描述必须与其状态机一致，不得发明并行枚举。

## 用户主线 vs 门禁优先

用户可见 happy path：

```text
读取 TASK-ID 主标题 -> PREVIEW -> 用户批准 -> DISPATCH -> tick/resume
```

异常与门禁**优先于**主线。下列规则按序号先匹配先生效：

```text
1. 缺 intake（intake.status=REQUIRED 或关键字段未确认）
   -> 只返回 INTAKE_REQUIRED
   -> 不 PREVIEW 推进、不 APPROVE、不 DISPATCH、不 create_thread

2. 存在 status=UNKNOWN 的 dispatch_intent
   -> 只走 RECONCILE 或人工 BIND_THREAD
   -> 禁止对同一 task_key 再 create_thread / 再写第二份 intent

3. 无本轮 task_keys 的明确批准
   -> PREVIEW（action=PREVIEW, status=PREVIEW_ONLY）
   -> 只读展示；不写 dispatch_intent；不 create_thread

4. 已批准，但缺 REQUIRED_APP_CAPABILITIES
   -> DISPATCH 拒绝（action=DISPATCH, ok=false, status=BLOCKED）
   -> plane 保持不变（delivery 可仍为 APPROVED）
   -> 不写 dispatch_intent；不 create_thread；不清空既有批准
   -> 返回 missing_capabilities

5. 已批准，且 capability / snapshot / active project 检查通过
   -> DISPATCH：先持久化 intent(PENDING_THREAD)，再 host CREATE_THREAD，再 BIND_THREAD

6. 有 receipt 或需推进已绑定任务
   -> tick/resume（jj dispatch-tick；写盘 CAS，revision 冲突返回 REVISION_CONFLICT）
```

有 `TASK-ID` 时先 `jj task context/status` 恢复索引与 manifest，再套用以上门禁。

## 角色字段

每轮分开记录；基线项目只是默认 lead，不是永久源：

| 字段 | 含义 |
| --- | --- |
| `origin_project` | 需求或 bug 最先出现的项目 |
| `requirement_owner` | 持有正式 `ANL-SOURCE / BLP/REQ / Handoff Snapshot` 的项目 |
| `lead_project` | 本轮首先实施的项目 |
| `lead_responsibilities` | lead 不在 `targets` 时先执行的责任；默认一个 development 写任务 |
| `reference_implementation` | 验证通过后可复用的 commit/snapshot；初始必须 `null` |
| `targets` | 本轮明确授权分析或同步的目标 |

字段细则见 [control-project.md](references/control-project.md)。

## 任务 ID 与 intake

- 标准任务必须有稳定 `task_id`，默认 `TASK-<delivery_id>`，也可在 delivery 上显式指定。
- `jj task scaffold` 写入 `.workflow/tasks/<TASK-ID>/task.json`（`delivery_id`、manifest 相对路径、创建时间）。
- 新会话拿到 `TASK-ID`：先读索引与 `task.md`，再读 manifest 实时状态；不得让用户重复提供需求正文、项目集合或历史状态。
- 任务文档是上下文引用；**控制面 manifest 才是状态真相源**。
- 首次接收需求必须先 intake。与 runtime 对齐的硬门禁字段：
  - `requirement_owner`
  - `origin_project`
  - `lead_project`
  - `targets`
  - `task_mode`（`standard` | `quick`）
  - intake 对象中的 `allow_multi_target`（boolean；docs/schema 要求确认是否允许多目标）
- 缺任一项或 `intake.status=REQUIRED`：只返回 `INTAKE_REQUIRED`（可带 `decision_required` 列表）。
- 默认 `task_mode=standard`：创建任何 Codex thread 前必须已有 `task.json`、`task.md`、`plan.md`、`progress.md`、`result.md`。仅用户明确 `quick` 可跳过完整任务目录。
- handoff / dispatch / reports / receipts 按任务 ID 分目录，禁止大量 JSON/Markdown 平铺根目录。

## 四个动作

轻量分配确认（不展示任务文档正文）：

```text
jj task assign --manifest .workflow/dispatch/<DELIVERY_ID>/control-plane.json \
  --delivery <DELIVERY_ID> --task <TASK-ID>
```

只输出主标题、任务 ID、`PREVIEW → APPROVE → DISPATCH → TICK` 与下一步命令。

### `PREVIEW`

默认只读动作。对应 runtime `previewDispatch`：

- intake 未完成：`action=PREVIEW`, `status=INTAKE_REQUIRED`，`tasks=[]`
- intake 完成：`action=PREVIEW`, `status=PREVIEW_ONLY`，展示角色映射、目标、task plans、依赖与阻塞项

不创建 thread，不写 `dispatch_intent`，不改目标项目，不把任务降级为 projectless。

### `DISPATCH`

仅在用户明确批准本轮任务集合后**尝试**执行。批准记录必须冻结本次 `task_keys` 与 approval tasks 快照；新增项目、责任或重试 attempt 后必须重新 `PREVIEW` 并批准。

**前置检查（全部通过才允许改 plane）：**

1. `approval.status=APPROVED`
2. 当前 task plans 的 `task_keys` / approval tasks 与批准快照完全一致
3. 本轮 lead/target 对应 project 均为 `active`
4. `REQUIRED_APP_CAPABILITIES` 全满足（见 [host-action-contract.json](references/host-action-contract.json)）：
   `list_projects`, `list_threads`, `create_thread`, `read_thread`, `send_message_to_thread`, `worktree`, `sandbox`

任一前置失败：

- 返回 DISPATCH 拒绝（`ok=false`, `status=BLOCKED`）
- **plane 不变**
- **不写** `dispatch_intent`
- **不** `create_thread`
- 能力缺失时附带 `missing_capabilities`；批准快照保留

前置通过后的执行序（与 runtime 一致）：

1. 为每个可派发 task 持久化 `dispatch_intent`（`status=PENDING_THREAD`）。同一 `task_key` 已存在则复用，禁止第二份 intent。
2. 依赖未完成：`WAITING_DEPENDENCY` / `deferred`，不提前建 thread。
3. 同项目多个 write responsibility 必须经 `depends_on` 串行；运行时同项目最多一个 active write；写任务用独占 worktree。
4. 产品 / 测试 / Review 默认只读，只消费已提交 commit。
5. host `CREATE_THREAD`；成功后立即 `BIND_THREAD`。
6. create 成功但绑定失败：intent → `UNKNOWN`；后续只能 `RECONCILE` 或人工 `BIND_THREAD`，禁止同 key 再 create。

稳定 `task_key`：`delivery_id / project_id / responsibility / attempt`。

每个 responsibility 必须声明 `phase`（`planning` | `development` | `verification` | `review`）、`attempt`（从 1）、`depends_on`。同一批准下再次 `DISPATCH` 只创建下一波未生成任务；改依赖或 attempt 必须重新预览批准。

### `RECONCILE`

恢复中断派发。仅唯一匹配 thread 可自动绑定；0 或多个候选 → 本次操作 `BLOCKED`，intent **保持** `UNKNOWN`，禁止盲重试。

确认 thread 不可找回：先把该 intent `UNKNOWN` → `BLOCKED`（原因 + evidence ref），再递增 responsibility `attempt`，重新 `PREVIEW`/批准；不得复用原 task key，不得直接再建同一 thread。

### `BIND_THREAD`

把已创建 Codex thread 绑到稳定 `task_key`。thread 停止、标题变化或回复“完成”都不是交付证据；必须消费结构化回执、commit、目标测试与 Review 结果。

绑定必须记录：`host_id`、`agent_name`、期望 `sandbox_mode`、实际 `effective_sandbox_mode`、`sandbox_evidence_ref`、`environment`、`bound_at`。TOML 默认配置不能证明 effective sandbox；拿不到 runtime attestation 必须拒绝绑定。`access=read` 只用 `jj-workflow-reviewer` / `read-only` / `project-read`，不得绑 worktree。

## Host 执行顺序

allowlist、required capabilities、access profile、receipt 枚举以 [host-action-contract.json](references/host-action-contract.json) 为准；runtime / schema / fixtures 与 skill 须经 `npm run harness:check` 对齐。当前 runtime 只允许输出 `CREATE_THREAD` 与 `RECONCILE_THREAD`。

1. `list_projects` 解析注册项目的 Codex `projectId`；路径、Git identity、`projectId` 分记。
2. 通过 DISPATCH 前置检查后，写入/复用 `dispatch_intents`。
3. `create_thread`（写责任带独占 worktree；只读责任消费已提交 commit）。
4. 立即 `BIND_THREAD`；写回失败 → `UNKNOWN`，禁止直接再 create。
5. `list_threads` / `read_thread` / `send_message_to_thread` 监控与补上下文；自然语言“完成”不能替代 receipt。
6. `jj dispatch-tick` 消费 receipt，按 `expected_revision` CAS，输出 `actions` / `decision_required` / `next_wait`；对仍为 `PENDING_THREAD` 的 intent 重放 `CREATE_THREAD`。`--write` 文件级 CAS；冲突 → `REVISION_CONFLICT` 且不覆盖。

### 分发载荷（非 host 步骤）

每条分发责任携带 `distribution_prompt`，至少含：`summary`、`source_project`、`source_head`、`handoff_ref`、`target_project`、`target_decision`、`acceptance_criteria`、`risk_points`、`do_not_port`、`unresolved`。Host action 把同一对象与 `initial_prompt` 传给子任务；子任务不得重问 control plane 已确认的源需求、目标或风险。

### 业务门禁（非 host 步骤）

- 每个 target 开发前必须有已批准 `ANL-TARGET`、`difference_ref`、`knowledge_refs` 与 `DIRECT/ADAPT/SYNC/NO_CHANGE_REQUIRED/BLOCKED` 决策；未就绪目标只进 `decision_required`，不阻塞其它已就绪目标。
- 推荐责任序：产品/需求澄清 → lead development → 各目标 development → test → review。调度器确认上一责任结构化证据后再派下一责任；子会话不得自派生任务。
- Review 闭环：`PASS` 或 `NEEDS_CHANGES`；finding 记 `id/severity/file/line/description/status/acceptance`。`NEEDS_CHANGES` → `requestRework`；旧下游 `PENDING_THREAD/BOUND/UNKNOWN` 须先完成或阻塞，再统一递增 developer / 下游验证 / 下次 review 的 `attempt`，清空批准快照并重新 `PREVIEW`。下次 `PASS` 须把上一轮 OPEN finding 标 `RESOLVED` 或 `WAIVED`。目标 `VERIFIED` 前须有 terminal writer 当前 Review PASS，且与 terminal writer `produced_commit` 和目标 commit 完全一致。字段细则见 [control-project.md](references/control-project.md)。
- 子任务回执形状见 [task-receipt.schema.json](references/task-receipt.schema.json)。调度器消费回执后才推进目标状态、reference 或 checkpoint。

## 状态语义（勿混写）

| 符号 | 层级 | 含义 |
| --- | --- | --- |
| `INTAKE_REQUIRED` | preview 动作结果 | intake 未完成；`tasks=[]` |
| `PREVIEW_ONLY` | preview 动作结果 / delivery 常见态 | 只读预览；未创建 thread |
| `APPROVED` | delivery | 已冻结本轮 task_keys |
| `BLOCKED`（DISPATCH 动作） | 动作结果 | 本轮派发拒绝；**常不改 plane**（如缺 capability） |
| `BLOCKED`（delivery/intent） | 持久状态 | 失败收口、不可恢复 thread 等 |
| `UNKNOWN` | intent | create 成功但绑定失败；只能 RECONCILE/人工 BIND |
| `PENDING_THREAD` | intent | 已落 intent，等待/重放 create |
| `VERIFIED` / `NO_CHANGE_REQUIRED` | 目标成功回执 | 见门禁 |

推荐 delivery 状态链：

```text
DRAFT -> PREVIEW_ONLY -> APPROVED -> DISPATCHING -> RUNNING
       -> EVIDENCE_READY -> VERIFIED
任何阶段可进入 delivery BLOCKED；绑定异常 intent -> UNKNOWN -> RECONCILE
```

不要把 reason 文案里的 `PREVIEW_ONLY/BLOCKED` 当成单一枚举值。

## 委派规则

调度智能体只负责拆解、分配、汇总。实际工作交给：

- `$jj-same`：handoff/sync checkpoint 上的同源迁移、差异适配与持续同步
- 目标项目内开发 / `$quality-review` / 测试角色：消费已提交 artifact，返回结构化证据

子会话不得自建可见任务、改 control manifest 或扩大目标集合。同项目同时最多一个 active write task。

## 结果门禁

- `reference_implementation` 初始必须 `null`。仅 lead 或已授权目标 commit 稳定，且有 `PASS` 验证证据、snapshot 引用与 hash 后才可设置；不能因基线/lead 自动成为 reference。
- 任一目标失败：保留其原同步 checkpoint，不推进整个项目族基线。
- 源项目完成并验证后：默认只生成推荐下一步，不自动扩大目标集合。推荐须逐项目列 `DIRECT / ADAPT / BLOCKED`、source/target HEAD、风险、confidence、`handoff_ref`、可携带 `distribution_prompt`。用户选择后重新 PREVIEW + APPROVE；禁止复用旧 approval 或静默建目标 thread。
- 目标回执：`VERIFIED` 或 `NO_CHANGE_REQUIRED`。
  - `VERIFIED`：terminal writer 当前 Review PASS 的新 commit、source head、验证证据。
  - `NO_CHANGE_REQUIRED`：planning/analysis 的 `ANL-TARGET`、`difference_ref`、目标 HEAD、`unresolved=[]`；未派发 development/verification/review 标 `SKIPPED`；不伪造 Developer commit / VRF / Review。
- 同步目标两种成功态都须 `FRESH` handoff、snapshot ref/hash、source/target branch 与 HEAD、差异决策引用；缺字段或 `STALE` 不得推进 checkpoint。

## CLI 命令矩阵

| 目的 | 命令 |
| --- | --- |
| 生成任务目录 | `jj task scaffold --manifest ... --delivery ...` |
| 恢复最小上下文 | `jj task context --task TASK-ID` |
| 结构化状态 | `jj task status --task TASK-ID --json` |
| 轻量分配确认 | `jj task assign --manifest ... --delivery ... --task ...` |
| 消费回执推进 | `jj dispatch-tick`（写盘加 `--write`） |
| 契约一致性 | `npm run harness:check` |

## References 何时读

| 文件 | 何时读 |
| --- | --- |
| [control-project.md](references/control-project.md) | 建控制项目、写 delivery/responsibility、恢复 UNKNOWN、Reviewer/Developer 闭环字段 |
| [control-plane.schema.json](references/control-plane.schema.json) | 写/改 `control-plane.json` 前；按下列键检索，勿整文件默读 |
| [host-action-contract.json](references/host-action-contract.json) | DISPATCH 前置 capability 与 host actions 前 |
| [host-action-contract.schema.json](references/host-action-contract.schema.json) | 校验 host contract 本身 |
| [task-receipt.schema.json](references/task-receipt.schema.json) | 消费子任务/review 回执前 |

`control-plane.schema.json` 常用检索键：`intake`、`approval`、`dispatch_intents`、`responsibilities`、`reviews`、`reference_implementation`、`checkpoint`、`task_mode`。

控制项目最小持久化：`control-plane.json`（唯一权威状态，`revision` 单调递增；MVP 可含 `events`）、可选导出 `events.ndjson`（非第二真相）、`README.md`（注册/批准/恢复说明）。

## 与 `jj-same` 的关系

`$jj-dispatch` 是跨项目控制平面，不是同步实现器。可把已批准目标交给 `$jj-same`，但目标分析、差异适配、验证与 sync checkpoint 仍由 `jj-same` 负责。旧调用 `源=A 目标=B,C` 兼容映射为 `origin=A、requirement_owner=A、lead=A、reference_implementation=null、targets=[B,C]`；仅当已有稳定 commit、snapshot 与 PASS 验证证据时才 materialize 完整 reference。新建控制项目优先显式动态角色。

## 明确不做

- 不实现常驻 daemon、数据库或完整多智能体执行引擎
- 不自动 checkout、merge、push、release
- 不因 thread 停止或模型文字回复推进检查点
- 不新增 Claude `/jj-dispatch`；首版只提供 Codex 调度入口
- 不把控制项目变成业务源项目；业务产物仍归属实际 `requirement_owner` 或目标项目
- 不在 capability 失败时伪造 host API、写 intent 或“降级为 projectless 任务”
