# 控制项目约定

## 目录与配置（用户可指定）

调度**不强制**本机有 `D:/a`。产品默认状态在用户主目录；有项目族时用配置指到 portfolio。

| 概念 | 含义 | 配置 |
| --- | --- | --- |
| **配置文件** | 全局命名与目录 SSOT | `$JJ_GLOBAL_CONFIG_DIR/naming.json`（Windows 未设 env 时默认识别 `D:/a/config/naming.json`） |
| **portfolio 根** | 业务仓 / map / knowledge 所在顶层树 | `dispatch.portfolio_root` 或 `JJ_PORTFOLIO_ROOT`（例：`D:/a`） |
| **受控项目** | portfolio 下业务仓，见 `project_map` | `project_map` / `JJ_PROJECT_MAP` |
| **发起 cwd** | 业务仓会话里 `$jj-dispatch` | 不要求是 control 目录 |
| **dispatch 状态根** | 只存 manifest / task / receipt（**不是**业务工作仓） | **`dispatch.control_root` 默认 `~/.jj-flow`**；可改为如 `D:/a/dispatch-control` |
| **知识库** | Portfolio KB | `dispatch.knowledge_root` / `PORTFOLIO_KB_ROOT`（默认可推 `{portfolio_root}/knowledge`） |
| **一波 delivery** | 状态根下 `.workflow/dispatch/<DELIVERY_ID>/` | 不是每波新建控制 git 仓 |

用户在承接或兑接里发起调度是一等路径；Agent 把协调状态写入**解析后的 control_root**（`jj doctor` 可核对）。

### `naming.json` 示例（本机 portfolio）

```json
{
  "schema_version": "jj-flow/naming/1.0",
  "project_map": "D:/a/map.md",
  "dispatch": {
    "portfolio_root": "D:/a",
    "control_root": "D:/a/dispatch-control",
    "knowledge_root": "D:/a/knowledge"
  }
}
```

动作语义与门禁优先级见上级 [SKILL.md](../SKILL.md)。本文件是字段、目录、恢复与闭环细则源。权威状态机实现：`src/dispatchControlPlane.mjs`；解析实现：`src/namingConfig.mjs`。

## dispatch 状态根（落盘，用户通常不打开）

| 项 | 值 |
| --- | --- |
| **产品默认** | **`~/.jj-flow`**（用户主目录，不存在则创建） |
| **配置项** | `naming.json` → `dispatch.control_root` |
| 本机可选覆盖 | 如 `D:/a/dispatch-control`（须写进 naming.json 或 env） |
| 环境覆盖 | `JJ_DISPATCH_CONTROL_ROOT` |
| CLI 覆盖 | `--control-root` / `--manifest` |
| 解析 / 创建 | `resolveDispatchControlRoot()` / `ensureDispatchControlRoot()` |
| 诊断 | `jj doctor` → `paths.control_root` |

## 何时读

- 解析 control 根 / 注册 projects
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
# 产品默认 control_root（所有用户，无配置时）
~/.jj-flow/
  .workflow/dispatch/<DELIVERY_ID>/control-plane.json
  .workflow/tasks/TASK-<DELIVERY_ID>/

# 可选 portfolio（须 naming.json 配置 portfolio_root / control_root 等）
D:/a/
  config/naming.json
  map.md
  knowledge/
  cj-web/   # 业务仓 cwd 发起
  dispatch-control/   # 若 control_root 指到这里
```

- **一波 delivery = 一个 `delivery_id` 目录**。
- 本波 `control-plane.json`：该 delivery 状态唯一真相源。
- Agent / CLI 首次写入前 `ensureDispatchControlRoot()`（默认 `~/.jj-flow` 或配置路径）。

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
| `VERIFIED` | 完成当前 attempt 责任；terminal writer 持久 Review PASS；目标 commit == reviewed commit == development `produced_commit` |
| `NO_CHANGE_REQUIRED` | analysis 产出 `ANL-TARGET`；`difference_ref`、目标 HEAD、`unresolved=[]`；未派发 development/verification/review 标 `SKIPPED`；不伪造 Developer commit/VRF/Review |
| `EVIDENCE_READY` | 工作区或 artifact 已有证据但 **尚不满足 VERIFIED**（常见：未 commit、review 未对照 sha）；**用户说「已合并」也不能跳过证据直接升 VERIFIED** |

#### Agent 手写 plane（用户不跑 CLI）

用户不操作 control 根、不跑 `dispatch-tick`。Agent 直接改 `control-plane.json` 时：

1. **状态天花板**：无 `produced_commit` → 禁止 target/delivery `VERIFIED`；最多 `EVIDENCE_READY`。
2. **git 自取 sha**：`git rev-parse` / `log -1` 写入 intent 与 checkpoint，不问用户要 commit。
3. **真 session**：Grok 用当前真实 session id；可同会话多目标共享；禁止 `session-<slug>-YYYYMMDD`。
4. **合 integration**：优先 task-scoped commit cherry-pick；整支 feature merge 前确认 tip 不含会冲掉其它功能的 revert/历史（负例：承兑人标签整支合 dev 冲掉 aliyun tracker）。
5. 可选自检：`node .codex/skills/jj-dispatch/scripts/plane-self-check.mjs --manifest <plane.json>`（给 Agent，不给用户手册）。

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

- `host_id`（已批准：`codex-app` | `grok-build`；试验宿主可用其它 id）、`agent_name`
- `handle_kind`（`thread` | `session`；Grok 必须 `session`，值写入 `thread_id` 字段）
- 期望 `sandbox_mode`、实际 `effective_sandbox_mode`、`sandbox_evidence_ref`
- `environment`、`bound_at`

TOML 默认配置不能替代 runtime sandbox attestation；无 attestation 拒绝绑定。

| access | agent | sandbox | environment | workspace (`worktree` 字段) |
| --- | --- | --- | --- | --- |
| read | `jj-workflow-reviewer` | `read-only` | `project-read` | 禁止（必须 null） |
| write（默认） | `jj-workflow-developer` | `workspace-write` | `project-branch` | 项目主路径 + **命名 feature 分支**（与 same 一致） |
| write（隔离） | 同上 | 同上 | `exclusive-worktree` | 独占 worktree，**必须挂名分支 tip**；禁止静默 detached 开干 |

**workspace 选择（EP-20260730 负例：detached worktree → 用户「合到当前分支」）**

1. 默认 `project-branch`：任务指定分支已存在且可在 `project.path` 检出/已检出 → 直接绑主工作区。  
2. 仅当「同项目已有 active write」「主仓无关脏改动不可污染」「用户显式要求隔离」→ `exclusive-worktree`。  
3. 落地规则：代码事实必须在**命名分支 tip**；不得只在 detached 树留活补丁。

**不确定则先问再 DISPATCH（硬规程）**

- PREVIEW / 批准后、CREATE 前：对每个 write 目标输出判断表（intended_branch、current_branch、dirty、proposed_mode、confidence）。
- `confidence=low` 或事实冲突 → `NEEDS_CONFIRM`：展示判断、询问用户；**确认前不写 intent、不 create_thread**。
- 用户可改 branch 或 mode；改后以用户为准。
- 禁止静默选择 detached exclusive worktree 或静默切到非任务分支。

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
