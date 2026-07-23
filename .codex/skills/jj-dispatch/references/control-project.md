# 控制项目约定

控制项目是独立、可版本化的目录。不要求业务源码；职责是保存跨项目协调状态。

动作语义与门禁优先级见上级 [SKILL.md](../SKILL.md)。本文件是字段、目录、恢复与闭环细则源。权威状态机实现：`src/dispatchControlPlane.mjs`。

## 何时读

- 注册/更新 projects
- 写 delivery / responsibility / intake
- 处理 `UNKNOWN` / rework / checkpoint 字段
- 校验 intent 绑定元数据

## 注册项目

每个项目至少登记：

| 字段 | 含义 |
| --- | --- |
| `id` | 控制平面内稳定且不含 `/` 的项目标识 |
| `name` | 人类可读名称 |
| `path` | 本机仓库绝对路径或稳定路径引用 |
| `codex_project_id` | 可选 Codex App host project 绑定；不等同 Git identity |
| `status` | `active`、`paused` 或 `retired` |

控制项目自身放在 `control_project`，也可出现在 `projects` 列表，但不得默认当作业务目标。DISPATCH 时 lead/target 必须为 `active`。

## 建议目录

```text
control-project/
  README.md
  control-plane.json
  events.ndjson
  .workflow/
    tasks/<TASK-ID>/
      task.json
      task.md
      plan.md
      progress.md
      result.md
    dispatch/<DELIVERY_ID>/
      ...
```

- `control-plane.json`：当前状态唯一真相源；`revision` 每次状态变化递增。
- MVP 的 `events` 审计数组可随 manifest 保存；host 可镜像到 `events.ndjson`，但不得成为第二份手工状态。
- handoff、dispatch、reports、receipts 必须按任务 ID / delivery 分目录。

## Intake 与 Delivery

Delivery 只保存需求与交接引用（`request_ref`、`ANL-SOURCE`、`BLP/REQ`、`handoff_ref`、验证 artifact）。不要复制 PRD 正文、源码 diff 或目标验证正文。

每个 delivery 必须显式保存：

- `origin_project`
- `requirement_owner`
- `lead_project`
- `lead_responsibilities`
- `targets`
- `task_mode`（`standard` | `quick`）

intake 对象（`intake.status=REQUIRED` 时不可 PREVIEW 推进/批准）：

- 上述角色字段
- `allow_multi_target`（boolean）
- `task_mode`

规则：

- lead 不在 targets：默认生成一个 development 写任务到 `lead_responsibilities`
- lead 已在 targets：使用该 target 的 responsibilities
- `reference_implementation` 首轮为 `null`；验证通过后才写入项目、commit、snapshot ref/hash、验证证据 ref

每个 target 通过 `responsibilities` 列出角色任务。同一项目可有多个 `access=write` 责任，但必须经 `depends_on` 形成单一串行链；运行时同项目最多一个 active write。产品、测试、Review 使用 `access=read`。批准记录保存当前完整 `task_keys` 与 approval tasks；目标或责任变化后旧批准失效。

每条 responsibility 至少包含：

```json
{
  "name": "test",
  "access": "read",
  "phase": "verification",
  "attempt": 1,
  "depends_on": [],
  "status": "PENDING"
}
```

- `depends_on` 使用同一 delivery 内完整 `task_key`
- 依赖未完成：任务 `deferred`，不建 thread
- 重试：递增 `attempt` 并重新 `PREVIEW`/批准
- 旧 attempt 的迟到回执不得推进新 attempt

## 恢复规则

1. `PREVIEW` 不写 `dispatch_intent`，不 create thread。
2. `DISPATCH` 前置：批准快照一致、project `active`、`REQUIRED_APP_CAPABILITIES` 齐全。
3. **capability / 快照 / inactive project 失败：plane 不变，不写 intent，不 create。** 动作结果为拒绝（`BLOCKED`），不等于必须改写 delivery 状态。
4. 仅前置通过后才写 `dispatch_intents`（`PENDING_THREAD`），再调用 host create。
5. create 成功但绑定写入失败：intent → `UNKNOWN`。
6. `RECONCILE` 仅唯一候选 thread 可自动绑定；否则本次 `BLOCKED`，intent 保持 `UNKNOWN`。
7. 确认 thread 无法找回：`UNKNOWN` → `BLOCKED`（记原因），递增 `attempt`，重新 `PREVIEW`/批准；不得复用原 task key。
8. 目标失败只更新该目标状态，不推进其 checkpoint，也不替其它目标宣告完成。

