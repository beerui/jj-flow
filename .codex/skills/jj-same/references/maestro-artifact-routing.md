# Maestro 产物路由

`jj-same` 负责恢复迁移需求和选择目标，正式文档与状态必须由对应 Maestro skill 生成并注册。不要在目标仓库中创建 `.workflow/jj-same/` 或其它私有产物目录。

## 产物归属

- 无 handoff snapshot 的单目标标准发现：目标仓库拥有完整的 `ANL -> BLP -> ANL -> PLN -> EXC/VRF -> REV` 链。
- 快速实施：用户明确授权实施，稳定源 commit/diff、最终需求来源和目标调用链足以形成 `EXECUTION_READY` 时，复用已有 canonical refs；缺失时先在 `ANL-TARGET` 保存带来源的最小 ledger，再生成最窄 `PLN -> EXC/VRF -> REV`。不得仅为形式完整在编码前重建全量源分析或 blueprint；交接所需 canonical 产物在 `HANDOFF_READY` 前补齐。
- 准备交接模式：源 artifact 归属仓库拥有共享 `ANL-SOURCE`、`BLP/REQ` 和 handoff snapshot；一个或多个目标都只拥有各自的 `ANL-TARGET -> PLN -> EXC/VRF -> REV`。
- 多目标迁移：准备交接模式默认由源 artifact 归属仓库生成一次共享源分析、blueprint 和 snapshot；未准备 handoff 时必须先明确一个已授权归属仓库。每个目标仓库只生成自己的目标分析、计划、执行与评审产物。
- 家族交付计划：存在 `$jj-dispatch` 控制项目时，控制 manifest 持有跨项目任务、thread、状态、决策和 artifact 引用，领头项目只持有自己的 canonical `PLN`；没有控制项目时，继续由领头项目持有一份跨项目协调 `PLN`。两种方式都不替代各目标仓库自己的实施 `PLN`。
- 迁移交接快照：由共享源分析的归属仓库持有，保存在 `ANL-SOURCE/requirement-baseline/{snapshot_id}/handoff-snapshot.yaml`；多个目标通过直接 path 复用，不复制到目标仓库。
- 当前仓库不是目标仓库时，在开始前明确共享 blueprint 的归属仓库。其它目标通过 `@file` 或直接 path 消费该 blueprint，不复制一套无法追溯的需求文档。
- 每个仓库的 artifact ID 只在自己的 `.workflow/state.json` 中解析；跨仓库时不要假设 `blueprint:BLP-*` 或 `analyze:ANL-*` 能自动跨仓库解析。

## Canonical 路由

| 阶段 | 负责 skill | canonical 产物 | 状态注册 |
|---|---|---|---|
| 初始化 | `maestro-init` | `.workflow/project.md`、`.workflow/state.json` | init artifact |
| 持续同步契约 | `maestro spec add arch` | 源项目 outgoing 索引与目标项目 incoming 契约，均位于各自 `.workflow/specs/architecture-constraints.md` | spec entry |
| 源证据总结 | `maestro-analyze` | `.workflow/.csv-wave/{YYYYMMDD}-analyze-{slug}/context.md`、`analysis.md`、`conclusions.json`、`context-package.json` | `ANL-*` |
| 迁移交接快照 | `jj-same` 在源分析 artifact 内生成 | `ANL-SOURCE/requirement-baseline/{snapshot_id}/handoff-snapshot.yaml`，只引用 `BLP/REQ` 和来源证据 | 随所属 `ANL-*`；`context-package.json` 只登记 `handoff_ref` |
| 正式需求 | `maestro-blueprint` | 标准发现或交接完成前生成 `.workflow/blueprint/BLP-{slug}-{date}/product-brief.md`、`requirements/REQ-*.md`、`readiness-report.md` 等实际需要的 canonical 文件 | `BLP-*` |
| 家族协调计划 | `jj-dispatch` 控制 manifest；无控制项目时用 `maestro-plan` | 控制项目只保存协调状态和 artifact refs；无控制项目时使用领头项目 `.workflow/scratch/{YYYYMMDD}-plan-P{N}-{slug}/plan.json` | 控制 `delivery_id`；无控制项目时为 `PLN-*` |
| 目标项目评审 | `maestro-analyze --from blueprint:BLP-*`；跨仓库使用 blueprint path | 目标仓库自己的 analyze session，包含 `context.md`、`analysis.md`、`conclusions.json`、`context-package.json` | 目标仓库的 `ANL-*` |
| 实施计划 | `maestro-plan --from analyze:ANL-*` | `.workflow/scratch/{YYYYMMDD}-plan-P{N}-{slug}/plan.json`、`.task/TASK-*.json` | `PLN-*` |
| 实施与验证 | `maestro-execute` | execute session、计划目录下的 `.summaries/TASK-*-summary.md` 与 `verification.json` | `EXC-*`、`VRF-*` |
| 代码评审 | `quality-review` | 该 skill 的 `context.md` 与 `review.json` | `REV-*` |

