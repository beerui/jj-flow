# 真实 Codex App Host 验收（PENDING）

> 状态：pending
>
> 范围：真实 Codex App project / worktree 上的 create_thread、绑定、sandbox attestation、中断恢复与 Review 返工
>
> 关联：半真实证据见 [M7 验收](m7-acceptance.html) 与 `m7-host-trial.json`；Repository Harness 收口见 [Harness 收口计划](../exec-plans/completed/2026-07-18-harness-hardening.html)

## 目的

把 **真实宿主** 联调与 **半真实 host trial** 永久分开。npm runtime 与 `npm run host:trial` 只能证明本地 Git worktree + 控制面 CAS 闭环；它们 **不能** 签发 Codex App runtime sandbox attestation，也 **不能** 把 `max_unattended_level` 从 `A1` 抬到 `A2`/`A3`。

## 当前已证明（semi-real，非本里程碑）

| 能力 | 证据 | 是否可替代真实 Host |
| --- | --- | --- |
| 独占 worktree 产生 commit | `docs/milestones/m7-host-trial.json` | 否 |
| 模拟 sandbox 字段写入 intent 绑定 | 同上，`host.codex_app_threads=false` | 否 |
| RECONCILE 恢复、不重复 create | 同上 | 否 |
| Review `NEEDS_CHANGES` → 返工 → `PASS` | 同上 | 否 |
| Repository Truth Plane / 门禁 / Gardener | `npm run verify`、H5 基线 | 无关 |

## 本里程碑必须由宿主产生的证据

在真实 Codex App project（或等价已批准 Host）中至少完整跑通一条 delivery，并落盘到 **versioned** 路径（建议 `docs/milestones/real-host-trial.json`，schema 可在联调时新增，不得复用 semi-real 的 `mode: "semi-real"` 常量）：

1. **Project / worktree 绑定**  
   - 控制面 `delivery_id`、目标 `project_id`、独占 worktree 路径  
   - Host 返回的 project/thread 标识（非本地伪造）

2. **Create / bind / resume**  
   - 至少一次 `CREATE_THREAD`（或宿主等价动作）成功并写回 thread id  
   - 至少一次创建结果不确定 → `RECONCILE_THREAD` → 唯一候选绑定，且 `duplicate_create_count = 0`

3. **Runtime sandbox attestation**  
   - 由 **宿主** 签发的 sandbox / environment / agent 证明字段  
   - 绑定到具体 `task_key` / intent，可在 receipt 或 control-plane 事件中追溯  
   - 禁止用本地 runner 合成 attestation 冒充

4. **开发 → 验证 → Review → 返工**  
   - Developer 在批准快照下于独占 worktree 提交  
   - Reviewer 只读 findings；至少一轮 `NEEDS_CHANGES` 再 `PASS`（或明确记录无返工原因）  
   - 控制面 CAS 持久化与最终 `VERIFIED`（或失败路径的 fail-closed 记录）

5. **Autonomy 升级门槛**  
   - 仅在上述 1–4 全部 PASS 且人工审查通过后，才评估修改 `harness-manifest.json` 中 `autonomy.max_unattended_level`  
   - 升级前必须同步更新 doctor 期望、设计成熟度「自主闭环」评分依据，以及本文件状态为 `completed` 与验收证据指针

## 明确禁止

- 用 `mode: "semi-real"` 或 `codex_app_threads: false` 的报告关闭本里程碑  
- 在未提交真实 attestation 证据时把 `max_unattended_level` 设为 `A2`/`A3`  
- 让 Node.js 核心 runtime 直接调用 Codex App API 并伪造宿主身份  
- 用聊天、memory、本机 `.workflow` 或未入库 JSON 推进 checkpoint

## 验收命令（宿主环境）

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
| `pending`（当前） | 无真实 Codex App 证据；无人值守上限保持 `A1` |
| `in_progress` | 联调进行中；证据草稿可进 PR，但不得升级 autonomy |
| `completed` | 宿主证据入库、审查通过；才可评估 A2/A3 |
| `blocked` | 宿主能力或权限不可用；记录阻塞原因 |

## 残留风险

在本里程碑完成前：

- 生产部署路径上的 thread 创建、跨机器恢复与真实 sandbox 策略 **未证明**  
- Agent 在真实 App 中的 attention 成本与半真实 trial 可能不同  
- `jj doctor` 报告的 `available_level` 反映仓库门禁就绪度，**不** 表示真实 Host 已验收
