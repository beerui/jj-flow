---
name: jj-dispatch
description: 在业务仓发起多项目调度：PREVIEW→批准→DISPATCH→tick/resume。协调状态默认写入用户主目录 ~/.jj-flow（可配置）。跨项目派发、delivery、TASK-ID 恢复时使用。单仓闭环用 jj-ralph；迁移实现用 jj-same；单仓审查用 jj-review。
---

# jj-dispatch

跨项目调度入口。平台：**Codex / Qoder / Grok**；**无 Claude slash = intentional**（不新增 `/jj-dispatch`）。

> **real-host acceptance: PENDING** — [docs/milestones/real-host-acceptance.md](../../../docs/milestones/real-host-acceptance.md)
>
> **VERIFIED 必须绑定 attestation 文件证据**（`sandbox_evidence_ref` → `attestations/*.json`，含 review）。禁止口头/聊天 VERIFIED。

## Happy path checklist

```text
TASK-ID 恢复 -> PREVIEW（分支/workspace 表）
  -> 用户批准 task_keys
  ->（不确定则确认 branch/mode）-> DISPATCH -> tick/resume
```

| # | 门禁（先匹配先生效） | 动作 |
| --- | --- | --- |
| 1 | intake 未完成 | 只 `INTAKE_REQUIRED` |
| 2 | intent=`UNKNOWN` | 只 `RECONCILE` / 人工 BIND；禁止再 create 同 key |
| 3 | 无 task_keys 批准 | `PREVIEW_ONLY` 只读 |
| 4 | 写分支/workspace 不确定 | 展示判断表；确认前不 DISPATCH |
| 5 | 缺 Codex capabilities | Codex：BLOCKED 且 plane 不变；**Grok→Mode S 降级** |
| 6 | 已批准且路径就绪 | 写 intent→BIND（Grok：真 session + attestation 文件） |
| 7 | 有 receipt / 已绑定 | tick/resume；**无 CLI 时 Agent 写 plane**（见 agent-write-plane） |
| 8 | 标 VERIFIED | 需 commit+review+真 session+**attestation 文件**；**T-task-result-sync** 同批刷新 result/progress |

门禁全文与判断表 → [happy-path.md](references/happy-path.md)。控制面权威：`src/dispatchControlPlane.mjs` + schema；不得发明并行枚举。

## 目录配置

**产品默认 control_root = `~/.jj-flow`**（不是 `/portfolio`）。

| 项 | 值 |
| --- | --- |
| 配置目录 | `$JJ_GLOBAL_CONFIG_DIR` / `$DAJI_CONFIG_DIR`；Windows 未设时可**可选**发现 `/portfolio/config`（legacy，非产品默认状态根） |
| 配置文件 | `<configDir>/naming.json` |
| 查看解析 | `jj doctor` → `control_root` / `portfolio_root` / `knowledge_root` / `project_map` |

| 配置键 | 含义 | 产品默认 | 环境变量 |
| --- | --- | --- | --- |
| `dispatch.control_root` | plane / task / receipt | **`~/.jj-flow`** | `JJ_DISPATCH_CONTROL_ROOT` |
| `dispatch.portfolio_root` | 业务仓顶层树 | null | `JJ_PORTFOLIO_ROOT` |
| `dispatch.knowledge_root` | Portfolio KB | `{portfolio_root}/knowledge` 或无 | `PORTFOLIO_KB_ROOT` |
| `project_map` | 项目地图 | null | `JJ_PROJECT_MAP` |

CLI 覆盖：`--control-root` / `--manifest`。解析序：CLI → env → naming.json → **`~/.jj-flow`**。

| | **用户从哪发起** | **状态写到哪** |
| --- | --- | --- |
| 产品默认 | 任意业务仓 cwd | **`~/.jj-flow`** |
| **portfolio 示例（非默认）** | 如 `/portfolio/project-a` | 仅当 naming 配置后如 `/portfolio/dispatch-control` |

细则 → [control-project.md](references/control-project.md)。

## 四个动作

| 动作 | 要点 |
| --- | --- |
| **PREVIEW** | 默认只读；intake 未完→`INTAKE_REQUIRED`；完成→`PREVIEW_ONLY` + 写任务分支表；不写 intent |
| **DISPATCH** | 用户批准 `task_keys` 且分支/mode 已确认后**尝试**；写 `PENDING_THREAD`→BIND；默认 `project-branch`；改 targets/attempt 须重 PREVIEW+批准 |
| **RECONCILE** | 唯一匹配 thread 才自动绑定；0/多候选→本次 BLOCKED，intent 保持 `UNKNOWN` |
| **BIND_THREAD** | 绑真实 host handle；须 attestation；「完成」文字不是证据 |

