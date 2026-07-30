---
name: jj-dispatch
description: 在业务仓发起多项目调度：PREVIEW→批准→DISPATCH→tick/resume。协调状态默认写入用户主目录 ~/.jj-flow（可配置）。跨项目派发、delivery、TASK-ID 恢复时使用。单仓闭环用 jj-ralph；迁移实现用 jj-same；单仓审查用 jj-review。
---

# jj-dispatch

跨项目调度入口。

## 项目族顶层：`D:/a`

**顶层设计是 `D:/a` 目录**（portfolio 根）：其下是所有受控业务项目与基建，不是「先有一个控制 git 仓再调度」。

```text
D:/a/                          ← 项目族顶层（map / naming / 全部受控项目）
  map.md
  config/naming.json
  knowledge/                   ← Portfolio KB
  cj-web/  dj-web/  cz-broker-web/  …   ← 受控业务项目（用户日常 cwd）
  dispatch-control/            ← 仅调度状态落盘（可选子目录，用户通常不打开）
```

| | **用户从哪发起** | **状态写到哪** |
| --- | --- | --- |
| 是什么 | `D:/a` 下某个 **业务项目** 会话 | `D:/a` 下 **共用** 的 dispatch 状态目录 |
| 默认 | 如 `D:/a/cj-web`（承接）、`D:/a/dj-web`（兑接） | 默认 `D:/a/dispatch-control`（`naming.json` 可改） |
| 不要 | 要求用户先打开「控制项目」才能调度 | 每波 delivery 再建一个控制仓 |

### 发起（业务仓，一等路径）

1. 用户在 **承接 / 兑接 / 承载等业务仓** 直接 `$jj-dispatch` / `/jj-dispatch`（例：在承接做完需求后 PREVIEW 多端）。  
2. Agent 用 `D:/a/map.md` 把 cwd 解析成项目角色，推断 `origin` / lead 线索；仍须 intake 确认。  
3. **不要求** cwd 是 `dispatch-control`。

### 落盘（状态根解析）

| 顺序 | 来源 |
| --- | --- |
| 1 | 用户显式 `--manifest` / 路径 |
| 2 | `JJ_DISPATCH_CONTROL_ROOT` |
| 3 | `naming.json` → `dispatch.control_root`（**产品默认 `~/.jj-flow`**） |
| 4 | 仍无配置 → `~/.jj-flow`（用户主目录） |

```text
# 产品默认（所有用户）
~/.jj-flow/
  README.md
  .workflow/dispatch/<DELIVERY_ID>/control-plane.json
  .workflow/tasks/TASK-<DELIVERY_ID>/

# 可选：本机 portfolio 覆盖（例）
# naming.json: "dispatch": { "control_root": "D:/a/dispatch-control", "portfolio_root": "D:/a" }
```

规则：

1. **默认永远是用户主目录 `~/.jj-flow`**，不是 `D:/a`。`D:/a` 仅作本机 map/业务项目布局；若要把状态写到 `D:/a/dispatch-control`，须在 `naming.json` 显式配置。  
2. 多波次 = 同一状态根下多个 `delivery_id`。  
3. 首次写入前 `ensureDispatchControlRoot()`：解析 + 创建目录 + README。  
4. 业务代码只在业务仓 feature 分支。  

字段与目录细则见 [control-project.md](references/control-project.md)。

控制面权威实现是仓库 `src/dispatchControlPlane.mjs` 与 schema；本 skill 描述必须与其状态机一致，不得发明并行枚举。

## 用户主线 vs 门禁优先

用户可见 happy path：

