---
name: jj-dispatch
description: 在业务仓发起多项目调度：PREVIEW→批准→DISPATCH→tick/resume。协调状态默认写入用户主目录 ~/.jj-flow（可配置）。跨项目派发、delivery、TASK-ID 恢复时使用。单仓闭环用 jj-ralph；迁移实现用 jj-same；单仓审查用 jj-review。
---

# jj-dispatch

跨项目调度入口。

## 目录配置（用户可改）

**产品默认调度状态根是 `~/.jj-flow`**，不是任何机器上的 `D:/a`。
项目族顶层（portfolio）、知识库、地图、调度状态**都是配置项**，写在全局 `naming.json` 或环境变量里。

### 配置文件在哪

| 项 | 值 |
| --- | --- |
| 配置目录 | `$JJ_GLOBAL_CONFIG_DIR` 或 `$DAJI_CONFIG_DIR`；未设时 Windows 默认识别 `D:/a/config` |
| 配置文件 | **`<configDir>/naming.json`**（例：`D:/a/config/naming.json`） |
| 查看当前解析 | `jj doctor`（打印 `control_root` / `portfolio_root` / `knowledge_root` / `project_map`） |

### 一等配置项（`naming.json`）

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

| 配置键 | 含义 | 产品默认 | 环境变量 |
| --- | --- | --- | --- |
| `dispatch.control_root` | 调度状态根（plane / task / receipt） | **`~/.jj-flow`** | `JJ_DISPATCH_CONTROL_ROOT` |
| `dispatch.portfolio_root` | 项目族顶层（业务仓所在树） | 无（null） | `JJ_PORTFOLIO_ROOT` |
| `dispatch.knowledge_root` | Portfolio KB | `{portfolio_root}/knowledge` 或无 | `PORTFOLIO_KB_ROOT` |
| `project_map` | 项目地图 | 无（可写绝对路径） | `JJ_PROJECT_MAP` |

CLI 也可单次覆盖：`--control-root <dir>`、`--manifest <plane.json>`。

### 发起 vs 落盘

| | **用户从哪发起** | **状态写到哪** |
| --- | --- | --- |
| 是什么 | **业务项目** 会话（承接/兑接/承载等） | 解析后的 **control_root**（不是用户 cwd） |
| 产品默认 | 任意业务仓 cwd | **`~/.jj-flow`** |
| 本机 portfolio 例 | `D:/a/cj-web` 等 | 仅当 `naming.json` 配置后如 `D:/a/dispatch-control` |
| 不要 | 要求用户先打开「控制项目」才能调度 | 每波 delivery 再建一个控制仓 |

```text
# 产品默认（无 naming 覆盖）
~/.jj-flow/
  .workflow/dispatch/<DELIVERY_ID>/control-plane.json
  .workflow/tasks/TASK-<DELIVERY_ID>/

# 本机 portfolio 示例（须 naming.json 显式配置）
D:/a/
  map.md
  config/naming.json          ← 顶层配置 SSOT
  knowledge/                  ← knowledge_root
  cj-web/  dj-web/  …         ← 业务仓（发起 cwd）
  dispatch-control/           ← control_root（可选覆盖）
```

### 落盘解析顺序（control_root）

| 顺序 | 来源 |
| --- | --- |
| 1 | 显式 `--control-root` / `--manifest` |
| 2 | `JJ_DISPATCH_CONTROL_ROOT` |
| 3 | `naming.json` → `dispatch.control_root` |
| 4 | 产品默认 **`~/.jj-flow`** |

规则：

1. **默认永远是用户主目录 `~/.jj-flow`**。portfolio 布局（如 `D:/a`）只通过配置启用，不是全局硬编码默认。
2. 多波次 = 同一状态根下多个 `delivery_id`。
3. 首次写入前 `ensureDispatchControlRoot()`；CLI：`jj dispatch-tick --delivery …`、`jj task scaffold --delivery …` 会解析 control root。
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

5. 已批准，但缺 REQUIRED_APP_CAPABILITIES
   -> Codex App：DISPATCH 拒绝（ok=false, BLOCKED），plane 不变，不写 intent
   -> **Grok Build**：不因「无多 session create/list」整波假 BLOCKED；
      **降级 Mode S**（单会话串行 + project-branch），见 [grok-dispatch-execution.md](references/grok-dispatch-execution.md)
   -> 仍禁止伪造 capability 或合成 session 伪装 BOUND