字段与 Review 闭环 → [control-project.md](references/control-project.md)。

## Agent 写 plane

用户不跑 CLI 时，**Agent 可且必须**直接落盘 plane / task / attestation / receipt，遵守 [agent-write-plane.md](references/agent-write-plane.md)（状态天花板、`produced_commit`、session 绑定 C4、自检清单 C5/C6、**T-task-result-sync**）。可选：`node .codex/skills/jj-dispatch/scripts/plane-self-check.mjs --manifest …`。

## Grok Mode S（默认）

| 问题 | 答案 |
| --- | --- |
| 协议是否多任务？ | 是（多 task_key） |
| 默认是否多 Grok session？ | **否**（Mode S）；Mode P 后置 |
| 是否必须用 Grok Workflow？ | **否**；Workflow **不能**推进 checkpoint |
| 用户是否跑 CLI？ | **否**；Agent 写 attestation/receipt/plane |

完整规格 → [grok-dispatch-execution.md](references/grok-dispatch-execution.md)。

## CLI 矩阵（Agent 可选）

| 目的 | 命令 |
| --- | --- |
| 目录解析 | `jj doctor` |
| 任务目录 | `jj task scaffold --delivery …` |
| 恢复上下文 | `jj task context --task TASK-ID` |
| 状态 JSON | `jj task status --task TASK-ID --json` |
| 分配确认 | `jj task assign --delivery … --task …` |
| 消费回执 | `jj dispatch-tick --delivery …`（可 `--write`） |
| plane 自检 | `plane-self-check.mjs --manifest …` |
| 契约 | `npm run harness:check` |

## 回退

「回退目标 / 假 VERIFIED / 停 task」→ [rollback.md](references/rollback.md)。默认**不** auto merge/push/force-push；`reopenTarget` / `blockDispatchIntent` / `requestRework` 等写 `events[]` + `revision++`。

## Host action contract tokens

权威契约：[host-action-contract.json](references/host-action-contract.json)。

- Action types: `CREATE_THREAD` · `RECONCILE_THREAD`
- Capabilities: `list_projects` · `list_threads` · `create_thread` · `read_thread` · `send_message_to_thread` · `worktree` · `sandbox`
- Write 默认 `project-branch`；隔离时 `exclusive-worktree`；`worktree` 字段绑路径

角色字段（intake / plane）：`origin_project` · `requirement_owner` · `lead_project` · `reference_implementation` · `targets`（细则 → control-project.md）。

## 与 `jj-same` 的关系

`$jj-dispatch` 是跨项目控制平面，不是同步实现器。可把已批准目标交给 `$jj-same`；目标分析、差异适配、验证与 sync checkpoint 仍由 `jj-same` 负责。旧 `源=A 目标=B,C` 映射为 `origin_project/requirement_owner/lead_project=A`、`reference_implementation=null`、`targets=[B,C]`。

## 明确不做

- 不要求用户先打开 control 根或每波新建控制仓
- **不要求用户跑 CLI** 才能 PREVIEW / 批准 / 收口
- 不实现常驻 daemon / DB / 完整多智能体引擎
- **默认不**自动 checkout、merge、push、release
- 不因 thread 停止或模型文字推进检查点
- 不手写 `VERIFIED` 却缺 `produced_commit` / 真 session / **attestation 文件**
- 不合成 `session-…` 占位 thread 伪装 BOUND
- 不新增 Claude `/jj-dispatch`
- 不把 control 根当业务源项目
- 不在 capability 失败时伪造 host API 或“降级为 projectless”
- 不把 skill 安装或 `host:trial` 当真实 Host 验收

## References

| 文件 | 何时读 |
| --- | --- |
| [happy-path.md](references/happy-path.md) | 主路径、Gates 1–8、判断表、PENDING |
| [agent-write-plane.md](references/agent-write-plane.md) | Agent 写 plane A–D / C4–C6 / T-task-result-sync |
| [control-project.md](references/control-project.md) | 目录、intake、字段、Review 闭环 |
| [rollback.md](references/rollback.md) | 回退 / reopen |
| [grok-dispatch-execution.md](references/grok-dispatch-execution.md) | Grok Mode S/W/P |
| [control-plane.schema.json](references/control-plane.schema.json) | 写 plane 前按键检索 |
| [host-action-contract.json](references/host-action-contract.json) | capability / host actions |
| [task-receipt.schema.json](references/task-receipt.schema.json) | 回执 |