```text
读取 TASK-ID 主标题 -> PREVIEW（含分支/workspace 判断）
  -> 用户批准 task_keys
  ->（若分支/workspace 仍不确定）展示判断并询问 -> 用户确认
  -> DISPATCH -> tick/resume
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

4. 写责任的目标分支 / workspace 模式不确定（见「分支与 workspace 确认」）
   -> 先输出自检判断表，向用户确认
   -> 用户确认前：不 DISPATCH、不 create_thread、不写 dispatch_intent
   -> 用户可改判 project-branch / exclusive-worktree / 目标分支名

5. 已批准，但缺 REQUIRED_APP_CAPABILITIES（或当前 Host 无法证明等价 capability）
   -> DISPATCH 拒绝（action=DISPATCH, ok=false, status=BLOCKED）
   -> plane 保持不变（delivery 可仍为 APPROVED）
   -> 不写 dispatch_intent；不 create_thread；不清空既有批准
   -> 返回 missing_capabilities

6. 已批准，分支/workspace 已确认（或明确无疑义），且 capability / snapshot / active project 检查通过
   -> DISPATCH：先持久化 intent(PENDING_THREAD)，再 host CREATE_THREAD，再 BIND_THREAD
   -> 已批准 Host 可为 Codex App（thread）或 Grok Build（session）；见 host-action-contract host_profiles

7. 有 receipt 或需推进已绑定任务
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
- **写任务额外展示**「分支与 workspace 判断表」（见下）；不确定项标 `NEEDS_CONFIRM`，不得假装已决

不创建 thread，不写 `dispatch_intent`，不改目标项目，不把任务降级为 projectless。

### 分支与 workspace 确认（写责任，DISPATCH 前）

对每个 **access=write** 的目标，Agent 必须先形成并展示自己的判断，**不确定则先问用户，确认后再 DISPATCH**。

| 列 | 内容 |
| --- | --- |
| project / path | 注册 path |
| intended_branch | 任务/领头派生/用户指定的 feature 分支 |
| current_branch @ path | `git branch --show-current`（主工作区） |
| dirty | 是否有**非本任务**脏改动 |
| active_write | 同项目是否已有 active write intent |
| proposed_mode | `project-branch`（默认）或 `exclusive-worktree` |
| confidence | `high` / `low` |
| action | `READY` 或 `NEEDS_CONFIRM` |

**何时必须停问（`NEEDS_CONFIRM`，禁止静默 DISPATCH）：**

- 目标分支名缺失、冲突或多解（含与 branch purpose 不一致）
- 主工作区当前分支 ≠ intended_branch，且无法安全快进到该分支
- 是否 isolation 拿不准（脏主仓是否「无关」、是否值得独占 worktree）
- 用户此前要求「合到当前分支」或曾发生 worktree transfer 纠错

**问法（只问决策，不拷问需求正文）：**

```text
我的判断：
- cz-broker-web: branch=feat/cz-0731-jmb, mode=project-branch, cwd=主仓 path, confidence=high|low
- 不确定点：…
请确认：是否按此分发？或指定 branch / mode=exclusive-worktree。
```

用户确认前：**不** `DISPATCH`、**不** `create_thread`、**不**写 `dispatch_intent`。  
用户改判后以用户为准；默认仍遵循 project-branch 规则（见 host-action-contract `workspace_mode_policy`）。

### `DISPATCH`

仅在用户明确批准本轮任务集合、且写责任分支/workspace **已确认或无疑义**后**尝试**执行。批准记录必须冻结本次 `task_keys` 与 approval tasks 快照；新增项目、责任或重试 attempt 后必须重新 `PREVIEW` 并批准。

**前置检查（全部通过才允许改 plane）：**

1. `approval.status=APPROVED`
2. 当前 task plans 的 `task_keys` / approval tasks 与批准快照完全一致
3. 本轮 lead/target 对应 project 均为 `active`
4. 写责任：intended_branch + workspace mode 已确认（或 PREVIEW 中均为 `READY`/`high` 且无冲突事实）
5. `REQUIRED_APP_CAPABILITIES` 全满足（见 [host-action-contract.json](references/host-action-contract.json)）：
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
3. 同项目多个 write responsibility 必须经 `depends_on` 串行；运行时同项目最多一个 active write。
4. **写任务 workspace（默认同 same）**：绑任务指定 **命名 feature 分支** 下的 **项目主工作区**（`environment=project-branch`，`worktree` 字段填 project.path）。**禁止**默认 detached 独占 worktree 再要求用户「合到当前分支」。
5. **独占 worktree 仅当 isolation 需要**：同项目已有 active write、主仓有无关脏改动且不可污染、或用户显式要求隔离 → `environment=exclusive-worktree`，且必须挂在**命名分支 tip**（禁止静默 detached 开干）；结束后代码事实须在命名分支 tip。
6. 产品 / 测试 / Review 默认只读，只消费已提交 commit；`access=read` 禁止 worktree。
7. host `CREATE_THREAD`；成功后立即 `BIND_THREAD`。
8. create 成功但绑定失败：intent → `UNKNOWN`；后续只能 `RECONCILE` 或人工 `BIND_THREAD`，禁止同 key 再 create。

稳定 `task_key`：`delivery_id / project_id / responsibility / attempt`。

每个 responsibility 必须声明 `phase`（`planning` | `development` | `verification` | `review`）、`attempt`（从 1）、`depends_on`。同一批准下再次 `DISPATCH` 只创建下一波未生成任务；改依赖或 attempt 必须重新预览批准。

### `RECONCILE`

恢复中断派发。仅唯一匹配 thread 可自动绑定；0 或多个候选 → 本次操作 `BLOCKED`，intent **保持** `UNKNOWN`，禁止盲重试。

确认 thread 不可找回：先把该 intent `UNKNOWN` → `BLOCKED`（原因 + evidence ref），再递增 responsibility `attempt`，重新 `PREVIEW`/批准；不得复用原 task key，不得直接再建同一 thread。

### `BIND_THREAD`

把已创建宿主执行身份绑到稳定 `task_key`。handle 停止、标题变化或回复“完成”都不是交付证据；必须消费结构化回执、commit、目标测试与 Review 结果。

绑定必须记录：`host_id`、`handle_kind`（`thread` | `session`）、`agent_name`、期望 `sandbox_mode`、实际 `effective_sandbox_mode`、`sandbox_evidence_ref`、`environment`（write 默认 `project-branch`，隔离时 `exclusive-worktree`）、`bound_at`、写责任的 workspace 路径（`worktree` 字段：主仓 path 或独占 worktree path）。`thread_id` 字段存外部 handle 值（Codex thread 或 Grok session）。TOML / skill 默认配置不能证明 effective sandbox；拿不到 runtime attestation 必须拒绝绑定。`access=read` 只用 `jj-workflow-reviewer` / `read-only` / `project-read`，不得绑 worktree。

Grok 路径：`host_id=grok-build` 且 `handle_kind=session`；禁止用 semi-real host trial 或模型自述冒充 attestation。设计见仓库 `docs/design-docs/grok-host-adapter.md`。

## Host 执行顺序

allowlist、required capabilities、access profile、receipt 枚举、`host_ids` / `handle_kinds` / `host_profiles` 以 [host-action-contract.json](references/host-action-contract.json) 为准；runtime / schema / fixtures 与 skill 须经 `npm run harness:check` 对齐。当前 runtime 只允许输出 `CREATE_THREAD` 与 `RECONCILE_THREAD`（按 `host_id` 分流实现，不伪造 Codex API）。

1. 解析状态根：`ensureDispatchControlRoot()`（默认 `~/.jj-flow`；可被 env / naming.json 覆盖）。
2. `list_projects` 解析注册项目（Codex `projectId` 或 map/path + git identity）；路径、Git identity、宿主项目标识分记。
3. 通过 DISPATCH 前置检查后，写入/复用 `dispatch_intents`（写入状态根下 `.workflow/dispatch/<DELIVERY_ID>/`）。
4. `create_thread`（语义：Codex 建 thread；Grok 为 task_key 声明/绑定 session）。写责任默认 project-branch workspace；仅 isolation 条件满足时独占 worktree；只读责任消费已提交 commit。
5. 立即 `BIND_THREAD`；写回失败 → `UNKNOWN`，禁止直接再 create。
6. `list_threads` / `read_thread` / `send_message_to_thread` 监控与补上下文（Grok 用 session 元数据 / 约定 artifact 等价证明）；自然语言“完成”不能替代 receipt。
7. `jj dispatch-tick` 消费 receipt，按 `expected_revision` CAS，输出 `actions` / `decision_required` / `next_wait`；对仍为 `PENDING_THREAD` 的 intent 重放 `CREATE_THREAD`。`--write` 文件级 CAS；冲突 → `REVISION_CONFLICT` 且不覆盖。

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
| [control-project.md](references/control-project.md) | 解析 control 根、写 delivery/responsibility、恢复 UNKNOWN、Reviewer/Developer 闭环字段 |
| [control-plane.schema.json](references/control-plane.schema.json) | 写/改 `control-plane.json` 前；按下列键检索，勿整文件默读 |
| [host-action-contract.json](references/host-action-contract.json) | DISPATCH 前置 capability 与 host actions 前 |
| [host-action-contract.schema.json](references/host-action-contract.schema.json) | 校验 host contract 本身 |
| [task-receipt.schema.json](references/task-receipt.schema.json) | 消费子任务/review 回执前 |

`control-plane.schema.json` 常用检索键：`intake`、`approval`、`dispatch_intents`、`responsibilities`、`reviews`、`reference_implementation`、`checkpoint`、`task_mode`。

control 根最小持久化：每波 `control-plane.json`（该 delivery 权威状态，`revision` 单调递增；MVP 可含 `events`）、可选 `events.ndjson`、`README.md`。

## 与 `jj-same` 的关系

`$jj-dispatch` 是跨项目控制平面，不是同步实现器。可把已批准目标交给 `$jj-same`，但目标分析、差异适配、验证与 sync checkpoint 仍由 `jj-same` 负责。旧调用 `源=A 目标=B,C` 兼容映射为 `origin=A、requirement_owner=A、lead=A、reference_implementation=null、targets=[B,C]`；仅当已有稳定 commit、snapshot 与 PASS 验证证据时才 materialize 完整 reference。优先显式动态角色；用户从业务仓发起时用 map 推断线索再 intake 确认。

## 明确不做

- 不要求用户先打开 control 根或每波新建控制仓才能调度
- 不实现常驻 daemon、数据库或完整多智能体执行引擎
- 不自动 checkout、merge、push、release
- 不因 thread 停止或模型文字回复推进检查点
- 不新增 Claude `/jj-dispatch`；调度入口以已安装 skill 与已批准 Host 为准（Codex App 或 Grok Build 等价路径）
- 不把 control 根当成业务源项目；业务产物仍归属 `requirement_owner` 或目标项目
- 不在 capability 失败时伪造 host API、写 intent 或“降级为 projectless 任务”
- 不把 skill 安装或半真实 `host:trial` 当作真实 Host 验收或 A2 升级