6. 已批准，分支/workspace 已确认（或明确无疑义），且（Codex 能力齐 / 或 Grok Mode S 降级路径）通过
   -> DISPATCH：先持久化 intent(PENDING_THREAD)
   -> Codex：CREATE_THREAD → BIND_THREAD
   -> Grok：**默认 Mode S** — 绑定**当前真实 session id**（多 task_key 可共享）+ 写 attestation 文件；不强制多 session

7. 有 receipt 或需推进已绑定任务
   -> tick/resume（有 CLI 时用 jj dispatch-tick；**无 CLI 时 Agent 直接改 plane，但必须遵守「Agent 写 plane 硬门禁」**）

8. 要把 target/delivery 标成 VERIFIED（或 development 标 DONE）
   -> 先满足「终端态证据」清单（git commit / review / 真 session id）
   -> 不满足：最多写到 EVIDENCE_READY / RUNNING；禁止因用户说「好了/已合并」而写 VERIFIED
   -> **T-task-result-sync**：升 VERIFIED 的同一落盘动作内刷新 task 目录
      `result.md` / `progress.md`（状态、各 target commit、review 结论）；禁止 plane 已 VERIFIED 而 result 仍写 EVIDENCE_READY
```

有 `TASK-ID` 时先恢复索引与 manifest（有 CLI 用 `jj task context/status`；无 CLI 直接读 control_root 下 task 目录与 plane），再套用以上门禁。

## Agent 写 plane 硬门禁（用户不跑 CLI）

**前提：** 用户只说自然语言（分发 / 批准 / 提交 / 已合并）。Agent 自己落盘 `control-plane.json` 与 task 文档；**不得**要求用户执行 `jj dispatch-tick` 或任何 CLI 才能收口。

权威状态机仍以 `src/dispatchControlPlane.mjs` 为准。Agent 手写 plane 时等价于替 runtime 写盘，必须自检下列规则；**违反则禁止写盘，改报告阻塞原因。**

### A. 状态天花板

| 事实 | 允许的最高 status |
| --- | --- |
| 代码已改、未 commit | delivery/target ≤ `EVIDENCE_READY`；development result 可 `DONE` 但 **`produced_commit` 必须 null** 并在 progress 写明 dirty |
| 已有 feature commit，Review 未 PASS 或未对照 commit | ≤ `EVIDENCE_READY` / `RUNNING` |
| development 有 `produced_commit`（≥7 位 sha）且 Review PASS 且 reviewed == produced | target 才可 `VERIFIED` |
| 用户只说「好了 / 已合并 / ok」 | **不是**证据；先 `git` 核对 commit 是否在 intended 分支 / 是否进 integration，再决定是否升 `VERIFIED` |

禁止：

- 聊天收口直接把 delivery/target 写成 `VERIFIED`
- 空 `reviews`、空 findings、与 bind **同一时间戳**的假 Review PASS 充当门禁
- development `outcome=DONE` 且目标已 `VERIFIED` 但 `produced_commit` 仍为 null

### B. `produced_commit` 与 git（Agent 自取，不问用户要 sha）

写 development 完成或升 `VERIFIED` 前，对每个 write 目标：

1. `git -C <path> rev-parse HEAD` 与 `git log -1 --oneline`（intended feature 分支 tip）
2. 确认本任务改动已在 tip（或记录 task-scoped cherry-pick sha）
3. 写入 intent：`result.produced_commit = <full or ≥7 sha>`
4. target / checkpoint / last_result：`commit` 与 `reviewed_commit` **相同且非空**（`VERIFIED` 时）
5. 工作区仍 dirty 且 dirty 属于本任务 → 先 commit 或明确停在 `EVIDENCE_READY`，不得 `VERIFIED`

### C. session / thread 绑定（禁止合成 ID）

| Host | `thread_id` 必须是 |
| --- | --- |
| Grok Build | 真实 session id（形如 `019f…-…` 的宿主 id）；**禁止** `session-<slug>-YYYYMMDD` 等占位符 |
| Codex App | 真实 thread id |

**同会话实施（Grok 常见、合法）：** 宿主无法/未建多 session 时，调度 Agent 可在**当前会话**内改各目标仓，但：

1. 所有本波 intent 的 `thread_id` 填**当前真实 session id**（可相同）
2. `host_id=grok-build`，`handle_kind=session`
3. **C4：** 每个 **BOUND** intent（**含 review/read**）写 attestation **文件**  
   `{control_root}/.workflow/dispatch/<DEL>/attestations/<task_key_safe>.json`  
   `sandbox_evidence_ref` = 该相对路径。**禁止**仅用 `host:grok-build:session:…` 字符串（development 与 review 一视同仁）
4. progress 注明 `execution=same-session`；仍须按 A/B 填 commit 后才 `VERIFIED`
5. **禁止**为凑 4 个 task_key 伪造 4 个假 session

库辅助（jj-flow）：`writeGrokAttestation` / `attestationRelativePath`（`src/dispatchAttestation.mjs`）。

拿不到真实 handle → intent 保持 `PENDING_THREAD` 或只记 progress，**不要**写 `BOUND` 假绑定。

### D. 落盘前自检清单（每次改 plane 默念）

```text
[ ] intake / approval 与本轮 task_keys 一致
[ ] 写任务 environment=project-branch（或已确认的 exclusive-worktree）+ intended_branch
[ ] 无合成 thread_id
[ ] C4：每个 BOUND intent 的 sandbox_evidence_ref 指向 attestations/*.json（含 review）
[ ] 若 status≥EVIDENCE_READY：changed_files / summary 与 git diff 一致
[ ] 若 status=VERIFIED：produced_commit + commit + reviewed_commit 齐全且一致
[ ] 若 status=VERIFIED：task/result.md 与 progress.md 已同步（非仍写 EVIDENCE_READY）
[ ] lead∉targets 时：lead_responsibilities 有计划，或 reference_implementation 完整（commit+snapshot+verification）
[ ] C5：plane-self-check grade=ok 再宣称 VERIFIED；可 setIntegrityGrade
[ ] C6：push/merge 后 setRemoteCloseout；用户说「已合并」须 git 核对，不单靠聊天
[ ] 承载等多 feature 合 dev：优先 task-scoped cherry-pick（见 EP-S1 / acceptor-tag 负例）
```

可选（Agent 自跑，**不**教用户）：
`node .codex/skills/jj-dispatch/scripts/plane-self-check.mjs --manifest <control-plane.json> [--json]`
输出含 `integrity_grade`（C5）。非 0 退出则禁止宣称 VERIFIED。

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
5. 宿主能力：
   - **Codex App**：`REQUIRED_APP_CAPABILITIES` 全满足（见 [host-action-contract.json](references/host-action-contract.json)）
   - **Grok Build**：允许 **Mode S 降级**（无多 session create/list 不整波 BLOCKED）；仍须可写 control_root 与真实 session id

Codex 能力前置失败：

- 返回 DISPATCH 拒绝（`ok=false`, `status=BLOCKED`）
- **plane 不变**；**不写** `dispatch_intent`；**不** `create_thread`
- 附带 `missing_capabilities`；批准快照保留

前置通过后的执行序：

1. 为每个可派发 task 持久化 `dispatch_intent`（`status=PENDING_THREAD`）。同一 `task_key` 已存在则复用，禁止第二份 intent。
2. 依赖未完成：`WAITING_DEPENDENCY` / `deferred`，不提前建 thread。
3. 同项目多个 write responsibility 必须经 `depends_on` 串行；运行时同项目最多一个 active write。
4. **写任务 workspace（默认同 same）**：`environment=project-branch`，`worktree`=project.path。**禁止**默认 detached 独占 worktree。
5. **独占 worktree 仅 isolation**（Mode W）：命名分支 tip；禁止静默 detached。
6. 产品 / 测试 / Review 默认只读；`access=read` 禁止 worktree。
7. **Codex**：`CREATE_THREAD` → `BIND_THREAD`。**Grok Mode S**：绑定当前真实 session（多 task 可共享）+ attestation 文件；不强制多 session。
8. create 成功但绑定失败：intent → `UNKNOWN`；禁止同 key 再 create。

稳定 `task_key`：`delivery_id / project_id / responsibility / attempt`。

每个 responsibility 必须声明 `phase`（`planning` | `development` | `verification` | `review`）、`attempt`（从 1）、`depends_on`。同一批准下再次 `DISPATCH` 只创建下一波未生成任务；改依赖或 attempt 必须重新预览批准。

### `RECONCILE`

恢复中断派发。仅唯一匹配 thread 可自动绑定；0 或多个候选 → 本次操作 `BLOCKED`，intent **保持** `UNKNOWN`，禁止盲重试。

确认 thread 不可找回：先把该 intent `UNKNOWN` → `BLOCKED`（原因 + evidence ref），再递增 responsibility `attempt`，重新 `PREVIEW`/批准；不得复用原 task key，不得直接再建同一 thread。

### `BIND_THREAD`

把已创建宿主执行身份绑到稳定 `task_key`。handle 停止、标题变化或回复“完成”都不是交付证据；必须消费结构化回执、commit、目标测试与 Review 结果。

绑定必须记录：`host_id`、`handle_kind`（`thread` | `session`）、`agent_name`、期望 `sandbox_mode`、实际 `effective_sandbox_mode`、`sandbox_evidence_ref`、`environment`（write 默认 `project-branch`，隔离时 `exclusive-worktree`）、`bound_at`、写责任的 workspace 路径（`worktree` 字段：主仓 path 或独占 worktree path）。`thread_id` 字段存外部 handle 值（Codex thread 或 Grok session）。TOML / skill 默认配置不能证明 effective sandbox；拿不到 runtime attestation 必须拒绝绑定。`access=read` 只用 `jj-workflow-reviewer` / `read-only` / `project-read`，不得绑 worktree。

Grok 路径：`host_id=grok-build` 且 `handle_kind=session`；禁止用 semi-real host trial 或模型自述冒充 attestation；禁止合成 `session-<task>-日期` 占位 id（见「Agent 写 plane 硬门禁」C）。同会话实施时多个 task_key 可共享**同一个真实** session id。设计见仓库 `docs/design-docs/grok-host-adapter.md`。

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
  - `VERIFIED`：terminal writer 当前 Review PASS 的新 commit、source head、验证证据；**intent.`produced_commit` 与 target commit/reviewed_commit 一致**。用户不提供 sha 时 Agent 用 git 自取。无 commit → 停在 `EVIDENCE_READY`。
  - `NO_CHANGE_REQUIRED`：planning/analysis 的 `ANL-TARGET`、`difference_ref`、目标 HEAD、`unresolved=[]`；未派发 development/verification/review 标 `SKIPPED`；不伪造 Developer commit / VRF / Review。
- 同步目标两种成功态都须 `FRESH` handoff、snapshot ref/hash、source/target branch 与 HEAD、差异决策引用；缺字段或 `STALE` 不得推进 checkpoint。
- **用户自然语言不能单独推进 checkpoint**（含「已合并」「完成」「ok」）；只作为触发 Agent 去读 git / plane 的信号。
- **task 文档与 plane 同步（T-task-result-sync）**：把 delivery/target 标 `VERIFIED` 时，必须同批更新 `.workflow/tasks/<TASK-ID>/result.md` 与 `progress.md`：
  - `result.md`：状态=`VERIFIED`；表列各 target 的 commit / review PASS；不得保留过期的 `EVIDENCE_READY` 段作为当前态
  - `progress.md`：追加 VERIFIED 时间与 revision
  - plane 是 SSOT；task 文档是给人恢复用的镜像，**允许滞后即视为收口未完成**

## Grok 执行（host_id=grok-build）

**默认 Mode S**：一个 coordinator 会话串行完成各 `task_key`，workspace=`project-branch`。
完整规格：[grok-dispatch-execution.md](references/grok-dispatch-execution.md)。

| 问题 | 答案 |
| --- | --- |
| 协议是否多任务？ | 是（多 task_key） |
| 默认是否多 Grok session？ | **否**（Mode S）；Mode P 后置 |
| 是否必须用 Grok Workflow（Rhai）？ | **否**。Workflow 可并行只读/探索，**不能**推进 checkpoint |
| 用户是否跑 CLI？ | **否**。Agent 写 attestation/receipt/plane |

Grok DISPATCH 最小动作：

1. PREFLIGHT：源 `source_head` 已 commit；分支已确认。
2. **每个** intent（development **与** review）：`thread_id`=真实 session；写 `attestations/<task_key_safe>.json`（**C4**）；`sandbox_evidence_ref`=该文件路径。
3. 串行实施 → receipt → git `produced_commit`。
4. `plane-self-check` grade=ok（**C5**）且 C3 证据齐 → 才 `VERIFIED`。
5. 可选 `setRemoteCloseout`（**C6**：pushed/merged_to）；**不**因聊天「已 push」省略 git 核对。

## CLI 命令矩阵

| 目的 | 命令 |
| --- | --- |
| 查看解析后的目录 | `jj doctor`（含 control_root / portfolio_root / knowledge_root） |
| 生成任务目录 | `jj task scaffold --delivery …`（默认识别 control_root；或 `--manifest` / `--control-root`） |
| 恢复最小上下文 | `jj task context --task TASK-ID` |
| 结构化状态 | `jj task status --task TASK-ID --json` |
| 轻量分配确认 | `jj task assign --delivery … --task …` |
| 消费回执推进 | `jj dispatch-tick --delivery …`（可加 `--write`；**用户不跑**，Agent 可选） |
| plane 终端自检 | `node .codex/skills/jj-dispatch/scripts/plane-self-check.mjs --manifest …`（Agent） |
| 契约一致性 | `npm run harness:check` |

## 回退（rollback）

用户说「回退目标 / 撤销验收 / 假 VERIFIED / 停掉 task」时读 [rollback.md](references/rollback.md)。

| 意图 | 控制面动作 | 默认不做 |
| --- | --- | --- |
| 误标 VERIFIED / 要重做 | `reopenTarget`（Mode S 自动 prepareSoft；attempt++，清 approval） | 手改 status、自动 unmerge |
| Mode S 软 plane | `prepareModeSReopen` 或 reopen 内置 prepare | ad-hoc 归一化脚本 |
| 停掉进行中 intent | `blockDispatchIntent` | 删 events / 同 key 再 create |
| Review 返工 | `requestRework` | — |
| 丢不掉的 UNKNOWN | `abandonDispatchUnknown` | 盲再 create |
| 代码回滚 | **G-menu** + R4 `buildRollbackPrep`（只建议不执行） | Agent 默认 revert；自动 force-push |
| 正式关掉 delivery | `closeDelivery` → `BLOCKED` + `closeout` | 对仍 VERIFIED 直接 close |
| C4 attestation | BOUND 含 review 也写 `attestations/*.json` | 仅 `host:session:…` 字符串 |
| C5 grade | `gradePlaneTerminalIntegrity` / `setIntegrityGrade` | 聊天宣称 OK |
| C6 remote | `setRemoteCloseout`（不挡 VERIFIED） | 用 VERIFIED 冒充已 push |

未 push 且 tip 即本任务时 **Recommended = reset**；已 push/已合 dev 才倾向 revert。回退写 `events[]` + `revision++`。

## References 何时读

| 文件 | 何时读 |
| --- | --- |
| [control-project.md](references/control-project.md) | 解析 control 根、写 delivery/responsibility、恢复 UNKNOWN、Reviewer/Developer 闭环字段 |
| [rollback.md](references/rollback.md) | **回退 / reopen / 撤销验收 / 假 VERIFIED**；动作矩阵与负例 |
| [grok-dispatch-execution.md](references/grok-dispatch-execution.md) | **Grok 宿主**：Mode S/W/P、PREFLIGHT、attestation/receipt、与 Workflow 边界 |
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
- **不要求用户跑 CLI 才能 PREVIEW / 批准 / 收口**（CLI 仅 Agent 可选自检）
- 不实现常驻 daemon、数据库或完整多智能体执行引擎
- 不自动 checkout、merge、push、release（除非用户明确要求收工/提交类 skill）
- 不因 thread 停止或模型文字回复推进检查点
- 不手写 `VERIFIED` 却缺少 `produced_commit` / 真 session id
- 不合成 `session-…` 占位 thread 伪装 BOUND
- 不新增 Claude `/jj-dispatch`；调度入口以已安装 skill 与已批准 Host 为准（Codex App 或 Grok Build 等价路径）
- 不把 control 根当成业务源项目；业务产物仍归属 `requirement_owner` 或目标项目
- 不在 capability 失败时伪造 host API、写 intent 或“降级为 projectless 任务”
- 不把 skill 安装或半真实 `host:trial` 当作真实 Host 验收或 A2 升级
