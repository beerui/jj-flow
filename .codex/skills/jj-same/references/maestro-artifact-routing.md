# Maestro 产物路由

`jj-same` 负责恢复迁移需求和选择目标，正式文档与状态必须由对应 Maestro skill 生成并注册。不要在目标仓库中创建 `.workflow/jj-same/` 或其它私有产物目录。

## 产物归属

- 单目标迁移：目标仓库拥有完整的 `ANL -> BLP -> ANL -> PLN -> EXC/VRF -> REV` 链。
- 多目标迁移：在当前已授权目标仓库中生成一次共享源分析和 blueprint；每个目标仓库分别生成自己的目标分析、计划、执行与评审产物。
- 家族交付计划：由领头项目持有一份跨项目协调 `PLN`，只记录项目顺序、状态、分支映射、会话交接、artifact refs 和解锁门禁；不替代各目标仓库自己的实施 `PLN`。
- 当前仓库不是目标仓库时，在开始前明确共享 blueprint 的归属仓库。其它目标通过 `@file` 或直接 path 消费该 blueprint，不复制一套无法追溯的需求文档。
- 每个仓库的 artifact ID 只在自己的 `.workflow/state.json` 中解析；跨仓库时不要假设 `blueprint:BLP-*` 或 `analyze:ANL-*` 能自动跨仓库解析。

## Canonical 路由

| 阶段 | 负责 skill | canonical 产物 | 状态注册 |
|---|---|---|---|
| 初始化 | `maestro-init` | `.workflow/project.md`、`.workflow/state.json` | init artifact |
| 持续同步契约 | `maestro spec add arch` | 源项目 outgoing 索引与目标项目 incoming 契约，均位于各自 `.workflow/specs/architecture-constraints.md` | spec entry |
| 源证据总结 | `maestro-analyze` | `.workflow/.csv-wave/{YYYYMMDD}-analyze-{slug}/context.md`、`analysis.md`、`conclusions.json`、`context-package.json` | `ANL-*` |
| 正式需求 | `maestro-blueprint` | `.workflow/blueprint/BLP-{slug}-{date}/product-brief.md`、`requirements/REQ-*.md`、`requirements/NFR-*.md`、`architecture/ADR-*.md`、`epics/EPIC-*.md`、`readiness-report.md`、`context-package.json` | `BLP-*` |
| 家族协调计划 | `maestro-plan` | 领头项目 `.workflow/scratch/{YYYYMMDD}-plan-P{N}-{slug}/plan.json`，记录项目顺序、状态、分支与交接门禁 | `PLN-*` |
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

### 正式需求 `BLP`

- 把 `MUST` 和确认后的 `TARGET-ONLY` 写成带 RFC 2119 关键词、验收条件和来源追踪的 `REQ-*.md`。
- 把非功能约束写成 `NFR-*.md`。
- 把 `DO-NOT-PORT` 写入 product brief 的 out-of-scope，并进入 readiness traceability。
- 保留 `UNRESOLVED`，不得把推断改写成已确认需求。
- readiness 为 `Fail` 时停止；为 `Review` 时必须把 caveat 传给目标分析和计划。

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
- 实现前必须能从 `PLN-* -> ANL-TARGET -> BLP-* -> ANL-SOURCE` 追溯；实现后继续注册 `EXC-*`、`VRF-*` 和 `REV-*`。

家族协调 `PLN` 从领头项目分析阶段开始维护。blueprint readiness 前只能记录协调草案和阻塞项，不得生成目标可执行任务；readiness 通过后注册为正式 `PLN`。未来项目仅保留高层占位，直到用户在新会话中主动触发并完成该目标的 `ANL-TARGET`，再在目标仓库生成独立实施 `PLN`。

持续同步时读取 [continuous-sync.md](continuous-sync.md)。后续 bug fix 未改变产品契约时复用原 `BLP-*`；产品行为变化时生成新的 blueprint 增量。同步检查点从最近成功的 `VRF-* / REV-*` 产物链反查，不能因分析完成或源分支已前进而提前更新。
