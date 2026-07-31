---
name: jj-same
description: 在同源分叉项目间迁移/同步功能。用户侧只说「交接到 兑接/承载」等自然语言；agent 从当前会话的 Ralph run/handoff 解析目标并实施。也可基于会话、commit、旧 handoff snapshot 工作。按稳健/剃刀/精准/最小化/复用适配目标原生架构。
---

# 跨项目精准迁移

同步需求不变量，不复制源项目文件。首次把 A 的功能迁到 B 时建立可验证基线；后续只处理 A 自上次成功同步后的有效增量，再按 B 的真实能力做最窄适配。细则：[references/happy-path.md](references/happy-path.md)、[references/workflow-core.md](references/workflow-core.md)。

## Happy path checklist

1. Ralph-handoff-first：当前 `RALPH-*/run.json` → `handoff_ref` / `run.handoff`；`ready=true` 禁止重做源分析。
2. 从用户话解析目标角色；有 control 时**只读**批准的 `targets` / `task_key`。
3. 分支用途 preflight（硬门）→ [branch-purpose-preflight.md](references/branch-purpose-preflight.md)。
4. 默认 `port_profile.mode=LITE`；明显 ADAPT/多文件/持续同步才 FULL。
5. 核对 **`EXECUTION_READY`**（授权 + 稳定源 commit/diff + 需求可收敛 + 目标调用链 + 无影响 `MUST` 的 `UNRESOLVED`）。
6. 最窄计划后**同一轮**改业务代码与聚焦测试；不得只更新计划/家族状态收工。
7. 分层验证：静态/聚焦测试；运行时默认用户确认或 `N/A`（见 workflow-core）。
8. 五项门禁复审最终 diff；产物进 `.workflow/` 分目录，**禁止** `.workflow/jj-same/`。
9. **`HANDOFF_READY`** 后才写 `READY_FOR_HANDOFF / COMPLETED` 并推进同步检查点。
10. 持续同步：恢复 `sync_key` + 检查点 → [continuous-sync.md](references/continuous-sync.md)。

完整编号路径与控制面边界表 → [happy-path.md](references/happy-path.md)。

## 用户怎么说

- `交接到 兑接` / `交接到 兑接 承载` / `开始交接` / `提交并交接三端` / `继续迁承载`
- Agent 自解析领头 Ralph run、`handoff_ref`、目标角色、源 commit；**不要**要求用户填 `交接=@...` / `from-ralph=...`。

## Ralph handoff 优先

1. 当前会话 `RALPH-*/run.json` → `artifact_refs.handoff_ref`。
2. 主入口：`run.handoff`；镜像可选 `.../handoff/handoff.json`。
3. `ready=true`：直接迁目标；**禁止**重做源分析。
4. `ready=false` 且仅未提交：先提交源，刷新 handoff，再迁。
5. 无 Ralph handoff 时再退回旧 snapshot / 会话证据路径。
6. 默认 `LITE`；明显 ADAPT/多文件/持续同步才 FULL。

## 双门禁 + 五项门禁

| 门禁 | 作用 |
| --- | --- |
| `EXECUTION_READY` | 现在能否编码 |
| `HANDOFF_READY` | 现在能否宣称交接完成并推进检查点 |

- 源缺 review/UAT、家族计划待补 → 默认 caveat，**不**挡编码；硬阻塞见 [happy-path.md](references/happy-path.md)。
- 用户「开始迁移/实施/开干」→ `EXECUTE_NOW`：核对后下一项必须是业务代码或聚焦测试。
- 五项（均须证据）：**稳健 / 剃刀 / 精准 / 最小化 / 复用**（短定义见 happy-path）。

## 项目族 + 控制面边界

`2×3` 矩阵（承接/兑接/承载 × 前台/后管）；路径与方向 → [project-family.md](references/project-family.md)。同行默认 sibling；前后台不自动同步。只改明确授权目标。

| 场景 | 规则 |
| --- | --- |
| 有 control | **只读** manifest 批准的角色与 `targets`/`task_key`；不自创控制任务 |
| 无 control | 兼容 `源=A 目标=B,C`；**家族计划 ≠ dispatch 批准** |

## 证据入口（指针）

- **会话**：`read_thread` / sessions JSONL；`python -X utf8 scripts/extract_session_evidence.py --thread-id '…'`
- **分支/commit**：`merge-base..feature-ref`；`node scripts/collect-port-evidence.mjs --source-repo … --source-base … --source-ref … --target-repo …`
- **混合**：会话(为何) × 分支(改了啥) × 当前需求(最终) × 目标源码(怎么最小实现)
- **handoff_ref**：freshness + `REUSE/REFRESH/…` → [handoff-snapshot.md](references/handoff-snapshot.md)

长脚本与 prose → [workflow-core.md](references/workflow-core.md#证据入口)。

## 产物路由

按输入选最短路径：快速实施 / 标准发现 / 快照复用。canonical 路径与注册 → [artifact-routing.md](references/artifact-routing.md)。事实充分优先于产物数量；交接产物在 `HANDOFF_READY` 前补齐。决策标签：`DIRECT / ADAPT / EXTEND / BLOCKED / N/A`。

## 硬约束 / MUST NOT

- MUST：开干前 branch-purpose preflight；`EXECUTION_READY` 才改业务码；`HANDOFF_READY` 才宣称交接完成。
- MUST NOT：整分支 cherry-pick / 整文件覆盖（除非同构无专有逻辑）；自动更新本地 `master`；改未授权仓；私有 `.workflow/jj-same/`；无 control 时伪造成 dispatch 批准；聊天摘要替代 Git/源码证据。
- 未明确要求时不擅自提交/推送；不常驻监听源仓。

## References

| 文件 | 用途 |
| --- | --- |
| [happy-path.md](references/happy-path.md) | 主路径、双门禁、五项、控制面边界 |
| [workflow-core.md](references/workflow-core.md) | 生命周期、证据、产物细节、工作流 1–7、交付格式 |
| [project-family.md](references/project-family.md) | 角色与路径 |
| [branch-purpose-preflight.md](references/branch-purpose-preflight.md) | 分支用途硬门 |
| [artifact-routing.md](references/artifact-routing.md) | 产物路由 |
| [handoff-snapshot.md](references/handoff-snapshot.md) | 交接快照 |
| [continuous-sync.md](references/continuous-sync.md) | 持续同步 |
| [silence-account-case.md](references/silence-account-case.md) | 沉默账户案例 |

## 调用示例

```text
$jj-same 会话=019f... 当前需求=保留密码入口 源=承接前台 目标=兑接前台,承载前台
$jj-same 准备交接 会话=019f... 源提交=c0c360f9d 功能=密码更新提醒
$jj-same 交接=@…/handoff-snapshot.yaml 当前项目=兑接 开始迁移
$jj-same 同步 SYNC-silence-login，检查 A 从上次成功基线到 HEAD 的更新并同步到 B
$jj-same 源修改完成，列出可同步项目并询问立即同步还是延期
```
