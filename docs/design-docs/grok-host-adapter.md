# Grok Host Adapter（Wave 2 等价宿主路径）

> 状态：Proposed
>
> 范围注记：Wave 2 真 Host；**不是** Mode S 日常路径的完成态
>
> 范围：真 Host attestation / Wave 2。日常 Grok 分发 Mode S skill MVP 见
> [`.codex/skills/jj-dispatch/references/grok-dispatch-execution.md`](../../.codex/skills/jj-dispatch/references/grok-dispatch-execution.md)
> 与 [exec plan](../exec-plans/active/2026-07-30-grok-dispatch-execution.md)，**不**等同关闭本文验收。
>
> 与 [真实 Host 验收](../milestones/real-host-acceptance.html) 并列：任一已批准宿主路径达标即可评估 A2。
>
> 关联：
> - [真实 Host 验收（PENDING）](../milestones/real-host-acceptance.md)
> - [Agent Harness 设计](harness-engineering.html)
> - [Harness 收口计划（completed）](../exec-plans/completed/2026-07-18-harness-hardening.html)
> - ADR 0001 薄宿主边界；dispatch host-action-contract
>
> 实施边界：本文只定目标状态与验收门槛；**不** 因 skill 安装或 Mode S 日常可用而提升 `max_unattended_level`
>
> **默认 workspace 裁决（与 skill 对齐）**：Grok 写责任默认 **project-branch**（命名 feature + 主仓 path）；**exclusive-worktree 仅 isolation**。早期「必须独占 worktree」表述以本裁决与 skill 为准。

## 1. 摘要

jj-flow 的 Wave 2 要求：**真实宿主** 完成 create/bind、中断恢复、sandbox 证明与 Review 返工，且证据可版本化入库。当前 runtime 的 host action 契约以 **Codex App**（project / thread / sandbox attestation）为第一实现。

**Grok Host Adapter** 把 Grok Build 定义为 **可选的第二宿主**：在不伪造 Codex thread API 的前提下，用 Grok 的 session、worktree、权限与可观察执行边界，提供 **语义等价** 的绑定与 attestation，使 dispatch 闭环可在 Grok 日常环境中验收。

两条并行路径：

| 路径 | 宿主 | 任务身份载体 | 关闭 Wave 2 的资格 |
| --- | --- | --- | --- |
| A（现状） | Codex App | `thread_id` | 满足 `real-host-acceptance` |
| B（本文） | Grok Build | `session_id` + 可选 subagent id | 满足本文 + 同一里程碑的通用门槛 |

任一路径 **单独** 达到门槛即可评估 A2；**不得** 用半真实 `host:trial` 或「skill 已安装」关闭里程碑。

## 2. 问题与动机

### 2.1 已有能力（非 Host 验收）

Grok 侧已支持：

- `install-skill --platform grok` → `~/.grok/skills` 或 `./.grok/skills`
- 自动加载仓库 `AGENTS.md`
- skill 驱动的 `jj-same` / `jj-ralph` / `jj-review` / `jj-evaluated`（A1 执行面）
- 本机 Git worktree、shell、subagent

这些证明 **协议可读、可执行**，不证明 **dispatch 宿主身份与 sandbox 证明链**。

### 2.2 缺口

`jj-dispatch` DISPATCH 要求的 capability 集合（见 host-action-contract）：

```text
list_projects, list_threads, create_thread, read_thread,
send_message_to_thread, worktree, sandbox
```

Grok 无 Codex App 的 project/thread 面。若强行「假装有 thread」，会：

- 破坏 RECONCILE 的唯一候选语义；
- 无法区分会话结束与交付完成；
- 把模型自述当成 attestation。

因此需要 **映射层**，而不是改控制面业务状态机。

## 3. 目标与非目标

### 目标

1. 定义 Grok 侧 **host_id / capability / action** 与 Codex 侧的对照表，控制面 intent 字段保持同一 schema。
2. 用 **可验证证据**（路径、git、权限模式、session 元数据）绑定 `task_key`，支持 RECONCILE。
3. 写责任默认 **project-branch**（命名 feature 分支 + 项目主路径）；**isolation 时** 才独占 worktree；读责任禁止 worktree 写入。
4. 产出 versioned 试跑报告（建议 `docs/milestones/real-host-trial-grok.json`），可与 Codex 试跑并列。
5. 保持 npm 核心 runtime **不** 直连 Grok 私有 API；adapter 留在宿主边界（与 Codex 相同原则）。

