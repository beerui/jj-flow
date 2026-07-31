# jj-same Happy Path

主路径索引。细则与长流程见 [workflow-core.md](workflow-core.md) 与下方引用。

## 编号主路径

1. **Ralph-handoff-first**：当前会话 `RALPH-*/run.json` → `artifact_refs.handoff_ref` / `run.handoff`；`ready=true` 禁止重做源分析。
2. 解析目标角色与授权范围（用户自然语言；有 control 时只读 manifest）。
3. **分支用途 preflight**（硬门）：[branch-purpose-preflight.md](branch-purpose-preflight.md)。
4. 核对 **`EXECUTION_READY`**；未满足则 `BLOCKED` / caveat，不改业务代码。
5. 最窄计划 + **实施**目标业务代码与聚焦测试（同一轮，不只更新计划状态）。
6. 分层验证与证据（静态/聚焦测试；运行时默认用户确认或 `N/A`）。
7. 五项门禁复审最终 diff。
8. 产物与家族计划最小更新；需要时补 canonical 交接产物。
9. 核对 **`HANDOFF_READY`** 后才写 `READY_FOR_HANDOFF / COMPLETED` 并推进同步检查点。
10. 持续同步场景：恢复 `sync_key` 与检查点 → 见 [continuous-sync.md](continuous-sync.md)。

默认 `port_profile.mode=LITE`（近同构小改）；明显 ADAPT / 多文件 / 持续同步才 FULL。

## 双门禁（短定义）

| 门禁 | 含义 |
| --- | --- |
| **`EXECUTION_READY`** | 用户已授权实施；源行为定位到稳定 commit/diff；最终需求可收敛；目标调用链已验证；无影响 `MUST` 的 `UNRESOLVED`。满足后可编码。 |
| **`HANDOFF_READY`** | 实现完成，聚焦检查通过，`quality-review` 不阻塞，必要运行时验收已确认或 `N/A`。才可宣称交接完成并推进检查点。 |

源侧缺最新 review / UAT PENDING / 家族计划待补，默认是交付 caveat，**不是** `EXECUTION_READY` 阻塞。用户明确「开始迁移/实施/开干」→ `EXECUTE_NOW`：事实核对后下一项必须是业务代码或聚焦测试。

## 五项门禁（短）

每次迁移须有证据回答，不得当口号：

- **稳健**：需求、会话、分支提交与目标调用链交叉验证；保护脏工作区与旧功能。
- **剃刀**：排除与验收无关的文件、提交、文档、格式化、legacy 对齐与顺手重构。
- **精准**：定位目标真实入口/接口/状态/错误处理/专有场景，非只搜同名文件。
- **最小化**：更少文件、更少控制流变化、更窄验证范围。
- **复用**：复用需求语义与目标已有 API wrapper、组件、store、常量、测试模式。

## 控制面边界

| 场景 | 规则 |
| --- | --- |
| **有** `$jj-dispatch` 控制项目 | **只读** manifest：`origin_project`、`requirement_owner`、`lead_project`、`reference_implementation`、`targets`、`task_key`。本 skill 只做迁移/适配/同步检查点；**不**自创控制任务、不改批准快照。 |
| **无** 控制项目 | 兼容 `源=A 目标=B,C`；领头项目可持家族协调计划。**家族计划 ≠ dispatch 批准**，无 `task_key` 权威，不伪造成调度交付。 |

业务任务产物进 `.workflow/` 分类型目录；**禁止** `.workflow/jj-same/` 私有树。`jj-flow` 自身仓库不把 `.workflow` 当事实源。

## 其它 references

| 文件 | 何时读 |
| --- | --- |
| [workflow-core.md](workflow-core.md) | 生命周期、证据入口、产物路由细节、工作流 1–7、交付格式 |
| [project-family.md](project-family.md) | 角色、路径、迁移方向 |
| [branch-purpose-preflight.md](branch-purpose-preflight.md) | 开干前分支用途核对 |
| [artifact-routing.md](artifact-routing.md) | canonical 路径与注册 |
| [handoff-snapshot.md](handoff-snapshot.md) | 准备/消费/更新交接快照 |
| [continuous-sync.md](continuous-sync.md) | `sync_key`、检查点、延期与 post-change discovery |
| [silence-account-case.md](silence-account-case.md) | 沉默账户案例（用前重验分支） |
