# 术语与缩写

这页解释文档里常见的命令名、缩写和项目术语。第一次使用只需要知道 `$jj-same` 或 `/jj-same`。

## 项目标识

- `jj`：简单命令标识，不代表组织或业务品牌。
- `jj-flow`：给 Codex 和 Claude Code 用的项目族入口，负责同源迁移与多项目调度边界。
- `$jj-*`：Codex 内触发 `.codex/skills/jj-*/SKILL.md` 的缩写命令前缀，主推连字符写法。
- `/jj-*`：Claude Code 内触发 `.claude/commands/jj-*.md` 的 slash command 前缀，主推连字符写法。
- `$jj` / `/jj`：兼容入口，默认路由到 same。
- `jj` CLI：仓库内安装、维护和调试命令，不是普通交付主入口。

## `jj-*` 缩写命令

- `$jj-same` / `/jj-same`：跨同源分叉项目迁移与持续同步入口。用于基于会话、需求、分支、commit、diff 或 handoff 首次迁移功能，并按上次成功检查点同步后续更新、修复和需求变更。
- `$jj-dispatch`：Codex 控制项目中的多项目调度入口。用于预览、批准、派发、恢复和汇总多个固定项目任务；首版没有对应的 Claude `/jj-dispatch`。
- 已移除：`$jj-delivery`、`$jj-validate`、`$jj-evolve` 以及更早的 feat/fix/knowhow/auto/review 入口。
- `delivery_id`：控制平面里一次跨项目交付任务的稳定身份，**不是** `$jj-delivery` 对话入口。
- `Handoff snapshot`：源 `ANL-SOURCE` 内的不可变迁移交接清单。它引用正式 `BLP/REQ`，记录来源指纹、源 commit、coverage、未解决项和验证门禁；多个目标复用同一 snapshot，但仍分别验证目标源码并生成 `ANL-TARGET`。

## 交付协议术语

- `Recipe`：某类任务的流程定义。普通用户不需要直接关心它。
- `Evidence`：可追溯证据，例如 PRD、YApi 契约、ARMS/SLS 日志、diff、测试结果和交付记录。
- `Guard`：证据检查规则。证据不足时保持 `PENDING`，不能把猜测当作通过。
- `Context package`：交付上下文包，包含用户目标、资料来源、项目状态、约束、风险和关键决策。
- `Maestro prompt`：交给 Maestro skill 或 CLI 的结构化提示。
- `Correction backlog`：自检后生成的修正清单，用于优先处理文档、代码、测试或 workflow 漂移。
- `Workflow`：项目交付流程或里程碑状态，通常指 `.workflow/` 下的状态和产物。
- `Spec`：可复用规范或约束，用于沉淀项目级规则。
- `Knowhow`：可复用经验，重点记录触发条件、证据、决策和复用方式。
- `Sibling project`：同源但已分叉演进的项目。迁移时只能复用需求语义和目标项目模式，不能默认复制源文件。
- `Control project`：独立的项目族控制目录，只保存项目注册、delivery、thread、状态、决策和 artifact 引用，不承载业务需求正文或源码。
- `Origin project`：需求或 bug 最先出现的项目，不等于永久基线，也不必是本轮领头项目。
- `Requirement owner`：持有正式 `ANL-SOURCE / BLP/REQ / Handoff Snapshot` 的项目。
- `Lead project`：本轮首先实施的项目，可以与 origin 或 requirement owner 不同。
- `Reference implementation`：经过验证后可供其它目标参考的稳定 commit 和 snapshot；初始为空，不能因项目是基线就自动设置。
- `Dispatch intent`：创建 Codex task 前先写入控制项目的派发意图，使用稳定 `task_key` 保证重试不会重复创建任务。
- `Migration ledger`：迁移需求账本，通常包含 `MUST`、`TARGET-ONLY`、`DO-NOT-PORT` 和 `UNRESOLVED`。
- `Sync contract`：A/B 项目间某项功能的稳定同步关系，包含 `sync_key`、源/目标、功能范围、目标专有差异、排除项和触发策略；源项目保存 outgoing 索引，目标项目保存 incoming Maestro arch spec。
- `Sync checkpoint`：目标项目最近一次验证通过且评审无阻塞的同步点；它记录对应的源 commit，只有目标交付成功后才能推进。
- `Deferred sync`：用户选择暂不把当前源增量同步到某个目标。它以目标项目 open Maestro issue 保存，保持同步基线不变，恢复时从最近成功检查点重新计算累计范围。

## 外部工具和资料

- `Maestro`：底层工作流体系，`jj-flow` 只在它前面组织交付上下文。全部流程禁止调用 `maestro explore`。
- `Codex`：运行 `$jj-*`、Maestro skill 和代码修改的对话环境。
- `Claude Code`：运行 `/jj-*` slash command、Maestro skill 和代码修改的对话环境。
- `PRD`：Product Requirements Document，产品需求文档。
- `YApi`：接口文档和契约来源。
- `ARMS`：前端或应用监控系统，用于线上错误和性能证据。
- `SLS`：日志服务，用于查询线上日志和错误上下文。
- `ZenTao`：禅道，常用于任务、缺陷和工时记录。
- `UAT`：User Acceptance Testing，用户验收测试。
- `ADR`：Architecture Decision Record，架构决策记录。

## 工程与发布

- `CI`：Continuous Integration，持续集成检查。
- `GitHub Pages`：文档站发布目标。
- `Release Please`：根据 Conventional Commits 生成 release PR 和 changelog 的工具。
- `Conventional Commits`：约定式提交格式，例如 `feat:`、`fix:`、`docs:`。
- `npm`：Node.js 包管理器。
- `npx`：执行 npm 包内命令的工具。
- `beta`：预发布标签，当前安装示例使用 `@beta`。
