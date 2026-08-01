# Grok Dispatch 执行流程（Mode S 默认）

> **状态**：Accepted for skill MVP（Mode S + agent artifacts）；Host Wave 2 / Mode P 仍 Proposed  
> **宿主**：`host_id=grok-build`，`handle_kind=session`  
> **SSOT 位置**：本文件（`.codex/skills/jj-dispatch/references/`）；`~/.grok/skills` 仅为 `install-skill` 副本  
> **关联**：`host-action-contract.json`、`docs/design-docs/grok-host-adapter.md`、C3 Agent 写 plane 硬门禁、  
> `docs/evaluations/2026-07-30-acceptor-tag-color-dispatch.md`

本文定义：**在 Grok Build 中如何执行 `$jj-dispatch` / `/jj-dispatch`**。  
控制面状态机不变；只规定 **Grok 宿主执行层 + skill 行为 + artifact 约定**。

---

## 0. 架构裁决（多会话？Workflow？）

| 问题 | 裁决 |
| --- | --- |
| 协议上是否「多任务」？ | **是**：多个 `task_key` / responsibility |
| Grok **默认执行**是否多 session？ | **否**。默认 **Mode S**：一个 coordinator 会话串行完成 |
| 是否必须用 Grok **Workflow（Rhai）**？ | **否**。Workflow 可做探索/并行只读，**不能**推进 control-plane checkpoint，不能替代 receipt |
| 何时多 session / Mode P？ | 吞吐不足且 RECONCILE/attestation 已落地后（Phase 2c）；**现在不做默认** |

```text
用户可见：业务仓自然语言 → PREVIEW → 批准 → 实施 → 提交/收工
Grok 默认执行：Mode S（单会话串行 + project-branch）
可选加速：Mode W（isolation worktree）| Mode P（多 session，后置）| Workflow（非真相源）
真相源：control_root 下 control-plane.json + attestations + receipts + git commit
```

**不要**为「看起来像多会话」伪造 `session-*-YYYYMMDD`。  
**不要**用 Workflow run 状态代替 delivery `revision` / `VERIFIED`。

---

## 1. 问题与负例

### 1.1 已完成

| 层 | 状态 |
| --- | --- |
| 控制面 schema / intake / approval / intent | 可用 |
| `host_id=grok-build` + `handle_kind=session` 契约 | Phase 1 |
| PREVIEW→批准→project-branch；C3 终端态门禁 | skill MVP |

### 1.2 缺口（本规格补）

| 缺口 | 危害 |
| --- | --- |
| 无标准 Mode 枚举 | 同会话 / worktree / 假多 session 混用 |
| 无 attestation / receipt 默认落盘 | tick 无输入；假 VERIFIED |
| 源未 commit 即 DISPATCH | 目标迁错/漏迁 |
| 无 merge 树风险提示 | Revert 分支整支合 dev 冲掉其它能力 |

### 1.3 真实负例（回归必留）

**EP-20260730 acceptor-tag-color（项目B→项目A/项目D）**

1. 源未 commit 即 PREVIEW/DISPATCH。  
2. 占位 `session-acceptor-tag-*-20260730`。  
3. coordinator 会话内直接改多仓（合理 MVP，但未写标准 receipt）。  
4. 项目C feature 含 Revert tracker 后整支 merge 进 `dev`，冲掉埋点。

升级目标：**防止 1–2 成默认；把 3 收成 Mode S；把 4 写入 land/merge 提示**。

---

## 2. 目标与非目标

### 目标

1. Grok 三种执行模式与选用规则（§3）。  
2. DISPATCH 后可重复的 bind / workspace / receipt / 推进步骤（**用户不跑 CLI**；Agent 落盘）。  
3. 默认 Mode S；W/P 后置。  
4. 可版本化 evidence；不伪造 Codex thread。  
5. 与 Codex 共用 control plane。

### 非目标

- 不实现 Grok 云端多租户调度。  
- 不自动 merge/push/release（`$jj-end` 或用户显式收工）。  
- 不把 subagent / Workflow run id 升为 delivery 级身份（除非 BIND 为唯一真实 session）。  
- 不因 skill 安装升 `max_unattended_level` / 关闭 Host Wave 2。  
- **不要求用户**执行 `jj dispatch-tick` 等 CLI。

---

## 3. 执行模式

```text
Mode S — Session Serial（默认，Grok MVP）
  一个 coordinator 会话串行完成各 task_key。
  handle = 真实 coordinator session id（多 task_key 可共享同一 id）。
  workspace = project-branch @ project.path。
  progress 标注 execution=same-session | execution_mode=S。

Mode W — Worktree Isolated
  exclusive-worktree，命名分支 tip，禁止静默 detached。
  仅：主仓无关脏、同项目 active write、用户要求隔离。

Mode P — Parallel Sessions（后置）
  每 write task_key 一个 child session（或可恢复 subagent）。
  仅当 Mode S 不足且 attestation/RECONCILE 已落地。
```

### 3.1 选用

