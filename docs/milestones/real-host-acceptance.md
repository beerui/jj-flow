# 真实 Host 验收（PENDING）

> 状态：**pending**
>
> 范围：在 **已批准宿主** 上完成 create/bind、sandbox attestation、中断恢复与 Review 返工，并落盘 **versioned** 证据
>
> 可选宿主路径（满足其一即可评估 A2）：
> - **Codex App**：thread + App sandbox attestation（契约第一实现）
> - **Grok Build**：session + 可哈希 worktree/权限绑定（[Grok Host Adapter](../design-docs/grok-host-adapter.html)，状态 Proposed / Wave 2）
>
> 关联：半真实证据 [M7 验收](m7-acceptance.html) · Repository Harness [H5](h5-acceptance.html) · [Harness 收口计划](../exec-plans/completed/2026-07-18-harness-hardening.html) · Grok Mode S 日常路径 [exec plan](../exec-plans/active/2026-07-30-grok-dispatch-execution.html)

## 目的

把 **真实宿主** 联调与 **半真实 host trial** 永久分开。

| 层 | 命令 / 产物 | 能证明 | 不能证明 |
| --- | --- | --- | --- |
| Repository Harness | `npm run verify`、`harness:gc` | 真相源、契约、只读 GC | 真实 App thread / sandbox 签发 |
| 半真实 Host | `npm run host:trial`、`m7-host-trial.json` | 本地 Git worktree + CAS + receipt 闭环 | 宿主 runtime attestation；**不得**升 A2 |
| 真实 Host（本文） | versioned trial JSON + 宿主签发字段 | create/bind/RECONCILE/返工在真 Host | — |

`max_unattended_level` 当前为 **A1**（见 `harness-manifest.json`）。skill 安装（含 Grok）与 Mode S 日常派发只服务 A1 DX，**不**关闭本里程碑。`lab-harness` 是实验场 gym host，**不得**当作本里程碑证据。

## 当前已证明（semi-real，非本里程碑）

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
| Codex App | `docs/milestones/real-host-trial.json` | `handle_kind=thread`；App sandbox |
| Grok Build | `docs/milestones/real-host-trial-grok.json` | `handle_kind=session`；见 Grok Host Adapter §5 |

schema 可在联调时扩展，**不得** 复用 semi-real 的 `mode: "semi-real"` 常量，也不得把 `codex_app_threads: false` 的报告改名入库。

### 必备清单

1. **Project / workspace 绑定**  
   - 控制面 `delivery_id`、目标 `project_id`、写任务 workspace（默认 project-branch；isolation 时 exclusive-worktree）  
   - Host 返回的 project / **thread 或 session** 标识（非本地伪造）

2. **Create / bind / resume**  
   - 至少一次 create（`CREATE_THREAD` 或 Grok 等价 session 绑定）成功并写回 handle  
   - 至少一次 create 结果不确定 → RECONCILE → 唯一候选绑定，且 `duplicate_create_count = 0`

3. **Runtime sandbox attestation**  
   - 由 **宿主边界** 产生的 sandbox / environment / agent 证明（Codex App 签发，或 Grok 路径可哈希绑定 evidence）  
   - 绑定到具体 `task_key` / intent，可在 receipt 或 control-plane 事件中追溯  
   - 禁止用本地 semi-real runner 或模型自述冒充

4. **开发 → 验证 → Review → 返工**  
   - Developer 在批准快照下于绑定 workspace 提交  
   - Reviewer 只读 findings；至少一轮 `NEEDS_CHANGES` 再 `PASS`（或明确记录无返工原因）  
   - 控制面 CAS 持久化与最终 `VERIFIED`（或失败路径的 fail-closed 记录）

5. **Autonomy 升级门槛**  
   - 仅在 1–4 全部 PASS 且人工审查通过后，才评估修改 `autonomy.max_unattended_level`  
   - 升级前必须同步：doctor 期望、[Harness 设计](../design-docs/harness-engineering.html) 自主闭环评分依据、本文件状态 `completed` 与证据指针

## 明确禁止

- 用 `mode: "semi-real"` 或 `codex_app_threads: false` 的报告关闭本里程碑  
- 用「已安装 skill」或仅跑通 same/ralph/Mode S 关闭本里程碑  
- 在未提交真实 attestation 证据时把 `max_unattended_level` 设为 `A2`/`A3`  
- 让 Node.js 核心 runtime 直接调用 Codex/Grok 私有 API 并伪造宿主身份  
- 用聊天、memory、本机 `.workflow` 或未入库 JSON 推进 checkpoint  

## 验收命令

```bash
# Repository 侧仍须通过（不替代真实 Host）
npm run verify
npm run host:trial   # 仅 semi-real 回归

# 真实 Host 侧：由部署/联调环境执行 create/bind/receipt 流程后
# 将宿主 attestation + control-plane 摘要写入 versioned evidence，
# 再把本文件状态改为 completed 并登记证据路径。
```

## 状态机

| 状态 | 含义 |
| --- | --- |
| `pending`（**当前**） | 无真实宿主证据；无人值守上限保持 `A1` |
| `in_progress` | 联调进行中；证据草稿可进 PR，但不得升级 autonomy |
| `completed` | 宿主证据入库、审查通过；才可评估 A2/A3 |
| `blocked` | 宿主能力或权限不可用；记录阻塞原因 |

## 残留风险

在本里程碑完成前：

- 生产路径上的 thread/session 创建、跨机器恢复与真实 sandbox 策略 **未证明**  
- Agent 在真实 App 中的 attention 成本与半真实 trial 可能不同  
- `jj doctor` 的 `available_level` 反映仓库门禁就绪度，**不** 表示真实 Host 已验收  
- Grok Mode S live 验收证明「日常可派发」，不证明 Wave 2 attestation 链  
