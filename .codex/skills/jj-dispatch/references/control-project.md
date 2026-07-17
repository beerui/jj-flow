# 控制项目约定

控制项目是一个独立的、可版本化的项目目录。它不要求有业务源码，职责是保存跨项目协调状态。

## 注册项目

每个项目至少登记：

| 字段 | 含义 |
| --- | --- |
| `id` | 控制平面内稳定且不含 `/` 的项目标识 |
| `name` | 人类可读名称 |
| `path` | 本机仓库绝对路径或稳定路径引用 |
| `codex_project_id` | 可选的 Codex App host project 绑定，不等同于 Git identity |
| `status` | `active`、`paused` 或 `retired` |

控制项目自身单独放在 `control_project`，通常也可以出现在 `projects` 列表中，但不能把它默认为业务目标。

## 建议目录

```text
control-project/
  README.md
  control-plane.json
  events.ndjson
```

`control-plane.json` 是当前状态唯一真相源；`revision` 每次状态变化递增。MVP 的 `events` 审计数组可以随 manifest 保存；host 也可以把新增事件镜像到 `events.ndjson`，但不能与 manifest 并列成为另一份手工维护的状态。

## Delivery 记录

Delivery 只保存需求和交接的引用，例如 `request_ref`、`ANL-SOURCE`、`BLP/REQ`、`handoff_ref` 和验证 artifact。不要复制 PRD 正文、源码 diff 或目标验证正文。

每个 delivery 必须显式保存 `origin_project`、`requirement_owner`、`lead_project`、`lead_responsibilities` 和 `targets`。当 lead 不在 targets 中时，`lead_responsibilities` 默认生成一个 development 写任务；当 lead 已在 targets 中时，使用该 target 的 responsibilities。`reference_implementation` 在首轮为 `null`，验证通过后才写入项目、commit、snapshot ref、snapshot hash 和验证证据 ref。

每个 target 通过 `responsibilities` 列出要创建的角色任务。同一项目可以有多个 `access=write` 责任（例如 frontend/backend），但它们必须通过 `depends_on` 形成单一串行链；运行时同一项目最多一个 active write，产品、测试和 Review 使用 `access=read`。批准记录保存当前完整 `task_keys`，目标或责任变化后旧批准自动失效。

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

`depends_on` 使用同一 delivery 内的完整 `task_key`。依赖未完成时 `DISPATCH` 返回 `WAITING_DEPENDENCY`，任务留在 `deferred`，下一次 `DISPATCH` 才会尝试创建。重试通过递增 `attempt` 并重新 `PREVIEW`/批准；旧 attempt 的迟到回执不会推进新 attempt。

## 恢复规则

1. `PREVIEW` 不产生写入。
2. `DISPATCH` 前先写 `dispatch_intents`，然后才调用 Codex App host 创建 thread。
3. 创建成功但绑定写入失败时，把 intent 标记为 `UNKNOWN`。
4. `RECONCILE` 只有唯一候选 thread 才能自动绑定；否则本次操作返回 `BLOCKED`，intent 继续保持 `UNKNOWN` 并等待人工决定。
5. 确认 thread 无法找回时，将 `UNKNOWN` 显式标记为 `BLOCKED`，记录原因后递增责任的 `attempt`，重新 `PREVIEW`/批准；不得复用原 task key。
6. 目标失败只更新目标状态，不推进它的 checkpoint，也不替其它目标宣告完成。

目标成功回执可标为 `VERIFIED` 或 `NO_CHANGE_REQUIRED`。`VERIFIED` 必须完成当前 attempt 的责任任务，并有 downstream terminal writer 的持久 Review PASS；目标 commit 必须等于 terminal writer 的 reviewed commit。`NO_CHANGE_REQUIRED` 是分析路径：当前 planning/analysis responsibility 必须产出 `ANL-TARGET`，同时提供 `difference_ref`、目标 HEAD 和 `unresolved=[]`，并将未派发的 development/verification/review responsibility 标为 `SKIPPED`；它不要求或伪造 Developer commit、VRF 或 Review。

存在 `sync_key` 或 `handoff_ref` 时，成功 checkpoint 还必须保存 `FRESH` freshness、handoff ref、snapshot ref/hash、source branch/HEAD、target branch/HEAD、差异决策 ref 和验证 evidence；`VERIFIED` 还必须保存 reviewed commit，`NO_CHANGE_REQUIRED` 的 `commit` 与 `reviewed_commit` 必须为 `null`。旧 checkpoint 不能补齐本轮缺失字段，`STALE`、字段缺失或 handoff 不一致都保持阻塞。

完整字段约束见同目录的 JSON Schema。

### Reviewer / Developer 闭环

绑定后的 intent 还必须记录 host_id、agent_name、期望 sandbox_mode、实际 effective_sandbox_mode、sandbox_evidence_ref、environment 和 bound_at。Codex agent TOML 只是默认配置，不能替代 host 返回的 runtime sandbox attestation；拿不到 attestation 时必须拒绝绑定。只读任务固定使用 jj-workflow-reviewer、read-only、project-read，不能携带 worktree；写任务固定使用 jj-workflow-developer、workspace-write、exclusive-worktree 并绑定独占 worktree。

Review 回执保存到 `delivery.reviews`，必须是 `PASS` 或 `NEEDS_CHANGES`，并为每条 finding 保存 `id`、`severity`、`file`、正整数 `line`、`description`、`status` 和 `acceptance`。`delivery.reviews` 与对应 `intent.result.review` 必须一致。`NEEDS_CHANGES` 后先收口仍 active 的旧下游任务，再调用 `requestRework` 统一递增 developer 与下游责任的 attempt 并重新批准；下一轮 `PASS` 必须显式关闭或豁免旧 OPEN finding。