| 条件 | 模式 |
| --- | --- |
| 默认 / 目标 ≤3 / 小 ADAPT | **S** |
| isolation | **W** |
| 大迁移且 S 超时（Phase 2c+） | **P** |
| 同 project 多 write | 禁止并行；`depends_on` 串行 |

### 3.2 与 Codex / Workflow

| 步骤 | Codex | Grok Mode S | Grok Workflow（可选） |
| --- | --- | --- | --- |
| create | CREATE_THREAD | 声明/绑定 **当前真实 session** | 可 spawn agent；**不**写 plane |
| bind | thread + sandbox att. | session_id + path/git att. 文件 | 无 BIND 资格 |
| work | worktree 偏隔离 | **project-branch 主仓** | 只读探索优先 |
| done | receipt | **receipt 文件 + produced_commit** | 输出须再由调度 Agent 写入 receipt |
| checkpoint | tick/CAS | Agent 改 plane（遵守 C3）或可选 CLI | **禁止** Workflow 直接改 VERIFIED |

> 默认 workspace：**project-branch**（与 jj-same 一致）；exclusive 仅 isolation。

### 3.3 Grok 能力不全时

契约 `REQUIRED_APP_CAPABILITIES` 按 Codex 字面在 Grok 上常不齐。

**Grok 规则（覆盖 skill 门禁 5 的绝对 BLOCKED）：**

- 无法多 session create/list → **进入 Mode S**，不得整波假 BLOCKED 停死。  
- 不得用占位 session 伪装 BOUND。  
- 真实 session id + attestation 文件 → 可 BIND（多 intent 共享同一 session id）。  
- 仍须 C3：无 `produced_commit` 不得 VERIFIED。

---

## 4. 端到端流程（升级后）

```text
INTAKE (CONFIRMED)
  → PREVIEW (+ 分支/workspace 表；Grok 标明 proposed Mode S|W)
  → USER APPROVE
  → PREFLIGHT（§5；失败不写 intent）
  → DISPATCH
       persist intents PENDING_THREAD
       Mode S: BIND 真实 session + 写 attestation 文件
       （不创建假 session；不强制 Mode P）
  → EXECUTE（同会话串行 project-branch）
       写代码 → 最小验证 → 写 receipt → git commit → produced_commit
  → 推进 plane（Agent 写盘遵守 C3；可选 plane-self-check / dispatch-tick）
  → VERIFIED 仅当 commit 级证据齐全
  → 收工 $jj-end（task-scoped land；注意 Revert 树风险）
```

### 4.1 distribution_prompt 额外

| 字段 | 要求 |
| --- | --- |
| `source_head` | **已 commit 的 SHA**；禁止仅 working tree 当真源 |
| `source_working_tree_note` | 若仍 dirty，写任务 DISPATCH **阻塞** |
| `execution_mode` | `S` \| `W` \| `P` |

### 4.2 BIND attestation（最小）

路径：

```text
{control_root}/.workflow/dispatch/{DELIVERY_ID}/attestations/{task_key_safe}.json
```

`task_key_safe`：把 `/` 换成 `__`。

```json
{
  "host_id": "grok-build",
  "handle_kind": "session",
  "session_id": "<real-grok-session-uuid>",
  "task_key": "DEL-…/project/development/1",
  "agent_name": "jj-workflow-developer",
  "execution_mode": "S",
  "sandbox_mode": "workspace-write",
  "effective_sandbox_mode": "workspace-write",
  "effective_boundary_source": "declared-coordinator",
  "environment": "project-branch",
  "worktree": "/portfolio/project-a",
  "intended_branch": "feat/…",
  "git_head_at_bind": "<sha|null>",
  "project_path": "/portfolio/project-a",
  "bound_at": "ISO-8601"
}
```

规则：

- `session_id` 必须是真实宿主 id（如 `019f…-…`），**禁止** `session-<slug>-YYYYMMDD`。  
- Mode S：`worktree == project_path`；多 task 可同一 `session_id`。  
- intent.`thread_id` = 该 `session_id`（不要用 `coordinator:…#task` 当唯一 handle）。  
- `sandbox_evidence_ref` 指向上述文件相对 control_root 的路径。  
- **C4：development *与* review/read 责任均写 attestation 文件**；禁止仅用 `host:grok-build:session:…` 字符串充当 review 的 `sandbox_evidence_ref`。  
- 缺关键字段 → 拒绝 BOUND。

read/review 示例与 write 相同路径规则；`sandbox_mode`/`agent_name` 按 access 填 `read-only` / `jj-workflow-reviewer`，`worktree` 可为 null。

### 4.3 Receipt

```text
{control_root}/.workflow/dispatch/{DELIVERY_ID}/receipts/{task_key_safe}.json
```

```json
{
  "schema_version": "jj-flow/task-receipt/1.0",
  "task_key": "...",
  "outcome": "DONE|FAILED|NO_CHANGE_REQUIRED",
  "produced_commit": "<sha|null>",
  "changed_files": ["..."],
  "branch": "feat/...",
  "evidence": ["diff|rg|lint"],
  "host_id": "grok-build",
  "session_id": "...",
  "execution_mode": "S",
  "finished_at": "ISO-8601"
}
```