### 非目标

- 不实现 Grok 云端多租户调度平台。
- 不自动 merge / push / release（A4 仍关闭）。
- 不把 subagent 提升为持久 control task 或 thread identity。
- 不删除或削弱 Codex 路径。
- 不在未过验收时改 `autonomy.max_unattended_level`。

## 4. 架构

```text
┌──────────────── control plane (不变) ────────────────┐
│ delivery / task_key / intent / CAS / receipts        │
└──────────────────────────┬───────────────────────────┘
                           │ host actions (allowlist)
          ┌────────────────┴────────────────┐
          v                                 v
┌─────────────────────┐           ┌─────────────────────┐
│ Codex Host Adapter  │           │ Grok Host Adapter   │
│ CREATE_THREAD       │           │ CREATE_SESSION_TASK │
│ RECONCILE_THREAD    │           │ RECONCILE_SESSION   │
│ thread + sandbox    │           │ session + worktree  │
│ App attestation     │           │ bound attestation   │
└─────────────────────┘           └─────────────────────┘
```

控制面继续只认识 **抽象 host action + bind 记录**；具体 API 由 adapter 解释。

### 4.1 身份映射

| 控制面概念 | Codex | Grok（建议） |
| --- | --- | --- |
| `host_id` | `codex-app` | `grok-build` |
| 可恢复执行身份 | `thread_id` | `session_id`（主会话或明确声明的 child session） |
| 项目注册 | App `projectId` + path | **绝对路径 + git remote/identity** 注册表（控制项目内 versioned） |
| 读任务角色 | `jj-workflow-reviewer` read-only | 只读 skill / read-only capability mode / 无 write worktree |
| 写任务角色 | developer + project-branch（默认）/ exclusive-worktree（隔离） | 主仓 feature 分支或独占 git worktree；工具允许写入该路径 |
| Attestation | App runtime sandbox 字段 | **绑定记录**（见 §5），禁止纯自然语言 |

`dispatch_intent` 已有字段尽量复用：`host_id`、`agent_name`、`sandbox_mode`、`effective_sandbox_mode`、`sandbox_evidence_ref`、`environment`、`bound_at`。
Grok 路径可把 `thread_id` 语义扩展为 **`external_handle`**（schema 演进时：`thread_id` 兼容别名或 `handle.kind=session|thread`）。首版实现可暂时把 `session_id` 写入现有 `thread_id` 字段并强制 `host_id=grok-build`，但必须在 evidence 中声明 `handle_kind=session`。

### 4.2 Capability 对照（语义等价，非 API 同名）

| 契约 capability | Grok 等价证明 |
| --- | --- |
| `list_projects` | 控制项目注册表可读；路径存在且 git 身份可解析 |
| `list_threads` | 可枚举本机/仓库相关 Grok session 元数据（或 harness 侧 session index） |
| `create_thread` | 为 `task_key` **创建或声明** 绑定会话（主会话分段 / 明确 child session），写入 intent `PENDING`→bind |
| `read_thread` | 可读该 session 的结构化 receipt 或约定 artifact 路径 |
| `send_message_to_thread` | 向该 session 注入 `distribution_prompt` / 后续指令（工具或工作流），并留下可审计引用 |
| `worktree` | 写任务绑定 workspace 路径（project.path 或独占 worktree）；路径与 `task_key` 1:1 |
| `sandbox` | 见 §5 attestation，非 TOML 默认值 |

任一等价证明缺失 → DISPATCH **BLOCKED**，plane 不变（与 Codex 缺 capability 相同 fail-closed）。

### 4.3 Host actions（建议枚举）

在 host-action-contract 中 **扩展**（非替换）：

| Action | 模式 | 说明 |
| --- | --- | --- |
| `CREATE_THREAD` | 保留 | Codex |
| `RECONCILE_THREAD` | 保留 | Codex |
| `CREATE_SESSION_TASK` | external-write | Grok：为 task_key 建立 session 绑定意图 |
| `RECONCILE_SESSION` | read-only | Grok：从候选 session 唯一匹配恢复 |

