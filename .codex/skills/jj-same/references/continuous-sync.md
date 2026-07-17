# 持续增量同步

持续同步的对象是功能契约，不是源项目目录。首次把 A 的功能迁到 B 后，建立稳定关系；后续只处理 A 从上次成功同步点开始的有效增量，并继续按 B 的原生架构实现。

## 目录

- [同步契约](#同步契约)
- [家族交付计划](#家族交付计划)
- [成功检查点](#成功检查点)
- [首次迁移](#首次迁移)
- [后续同步](#后续同步)
- [修改完成决策门禁](#修改完成决策门禁)
- [延期同步](#延期同步)
- [自动触发边界](#自动触发边界)

## 同步契约

为每项持续同步关系分配稳定的 `sync_key`，建议格式为 `SYNC-{feature-slug}`。它是业务关系标识，不是 Maestro artifact ID。

首次迁移成功后，通过 `maestro spec add arch` 在源项目写入 `outgoing` 索引，并在每个目标项目写入 `incoming` 契约。两端使用同一个 `sync_key`：

| 字段 | 含义 |
|---|---|
| `sync_key` | 同一功能关系的稳定标识 |
| `direction` | 源项目为 `outgoing`，目标项目为 `incoming` |
| `feature` | 用户可识别的功能或问题域 |
| `source_repo` / `source_ref` | A 项目及跟踪分支或 ref |
| `source_scope` | 属于该功能的入口、能力和已知代码范围 |
| `target_repo` / `target_ref` | B 项目及目标分支 |
| `target_scope` | B 中对应入口和目标专有扩展 |
| `requirement_ref` | 初始或当前有效的 `BLP-* / REQ-*` |
| `target_only` | B 必须保留的专有行为 |
| `exclusions` | 不自动迁移的模块、legacy、生成物和策略 |
| `trigger_mode` | `manual`、`notify` 或 `auto-pr` |

同步契约是稳定规则，写入源项目和目标项目各自的 `.workflow/specs/architecture-constraints.md`。源端索引用于修改完成后发现目标，目标端契约用于验证目标范围与检查点。不要把不断变化的 `last_source_head` 写进 spec。

## 家族交付计划

需求从领头项目开始分析时就建立一份跨项目协调计划，不等源项目开发完成后才发现目标。存在 `$jj-dispatch` 控制项目时，控制 manifest 是跨项目任务、thread、状态和决策的权威记录，领头项目只持有自己的 canonical `PLN` 与 artifact；没有控制项目时继续由领头项目持有家族协调计划。计划至少记录：

- 项目族登记与本轮授权范围。
- 默认或用户确认的交付顺序。
- 领头分支、目标派生分支和本地 `master` 基线。
- 每个项目的 `NOT_STARTED / ANALYZING / IMPLEMENTING / VERIFYING / READY_FOR_USER_TEST / READY_FOR_HANDOFF / COMPLETED / BLOCKED / N/A` 状态。
- 会话 ID、`sync_key`、artifact refs、验证证据、未解决项、`TARGET-ONLY` 和 `DO-NOT-PORT`。
- 当前 `snapshot_id`、`handoff_ref`、source HEAD、freshness 和 successor 关系。
- 下一个项目的解锁条件与用户触发状态。

分析阶段只为未来项目记录高层范围、风险与待验证差异，不把领头项目文件或实现步骤预填为目标任务。blueprint readiness 通过后，使用 `maestro-plan` 生成或更新家族协调 `PLN`；每个目标进入开发前仍须在自己的仓库完成 `ANL-TARGET` 并生成独立实施 `PLN`。

开发、bug 修复、需求纠正、验证、评审、提交和交接任一状态变化后，都要同步更新家族交付计划。计划状态不能替代 Git、`VRF` 或 `REV` 证据。

### 自动推进与显式目标

承接项目领头时默认按 `cj -> dj -> cz` 推荐下一个目标。agent 自动推进前，前置项目仅在以下条件全部满足后成为 `READY_FOR_HANDOFF`：

- 前置项目有稳定 commit，工作区边界已核对。
- 代理侧非浏览器静态与聚焦检查通过。
- 目标分析判定运行时验证必要时，用户已手动完成对应的编译、build、浏览器、E2E 或页面交互测试并明确确认通过；不必要时有证据记录 `N/A` 理由。只有用户主动要求时才由代理执行这些测试。
- `REV` 不阻塞，且没有影响 `MUST` 的未解决项。
- 家族交付计划已经记录最终 HEAD、验证证据、差异和下一目标。

满足上述证据门禁后，agent 才能推荐下一个项目。缺少用户触发时不得自动创建目标分支或修改目标仓库。用户在当前请求已明确指定目标并要求迁移/实施时，不再反向要求其它 sibling 补齐交付证据；改为检查当前目标 `EXECUTION_READY`，满足后从本地 `master` 创建派生分支并直接实施。分支只替换领头分支中的项目角色前缀，保留类型、日期和任务序号。

### 跨会话交接

交接包至少包含：前一会话 ID、`snapshot_id`、`handoff_ref`、snapshot hash、领头/当前/下一项目身份与路径、分支、HEAD、验证 commit range、`BLP/ANL/PLN/VRF/REV` 引用、家族计划位置、派生分支名、未解决项和目标专有边界。新会话先验证 snapshot freshness、Git 和目标源码事实；只有 snapshot 变化、缺失或关联 `UNRESOLVED` 时才重读对应源材料。

## 成功检查点

从 B 的 `.workflow/state.json` 找到相同 `sync_key` 的最近交付链，并沿依赖反查源分析：

```text
ANL-SOURCE-DELTA -> BLP(按需) -> ANL-TARGET -> PLN -> EXC -> VRF
                                                    \-> REV
```

存在两种可推进基线的成功检查点。

**已实施检查点**必须同时满足：

- B 有实际目标 commit。
- `VRF-*` 的 `overall_pass` 为 true，并记录必要的用户手动运行时验收确认，或记录该类验证为 `N/A` 的证据；只有用户主动要求时才使用代理执行结果替代对应人工证据。
- `REV-*` 不是 `BLOCK`。
- 没有影响 `MUST` 的 deferred、blocked 或未解决冲突。

**零改动检查点**只用于本轮全部源增量都被目标分析证据判定为 `N/A`、`NOISE` 或 `DO-NOT-PORT` 的情况。`ANL-TARGET` 必须记录每项处置、证据和 `NO_CHANGE_REQUIRED` 结论，且不存在 `MUST` 影响或未解决项。此路径不伪造 `EXC/VRF/REV`。

除上述零改动路径外，只完成分析、计划失败、实现失败、验证失败或评审阻塞时都不推进检查点。下一次继续使用上一个成功的 `last_source_head`，因此不会跳过尚未落到 B 的 A 项目变更。

找不到成功检查点时，使用同步契约中的首次迁移源 commit 作为初始基线；该 commit 也不可验证时标记 `BLOCKED`，不能猜测范围。

## 首次迁移

1. 按 `maestro-artifact-routing.md` 生成 `ANL-SOURCE -> BLP -> ANL-TARGET -> PLN -> EXC/VRF -> REV`。
2. 在源分析记录 `sync_key`、`source_base`、`source_head` 和功能范围。
3. 在目标分析记录 B 的对应入口、`TARGET-ONLY`、排除项和迁移决策。
4. 验证成功后，通过 `maestro spec add arch` 在 A 建立 outgoing 索引，并在 B 建立 incoming 契约。
5. 把首次迁移的 `source_head` 作为首个成功检查点。

多目标首次迁移在源项目形成可交接状态后先生成一次 handoff snapshot。各目标复用同一共享 `ANL-SOURCE / BLP/REQ`，不得分别重建；目标成功检查点仍分别维护。

## 后续同步

1. 从源项目 outgoing spec 定位目标，再从目标 incoming spec 和最近成功产物链解析 `last_source_head`。
2. 读取当前 A 的 `current_source_head`，确认两端 ref 和工作区状态。
3. 按时间分析 `last_source_head..current_source_head` 的 commit 与 diff；changed paths 只是线索，仍需按功能契约判断归属。
4. 把每项源增量分类为：
   - `REQUIREMENT_CHANGE`：新增、删除或改变产品行为。
   - `BUG_FIX`：不改变产品契约的根因修复。
   - `REFACTOR`：结构变化但外部行为不变。
   - `REVERT`：回退既有行为。
   - `NOISE`：格式化、生成物、文档或其它功能改动。
5. 生成 `ANL-SOURCE-DELTA`，明确源范围、分类、需求影响和剃刀排除项。
6. 按分类选择需求产物：
   - 有 `REQUIREMENT_CHANGE`：生成继承旧需求的新 `BLP-*`，只表达需求增量和最新有效状态。
   - 只有 `BUG_FIX`：复用原 `BLP-* / REQ-*`，源 delta analysis 记录根因与修复验收，不重建完整 blueprint。
   - 只有 `REFACTOR` 或 `NOISE`：除非 B 为实现同一需求确实需要，否则不迁移。
   - `REVERT`：先证明是产品反转还是偶然回退；证据不足时保持 `UNRESOLVED`。
7. 有共享需求或 source HEAD 变化时生成 successor handoff snapshot；只补验证证据时可生成 evidence-only successor。Snapshot 更新本身不得推进目标同步检查点。
8. 在 B 做目标分析。比较“上次成功目标状态、B 当前状态、A 新增量”三方，保护 B 在同步后产生的本地改动。
9. 仅迁移 `DIRECT / ADAPT / EXTEND`，同根因不存在的 bug fix 标记 `N/A`。
10. 通过 `maestro-plan -> maestro-execute -> quality-review` 实施和验证。
11. 满足已实施检查点或零改动检查点条件后，才把 `current_source_head` 作为下一次基线。

## 修改完成决策门禁

`jj-delivery`、`jj-feat`、`jj-fix` 或普通开发任务完成源码修改和源项目验证后，先进入 post-change discovery，不直接修改任何目标项目。

### 1. 确认源项目和分支

至少读取并展示：

- `git rev-parse --show-toplevel` 的项目根目录。
- `git remote get-url origin` 的规范化远端地址。
- 项目族业务角色与同步契约中的 `source_repo`。
- `git branch --show-current`、`git rev-parse HEAD` 和契约中的 `source_ref`。
- `git status --short` 与源项目验证结果。

仓库、origin、业务角色或分支不匹配，detached HEAD，source commit 不可解析，或目标 ref 不存在时标记 `BLOCKED`。源修改尚未形成稳定 commit 时标记 `PREVIEW_ONLY`：可以列候选，不能同步或推进检查点。不要自行 checkout、切分支或改写契约来消除不匹配。

### 2. 列出候选目标

优先从当前源项目的 outgoing `sync_key` 索引找目标，再用 `project-family.md` 补充尚未建立合同的同族候选。逐项展示：目标角色、路径、origin、目标分支、同步关系、最近检查点、本次源范围和状态。

| 状态 | 含义 |
|---|---|
| `READY` | 已有合同、项目与分支正确，存在待同步增量 |
| `ALREADY_SYNCED` | 目标已消费当前 `source_head` |
| `ELIGIBLE` | 同项目族且需求适用，但尚未建立同步合同；选择后走首次迁移 |
| `DEFERRED` | 存在相同 `sync_key + target` 的 open 延期 issue |
| `PREVIEW_ONLY` | 源改动尚无稳定 commit，只能预览 |
| `BLOCKED` | 项目、分支、权限、工作区、依赖或检查点不满足 |
| `N/A` | 业务场景或本次变更不适用于该目标 |

### 3. 询问用户

有 `READY`、`ELIGIBLE` 或 `DEFERRED` 目标时，按目标项目让用户选择：

- `SYNC_NOW`：立即同步选中的目标。
- `DEFER`：记录延期，不修改目标、不推进基线。
- `NOT_APPLICABLE`：用户确认本轮不适用；记录理由后走 `NO_CHANGE_REQUIRED`。
- `PAUSE_RELATION`：新增一条 superseding arch decision 将关系设为 paused，保留旧合同审计轨迹。

用户当前消息已明确要求同步到具体目标时，可把该消息视为 `SYNC_NOW`，不重复确认。多个目标不能用含糊的全局“是”替代逐项目选择；可以把采取同一动作的目标分组确认。只有 `READY / ELIGIBLE / DEFERRED` 可进入询问，`BLOCKED` 只报告解除条件。

## 延期同步

`DEFER` 使用 `manage-issue` 在目标项目创建 open issue，不使用会被归档的 final `deferred` 状态。issue 至少记录：

- `sync_key`、源/目标项目、源/目标分支。
- 最近成功检查点、最早未同步 `before_sha`、当前 `after_sha`。
- 延期原因、决定人、决定时间、期望恢复时间或恢复条件。
- tags：`jj-same`、`sync-deferred`、`sync_key` 和目标角色。

创建前扫描 open issues；相同 `sync_key + target_repo + target_ref` 已存在时更新原 issue，不重复创建。保留最早的 `before_sha`，只把 `after_sha` 扩展到最新源 HEAD，并追加变化说明。

恢复同步时重新核对项目和分支，并始终从最近成功检查点计算累计范围，不能仅使用 issue 中最后一次事件范围。成功形成已实施检查点或零改动检查点后，用 `manage-issue close --status completed` 关闭；同步仍失败或目标仍阻塞时保持 open。到达期望时间只重新提示，不自动执行或推进基线。

## 自动触发边界

`jj-same` 是执行入口，不是 daemon。支持三种触发策略：

- `manual`：用户主动执行 `$jj-same 同步 <sync_key>`，最稳健，默认使用。
- `notify`：A 的 CI 发现相关路径变化后创建同步任务或通知，不修改 B。
- `auto-pr`：A 的 CI 发送事件，由具备凭证的 agent 执行同步并在 B 创建 PR；仍需 B 的验证和人工/策略评审。

CI 事件至少包含：`sync_key`、`source_repo`、`source_ref`、`before_sha`、`after_sha`、`changed_paths` 和 compare URL。CI 不负责判断业务语义，也不应直接 cherry-pick 或自动合并 B。
