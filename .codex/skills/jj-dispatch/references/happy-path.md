# jj-dispatch Happy Path

主路径与门禁索引。Agent 写 plane 细则见 [agent-write-plane.md](agent-write-plane.md)；字段/目录见 [control-project.md](control-project.md)。

## 用户可见主线

```text
读取 TASK-ID 主标题 -> PREVIEW（含分支/workspace 判断）
  -> 用户批准 task_keys
  ->（若分支/workspace 仍不确定）展示判断并询问 -> 用户确认
  -> DISPATCH -> tick/resume
```

异常与门禁**优先于**主线。

## Gates 1–8（紧凑）

1. **缺 intake**（`intake.status=REQUIRED` 或关键字段未确认）→ 只返回 `INTAKE_REQUIRED`；不 PREVIEW 推进、不 APPROVE、不 DISPATCH、不 create_thread。
2. **存在 `status=UNKNOWN` 的 dispatch_intent** → 只走 `RECONCILE` 或人工 `BIND_THREAD`；禁止对同一 `task_key` 再 create_thread / 再写第二份 intent。
3. **无本轮 task_keys 的明确批准** → `PREVIEW`（`action=PREVIEW`, `status=PREVIEW_ONLY`）；只读；不写 intent；不 create_thread。
4. **写责任目标分支 / workspace 模式不确定** → 先输出自检判断表，向用户确认；确认前不 DISPATCH、不 create_thread、不写 intent；用户可改判 `project-branch` / `exclusive-worktree` / 目标分支名。
5. **已批准但缺 REQUIRED_APP_CAPABILITIES** → Codex App：DISPATCH 拒绝（`ok=false`, `BLOCKED`），plane 不变，不写 intent。**Grok Build**：不因「无多 session create/list」整波假 BLOCKED；**降级 Mode S**（单会话串行 + project-branch），见 [grok-dispatch-execution.md](grok-dispatch-execution.md)。仍禁止伪造 capability 或合成 session 伪装 BOUND。
6. **已批准，分支/workspace 已确认（或无疑义），且（Codex 能力齐 / 或 Grok Mode S）** → DISPATCH：先持久化 intent(`PENDING_THREAD`) → Codex：`CREATE_THREAD` → `BIND_THREAD`；Grok：**Mode S** 绑定当前真实 session id（多 task_key 可共享）+ 写 attestation 文件。
7. **有 receipt 或需推进已绑定任务** → tick/resume（有 CLI 用 `jj dispatch-tick`；**无 CLI 时 Agent 直接改 plane**，必须遵守 [agent-write-plane.md](agent-write-plane.md)）。
8. **要把 target/delivery 标成 VERIFIED**（或 development 标 DONE）→ 先满足终端态证据（git commit / review / 真 session id + **attestation 文件**）。不满足：最多 `EVIDENCE_READY` / `RUNNING`；禁止因用户说「好了/已合并」而写 VERIFIED。**T-task-result-sync**：升 VERIFIED 的同一落盘动作内刷新 task 目录 `result.md` / `progress.md`；禁止 plane 已 VERIFIED 而 result 仍写 EVIDENCE_READY。

有 `TASK-ID` 时先恢复索引与 manifest（有 CLI 用 `jj task context/status`；无 CLI 直接读 control_root 下 task 目录与 plane），再套用以上门禁。

## real-host acceptance

**状态：PENDING** — 见仓库 [docs/milestones/real-host-acceptance.md](../../../../docs/milestones/real-host-acceptance.md)。

- 半真实 host trial / skill 安装 **不能**升 A2，也 **不能**口头宣称 VERIFIED 替代本里程碑。
- **VERIFIED 必须绑定 attestation 文件证据**（`sandbox_evidence_ref` → `attestations/<task_key_safe>.json`，含 review/read）；禁止仅用 `host:…:session:…` 字符串或聊天收口。

## 分支与 workspace 判断表（写责任，DISPATCH 前）

| 列 | 内容 |
| --- | --- |
| project / path | 注册 path |
| intended_branch | 任务/领头派生/用户指定的 feature 分支 |
| current_branch @ path | `git branch --show-current`（主工作区） |
| dirty | 是否有**非本任务**脏改动 |
| active_write | 同项目是否已有 active write intent |
| proposed_mode | `project-branch`（默认）或 `exclusive-worktree` |
| base / origin_base | 集成基线 ref 与 tip（默认 `master` / `origin/master`） |
| behind_count | `git rev-list --count <base>..<remote>/<base>`（CREATE 前须 `git fetch`） |
| base_action | `USE_LOCAL` / `FETCH_FF` / `CREATE_FROM_ORIGIN` / `NEEDS_CONFIRM` / `BLOCKED` |
| confidence | `high` / `low` |
| action | `READY` 或 `NEEDS_CONFIRM` |

**CREATE 基线新鲜度（EP-20260803 硬门）**：intended 不存在、需从基线新建时，**禁止**在 `behind_count > 0` 时从陈旧 local `master` tip 静默 `checkout -b`。先 `git fetch`；优先 `CREATE_FROM_ORIGIN` 或干净 base 的 `FETCH_FF`。禁止对脏/分叉 local master 做 `reset --hard`。与 jj-same [branch-purpose-preflight](../../jj-same/references/branch-purpose-preflight.md) checks 6–10 / G6 对齐。

**何时必须停问（`NEEDS_CONFIRM`）**：目标分支缺失/冲突；主工作区分支 ≠ intended 且无法安全快进；isolation 拿不准；用户曾要求「合到当前分支」或发生 worktree transfer 纠错；**local base 脏/分叉无法安全 ff 且需 CREATE**；**无法 fetch 且无法证明 base 新鲜**。

用户确认前：**不** DISPATCH、**不** create_thread、**不**写 `dispatch_intent`。

## 推荐 delivery 状态链

```text
DRAFT -> PREVIEW_ONLY -> APPROVED -> DISPATCHING -> RUNNING
       -> EVIDENCE_READY -> VERIFIED
任何阶段可进入 delivery BLOCKED；绑定异常 intent -> UNKNOWN -> RECONCILE
```

## 其它 references

| 文件 | 何时读 |
| --- | --- |
| [agent-write-plane.md](agent-write-plane.md) | Agent 手写 plane / 无 CLI 收口 |
| [control-project.md](control-project.md) | 目录、intake、字段、Review 闭环 |
| [grok-dispatch-execution.md](grok-dispatch-execution.md) | Grok Mode S/W/P |
| [rollback.md](rollback.md) | 回退 / reopen / 假 VERIFIED |
| [host-action-contract.json](host-action-contract.json) | capability 与 host actions |
| [task-receipt.schema.json](task-receipt.schema.json) | 回执形状 |