自然语言「完成」不能推进 checkpoint。

---

## 5. PREFLIGHT（写 intent 前）

| # | 检查 | 失败 |
| --- | --- | --- |
| 1 | approval 与 task_keys 一致 | BLOCKED |
| 2 | project active，path/git 可解析 | BLOCKED |
| 3 | **源可迁写真相已 commit**（`source_head` 含修复） | BLOCKED（可 PREVIEW） |
| 4 | write：`intended_branch` 明确或 NEEDS_CONFIRM | 停问 |
| 5 | mode S/W 与 isolation 一致 | 停问/BLOCKED |
| 6 | 同 project 无第二 active write | BLOCKED |
| 7 | control_root 可写 attestation/receipt | BLOCKED |
| 8 | 无未处理 UNKNOWN intent | 仅 RECONCILE |

---

## 6. Skill 行为（Grok 立即生效）

1. **默认 Mode S**；不得无批准并行乱写多仓（串行 OK）。  
2. PREVIEW 含分支表 + `proposed_mode=S|W`。  
3. 源 MUST 改动未 commit → **不对 targets 写 DISPATCH**。  
4. intent：`host_id=grok-build`，`handle_kind=session`，`thread_id`=真实 session；**每个 BOUND intent（含 review）写 attestation 文件（C4）**。  
5. 实施后写 receipt；git 取 `produced_commit`；遵守 C3 再 VERIFIED。  
6. 用户不跑 CLI；Agent 可选用 `plane-self-check.mjs`（输出 `integrity_grade` C5）/ `dispatch-tick`。  
7. VERIFIED 后可选标注 `remote_closeout`（C6：pushed/merged_to；**不**挡 VERIFIED）。  
8. 收工 `$jj-end`；feature→integration **优先 task-scoped cherry-pick**；feature 历史含 Revert 删除的能力时必须提示树风险。  
9. **Grok Workflow**：仅辅助；完成报告须由调度 Agent 落入 receipt/plane。

---

## 7. 实现波次（jj-flow）

### Phase 2a — Mode S skill MVP（本提交目标）

| ID | 项 | 状态 |
| --- | --- | --- |
| G2A-1 | 本文件 + SKILL 入口 + openai.yaml Mode S | 本波 |
| G2A-2 | Agent 手写 attestation/receipt 路径约定 | 本波 |
| G2A-3 | PREFLIGHT 源 commit + 假 session 禁止（skill） | 本波 |
| G2A-4 | plane-self-check 合成 session / VERIFIED 无 commit | 已有 |
| G2A-5 | commands/jj-dispatch Grok Mode S 表述 | 本波 |
| G2A-6 | 可选 CLI bind/receipt（**非用户路径**） | 后置 |

### Phase 2b — Mode W

worktree create/bind/cleanup；landing 在命名分支 tip。

### Phase 2c — Mode P

child session 1:1；RECONCILE；禁同 project 并行 write。

### Phase 3 — 真实 Host 试跑

`docs/milestones/real-host-trial-grok.json`；NEEDS_CHANGES；Revert-remerge 警告用例。

---

## 8. 可选 CLI（Agent only，用户不跑）

```bash
# 仅 Agent 自检；用户不需要
node .codex/skills/jj-dispatch/scripts/plane-self-check.mjs --manifest <plane.json>
# 若已安装 jj 且要用 CAS：
jj dispatch-tick --delivery DEL-… --write
```

无 CLI 时 skill **必须** 手写等价 attestation/receipt/plane 字段。

---

## 9. 验收

### 9.1 Phase 2a Done

- [x] 本规格在 `.codex/skills` SSOT  
- [x] Grok 默认 Mode S 写入 SKILL / default_prompt  
- [ ] 下一波真实 Grok delivery：PREVIEW→批准→Mode S→receipt→真 produced_commit→VERIFIED 经 plane-self-check OK  
- [ ] uncommitted source 在实战被 BLOCKED  

### 9.2 失败条件

- 聊天状态替代 control-plane revision  
- 占位 session id  
- Workflow/subagent 直接标 VERIFIED  
- 同 project 无 depends_on 并行 write  

---

## 10. 决策日志

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-07-30 | Grok 默认 Mode S | 无成熟多 session API；实战小改已验证；与 same 一致 |
| 2026-07-30 | 多会话/Mode P 后置 | 假 BIND 风险 > 吞吐收益 |
| 2026-07-30 | Workflow 非 checkpoint 权威 | Rhai 运行时 ≠ 控制面 CAS |
| 2026-07-30 | 用户不跑 CLI | Agent 落盘 + 可选自检 |
| 2026-07-30 | project-branch 默认 | 避免 worktree transfer 负例 |
| 2026-07-30 | 源必须 commit | 分发真相漂移负例 |
