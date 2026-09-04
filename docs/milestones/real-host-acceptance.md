# 真实 Host 验收（COMPLETED）

> 状态：**completed**
>
> 范围：在 **已批准宿主** 上完成 create/bind、sandbox attestation、中断恢复与 Review 返工，并落盘 **versioned** 证据
>
> 关闭路径：**Grok Build**（session + 可哈希 worktree/权限绑定）。Codex App 路径仍可选补齐，不挡本里程碑。
>
> 关联：半真实证据 [M7 验收](m7-acceptance.md) · Repository Harness [H5](h5-acceptance.md) · [Harness 收口计划](../exec-plans/completed/2026-07-18-harness-hardening.md) · Grok 试跑 [`real-host-trial-grok.json`](real-host-trial-grok.json)

## 目的

把 **真实宿主** 联调与 **半真实 host trial** 永久分开。

| 层 | 命令 / 产物 | 能证明 | 不能证明 |
| --- | --- | --- | --- |
| Repository Harness | `npm run verify`、`harness:gc` | 真相源、契约、只读 GC | 真实 App thread / sandbox 签发 |
| 半真实 Host | `npm run host:trial`、`m7-host-trial.json` | 本地 Git worktree + CAS + receipt 闭环 | 宿主 runtime attestation；**不得单独**升 A2 |
| 真实 Host（本文） | versioned trial JSON + 宿主签发字段 | create/bind/RECONCILE/返工在真 Host | A3 自动返工 / A4 merge-push-release |

`max_unattended_level` 当前为 **A2**（见 `harness-manifest.json`）。`default_level` 仍为 **A1**。skill 安装、Mode S、Mode W、`lab-harness`、`host:trial` **不能**单独提高等级。`jj doctor` 列出 `grok` 可执行文件 **不会** 把等级抬到 manifest 之上。

## 审查结论（2026-09-01）

人工审查认定必备清单 **1–4 PASS**，并明确要求升 A2。

- 证据：[`docs/milestones/real-host-trial-grok.json`](real-host-trial-grok.json)
- `mode=real-grok`，`adapter=grok-build`，`handle_kind=session`
- session：`01a0569f-4634-76a2-a497-1e9417fb5396`；`effective_boundary_source=grok-session-env`
- 中断 `RECONCILE_THREAD`，`duplicate_create_count=0`
- Review `NEEDS_CHANGES` → 返工 → `PASS`；delivery **VERIFIED**
- 试跑 JSON **不得自关** Wave 2（`evaluateGrokWave2Evidence.closed` 仍为 false）
- 关闭条件：本文件 `completed` **且** manifest `max_unattended_level=A2` **且** JSON evaluable

未升 **A3**（自动 Review 返工）或 **A4**（merge/push/release）。A2 仍要求批准快照（`approval: required`）。

## 当前已证明（semi-real，非本里程碑的充分条件）

| 能力 | 证据 | 是否可替代真实 Host |
| --- | --- | --- |
| 写 workspace（project-branch 或 exclusive-worktree）产生 commit | `docs/milestones/m7-host-trial.json` | 否 |
| 模拟 sandbox 字段写入 intent 绑定 | 同上，`host.codex_app_threads=false` | 否 |
| RECONCILE 恢复、不重复 create | 同上 | 否 |
| Review `NEEDS_CHANGES` → 返工 → `PASS` | 同上 | 否 |
| Repository Truth Plane / 门禁 / Gardener | `npm run verify`、H5 基线 | 无关（必要但不充分） |
| Grok Mode S 日常 skill 派发 | evaluations / Mode S exec plan | 否（非 Wave 2 attestation） |

## 本里程碑必须由宿主产生的证据

在真实已批准 Host 中至少完整跑通一条 delivery，并落盘到 **versioned** 路径：

| 路径 | 建议 evidence 文件 | `host_id` / 备注 |
| --- | --- | --- |
| Codex App | `docs/milestones/real-host-trial.json` | `handle_kind=thread`；App sandbox；**仍缺，不挡 Grok 关闭** |
| Grok Build | `docs/milestones/real-host-trial-grok.json` | `handle_kind=session`；**本里程碑关闭路径** |

schema 可在联调时扩展，**不得** 复用 semi-real 的 `mode: "semi-real"` 常量，也不得把 `codex_app_threads: false` 的报告改名入库。

### 必备清单

1. **Project / workspace 绑定** — **PASS**（Grok 试跑 `wave2-target` + exclusive-worktree `feat/grok-wave2-trial`）
2. **Create / bind / resume** — **PASS**（真实 session bind；UNKNOWN → 唯一候选 RECONCILE；`duplicate_create_count=0`）
3. **Runtime sandbox attestation** — **PASS**（宿主环境 `GROK_SESSION_ID` + `GROK_AGENT`；attestation 文件绑定 `task_key`）
4. **开发 → 验证 → Review → 返工** — **PASS**（`NEEDS_CHANGES` → `PASS`；CAS `VERIFIED`）
5. **Autonomy 升级门槛** — **PASS（A2 only）**：1–4 人工审查通过；已同步 doctor 期望、Harness 自主闭环评分、本文件 `completed`

## 明确禁止（仍有效）

- 用 `mode: "semi-real"` 或 `codex_app_threads: false` 的报告关闭本里程碑
- 用「已安装 skill」或仅跑通 same/ralph/Mode S 关闭本里程碑
- 在未提交真实 attestation 证据时把 `max_unattended_level` 设为 `A2`/`A3`
- 让 Node.js 核心 runtime 直接调用 Codex/Grok 私有 API 并伪造宿主身份
- 用聊天、memory、本机 `.workflow` 或未入库 JSON 推进 checkpoint
- 因本里程碑自动升 **A3/A4**

## 验收命令

```bash
npm run doctor
# grok.wave2_status=completed；wave2_closed=true
# autonomy.available_level=A2；max_unattended=A2；default_level=A1
# grok_does_not_raise_level=true（可执行文件/skill 不得把等级抬到 manifest 之上）

npm run verify
npm run host:trial   # 仅 semi-real 回归，不能单独维持 A2
```

## 状态机

| 状态 | 含义 |
| --- | --- |
| `pending` | 无真实宿主证据；无人值守上限保持 `A1` |
| `in_progress` | 联调进行中；证据草稿可进 PR，但不得升级 autonomy |
| `completed`（**当前**） | 宿主证据入库、审查通过；`max_unattended_level=A2` |
| `blocked` | 宿主能力或权限不可用；记录阻塞原因 |

## 残留风险

- Codex App thread / App sandbox 路径仍未入库（不挡 Grok 关闭）
- 试跑目标仓是临时 Git，不是生产 项目A/B/C
- A2 仍要求批准快照；无批准不得对外写
- A3 自动返工与 A4 集成仍关闭
- Agent 在真实 App 中的 attention 成本可能与试跑不同