目标仓库没有 `.workflow/` 时，先执行 `maestro-init`。不要手工伪造 artifact ID，也不要绕过对应 skill 直接向 `.workflow/state.json` 注册完成状态。

## 内容映射

### 源分析 `ANL-SOURCE`

在源分析中记录：

- 用户当前要求、会话纠正顺序、分支基线、commit 与 diff。
- 真实行为、已回退行为、偶然实现和无关改动。
- `MUST`、`TARGET-ONLY`、`DO-NOT-PORT`、`UNRESOLVED` 初稿。
- 每项结论对应的会话、commit、文件、方法、API 和验证证据。

源分析是证据解释，不是最终产品规格。

### 迁移交接快照

- 源项目形成稳定 commit、正式 `BLP/REQ` 和明确未解决项后，在所属 `ANL-SOURCE` 内生成不可变 snapshot。
- Snapshot 只保存 canonical refs、Source Inventory、source HEAD、coverage、supersession、验证状态和目标待验证差异，不复制需求正文。
- 目标命中有效 `handoff_ref` 时直接消费共享源分析与 blueprint，只生成自己的 `ANL-TARGET` 和后续产物。
- 源变化时在同一 canonical 归属下生成 successor snapshot；目标不得修改或复制共享 snapshot。

### 正式需求 `BLP`

- 把 `MUST` 和确认后的 `TARGET-ONLY` 写成带 RFC 2119 关键词、验收条件和来源追踪的 `REQ-*.md`。
- 把非功能约束写成 `NFR-*.md`。
- 把 `DO-NOT-PORT` 写入 product brief 的 out-of-scope，并进入 readiness traceability。
- 保留 `UNRESOLVED`，不得把推断改写成已确认需求。
- readiness 为 `Fail` 且影响 `MUST` 时停止；为 `Review` 时把 caveat 传给目标分析和计划，不得仅因 review/UAT 证据待补就阻塞快速实施。

### 目标分析 `ANL-TARGET`

每个目标独立记录：

- 需求 `REQ-*` 到目标入口、API、状态、权限、legacy 和测试的映射。
- `DIRECT`、`ADAPT`、`EXTEND`、`BLOCKED`、`N/A` 决策。
- 最小文件范围、剃刀排除项、旧功能保护和验证策略。
- `Locked / Free / Deferred` 决策以及 Go/No-Go 结论。

存在影响 `MUST` 的 `Deferred`、`BLOCKED` 或未解决冲突时，不生成可执行计划。

## 状态边界

- `.workflow/.maestro/{session-id}/status.json` 只保存编排步骤、目标和完成证据，不保存需求正文。
- `.workflow/specs/` 只保存经过交付验证、可跨任务复用的稳定规则。持续同步的 `sync_key`、范围与排除策略可以进入 arch spec；不断变化的 commit 游标以及单次迁移的需求、分析和计划不得写入这里。
- 原始提取报告应被 source analyze session 引用或吸收，不另建长期目录。
- `context-package.json` 只保存 `snapshot_id`、`handoff_ref` 和必要摘要；Source Inventory 实体只存在于 `ANL-SOURCE/requirement-baseline/`。
- 标准发现和快照复用在实现前应能从 `PLN-* -> ANL-TARGET -> BLP-* -> ANL-SOURCE` 追溯。快速实施至少能从 `PLN-* -> ANL-TARGET -> 当前需求/文档/会话 + 稳定源 diff` 追溯，并在 `HANDOFF_READY` 前补齐 canonical refs；实现后继续注册 `EXC-*`、`VRF-*` 和 `REV-*`。

家族协调 `PLN` 从领头项目分析阶段开始维护。标准发现路径在需求 readiness 通过后注册正式 `PLN`；快速实施路径只要求目标 `EXECUTION_READY`，家族计划待补不得阻止当前目标生成独立实施 `PLN`。未来项目仅保留高层占位，不能被当前任务顺手修改。

持续同步时读取 [continuous-sync.md](continuous-sync.md)。后续 bug fix 未改变产品契约时复用原 `BLP-*`；产品行为变化时生成新的 blueprint 增量。同步检查点从最近成功的 `VRF-* / REV-*` 产物链反查，不能因分析完成或源分支已前进而提前更新。