### 成功回执与 checkpoint

| 状态 | 要求 |
| --- | --- |
| `VERIFIED` | 完成当前 attempt 责任；terminal writer 持久 Review PASS；目标 commit == reviewed commit |
| `NO_CHANGE_REQUIRED` | analysis 产出 `ANL-TARGET`；`difference_ref`、目标 HEAD、`unresolved=[]`；未派发 development/verification/review 标 `SKIPPED`；不伪造 Developer commit/VRF/Review |

存在 `sync_key` 或 `handoff_ref` 时，成功 checkpoint 还必须保存：

- freshness = `FRESH`
- handoff ref、snapshot ref/hash
- source branch/HEAD、target branch/HEAD
- 差异决策 ref、验证 evidence

额外：

- `VERIFIED` 必须保存 reviewed commit
- `NO_CHANGE_REQUIRED` 的 `commit` 与 `reviewed_commit` 必须为 `null`
- 旧 checkpoint 不能补齐本轮缺失字段
- `STALE`、字段缺失或 handoff 不一致 → 保持阻塞

完整字段约束见 [control-plane.schema.json](control-plane.schema.json)。

## Reviewer / Developer 闭环

绑定后的 intent 还必须记录：

- `host_id`、`agent_name`
- 期望 `sandbox_mode`、实际 `effective_sandbox_mode`、`sandbox_evidence_ref`
- `environment`、`bound_at`

TOML 默认配置不能替代 runtime sandbox attestation；无 attestation 拒绝绑定。

| access | agent | sandbox | environment | worktree |
| --- | --- | --- | --- | --- |
| read | `jj-workflow-reviewer` | `read-only` | `project-read` | 禁止 |
| write | `jj-workflow-developer` | `workspace-write` | `exclusive-worktree` | 独占 worktree |

Review 回执写入 `delivery.reviews`：

- 结果只能是 `PASS` 或 `NEEDS_CHANGES`
- finding：`id`、`severity`、`file`、正整数 `line`、`description`、`status`、`acceptance`
- `delivery.reviews` 与对应 `intent.result.review` 必须一致
- `NEEDS_CHANGES`：先收口仍 active 的旧下游，再 `requestRework` 递增 developer 与下游 attempt 并重新批准
- 下一轮 `PASS` 必须 `RESOLVED` 或 `WAIVED` 旧 OPEN finding

回执形状见 [task-receipt.schema.json](task-receipt.schema.json)。host allowlist 见 [host-action-contract.json](host-action-contract.json)；契约 schema 见 [host-action-contract.schema.json](host-action-contract.schema.json)。

## Schema 检索键

读 [control-plane.schema.json](control-plane.schema.json) 时按需检索，勿整文件默读：

| 键 | 用途 |
| --- | --- |
| `intake` | intake 门禁与 multi-target / task_mode |
| `approval` | 批准快照与 task_keys |
| `dispatch_intents` | intent 生命周期与绑定元数据 |
| `responsibilities` | phase / attempt / depends_on |
| `reviews` | PASS/NEEDS_CHANGES 与 findings |
| `reference_implementation` | 可复用实现物 |
| `checkpoint` | 同步检查点与 freshness |
| `task_mode` | quick/standard |

| 文件 | 用途 |
| --- | --- |
| [control-plane.schema.json](control-plane.schema.json) | manifest 字段约束 |
| [task-receipt.schema.json](task-receipt.schema.json) | 子任务与 review 回执 |
| [host-action-contract.json](host-action-contract.json) | capability 与 access profile 真值 |
| [host-action-contract.schema.json](host-action-contract.schema.json) | host contract schema |