MVP 也可 **复用** `CREATE_THREAD` / `RECONCILE_THREAD` 类型名，仅靠 `host_id` 分流实现；文档必须写清分流规则，避免 Codex 实现误处理 Grok handle。

## 5. Attestation（Grok）

绑定写盘时必须同时满足：

1. **Identity**
   - `host_id=grok-build`
   - `session_id`（或 external_handle）
   - `task_key`
   - `agent_name` 或 skill name（reviewer vs developer）

2. **Filesystem / Git**
   - 写任务：`worktree_path` 存在、为 git worktree、与注册 project 的 main worktree 不同路径
   - `HEAD` 或 base commit 记录在 bind 时刻
   - 读任务：`worktree_policy=forbidden`，不得绑定可写 worktree

3. **Permission boundary**
   - 记录期望 `sandbox_mode`：`read-only` | `workspace-write`
   - 记录 **effective** 边界来源（例如：Grok capability mode、trusted folder、是否允许 shell 写仓库外）
   - 拿不到 effective 边界 → **拒绝 BIND**（与 Codex「TOML 默认不能当证明」一致）

4. **Evidence ref**
   - `sandbox_evidence_ref` 指向 versioned 或 CAS 管理的 JSON（控制项目 artifact），含上述字段的 hash
   - 禁止仅用聊天句「已在 sandbox 中」推进

5. **Non-goals of attestation**
   - 不声称跨机器可移植，除非 evidence 含可复现定位信息
   - 不把 subagent 临时 id 当作 delivery 级身份，除非它被 bind 为该 task_key 的唯一 handle 且可 RECONCILE

## 6. 控制流（Grok 路径）

与 Codex 相同的用户主线：

```text
INTAKE → PREVIEW → APPROVE → DISPATCH → tick/resume → receipts → VERIFIED
```

Grok 分流点仅在 host 执行：

1. DISPATCH 前置检查通过后，intent → `PENDING_THREAD`（状态名可保留；语义=等待宿主绑定）。
2. Adapter 执行 `CREATE_SESSION_TASK`：
   - 写责任：准备 project-branch 主工作区（或 isolation 时独占 worktree）+ developer 上下文 + `distribution_prompt`
   - 读责任：只读上下文，无 worktree
3. 立即 BIND：写入 session handle + attestation；失败 → `UNKNOWN`。
4. `UNKNOWN` 只允许 `RECONCILE_SESSION` 或人工 BIND；禁止同 `task_key` 再 create。
5. 子任务完成 → 结构化 receipt（`TASK_RESULT` / `REVIEW_RESULT`）→ `jj dispatch-tick --write` CAS。
6. Review `NEEDS_CHANGES` → `requestRework` 与 Codex 相同。

## 7. 与 skill 安装的关系

| 动作 | 作用 | 是否推进 Wave 2 |
| --- | --- | --- |
| `install-skill --platform grok` | 发现 `/jj-*` 协议 | 否 |
| 在 Grok 中跑 same/ralph | A1 业务执行 | 否 |
| 实现 adapter + 真实试跑 evidence | Host 验收 | **是（路径 B）** |
| 升 `max_unattended_level` | 自治策略 | 仅验收后评估 |

推荐日常：

```bash
npx @brewer/jj-flow@beta install-skill --platform grok --force
# 业务仓或控制仓
grok
# /jj-same 或 /jj-ralph …
```

项目级安装写入 `./.grok/skills`（优先级高于用户级）；安装产物 **不是** 仓库权威源（权威源仍是包内 `.codex/skills`）。

## 8. 分阶段实施

### Phase 0 — 文档与门禁（本文）

- [x] Proposed 设计入库并索引
- [x] `real-host-acceptance` 注明 Codex / Grok 双路径
- [x] skill 文案：「Codex-only」改为「dispatch 需已批准 Host；Grok 路径见本设计」

### Phase 1 — 契约扩展

- [x] host-action-contract：`host_id` 枚举、`handle_kind`、Grok capabilities 映射
- [x] control-plane / receipt 字段兼容 session handle（`thread_id` 存 handle 值 + `handle_kind`）
- [x] harness-check 反例：缺 attestation 不得 PASS 假证据
- [x] 合约测试：`tests/grok-host-contract.test.mjs`（纯状态，无网络）

### Phase 2 — Adapter 实现（宿主边界）

- [ ] 控制项目侧：项目注册表（path + git identity）
- [ ] create/bind/reconcile 的可脚本化步骤（优先 CLI + 约定 artifact，少依赖私有 API）
- [ ] worktree 生命周期：创建、绑定、清理策略（失败不删证据）
- [ ] doctor：检测 `grok` 可执行文件与 skill 安装，**不** 因此报告 A2

### Phase 3 — 真实试跑与验收

- [ ] 在真实 Grok 会话中跑通一条 delivery（含至少一轮 NEEDS_CHANGES）
- [ ] 写入 `docs/milestones/real-host-trial-grok.json`（或统一 schema 多 host）
- [ ] 更新 `real-host-acceptance` 状态；**单独** 评估是否升 A2
- [ ] 半真实 `host:trial` 保持 `codex`/local-git 语义，**不得** 改 `mode=semi-real` 冒充 Grok 真实验收

## 9. 验收标准

### 9.1 设计完成（Proposed → Accepted）

- 映射表、attestation 字段、fail-closed 规则无歧义。
- 与 M7 半真实边界、A1 默认策略无冲突。
- 文档站与 harness-manifest 可发现。

### 9.2 实现完成（Accepted → Implemented）

- 合约测试 + harness-check 覆盖 Grok 路径枚举漂移。
- 至少一次 **真实 Grok** 试跑 evidence 入库，且：
  - `host.adapter` / `host_id` 标明 `grok-build`
  - `handle_kind=session`
  - 含 worktree + attestation refs
  - `codex_app_threads` 不得伪称 true
- Review 返工与 RECONCILE 各至少一次成功路径。
- `max_unattended_level` 仍为 A1，除非另开变更单明确升级。

### 9.3 明确失败条件

- 用聊天 session 状态替代 control-plane revision。
- 用 subagent 并发写同一项目无 depends_on。
- 绑定无 `sandbox_evidence_ref`。
- 把 `npm run host:trial` 的 semi-real 报告改标签交差。

## 10. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| Grok session 元数据不稳定 / 难枚举 | RECONCILE 以 worktree path + task_key + evidence hash 为主键；session 为辅 |
| 权限模型与 Codex sandbox 不可比 | attestation 记录 **本机有效边界**，不声称与 Codex 同构 |
| 双 host 状态机分叉 | 控制面单一；仅 adapter 分叉；契约测试锁枚举 |
| 过早升 A2 | 里程碑与 manifest 双锁；doctor 不因 Grok 安装提高 available_level |
| 安装目录污染 git | `.grok/skills` 作本地安装目标，不进权威源；gitignore |

## 11. 决策（Proposed 待接受）

1. **Grok 是第二宿主，不是 Codex 模拟器。**
2. **控制面 schema 保持单一**；handle 用 `host_id` + kind 区分。
3. **Attestation 必须可哈希、可引用**；模型自述无效。
4. **关闭 Wave 2 的 Grok 路径与 Codex 路径等价可选**；任一完成可评估 A2，不要求双满。
5. **Skill 安装与 Host adapter 解耦**；安装只服务 A1 DX。

## 12. 下一步（执行时）

1. Phase 1 契约与纯状态测试已完成，见 `docs/exec-plans/completed/2026-07-27-grok-host-adapter.md`。
2. 评审本设计 → Accepted 或修订（整体仍为 Proposed，不因 Phase 1 升 Implemented）。
3. 另开 Phase 2 exec plan：控制项目注册表 + worktree 生命周期 + 可脚本化 create/bind/reconcile + doctor 边界。
4. Phase 3 真实验收；**禁止** 与 semi-real 证据混用。


## 13. 参考

- `docs/milestones/real-host-acceptance.md`
- `docs/milestones/m7-acceptance.md` / `m7-host-trial.json`
- `.codex/skills/jj-dispatch/references/host-action-contract.json`
- `docs/design-docs/harness-engineering.md` §自主等级
- Grok skill 发现：`~/.grok/skills`、`./.grok/skills`、`AGENTS.md`
