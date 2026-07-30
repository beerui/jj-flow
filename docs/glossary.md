# 术语与缩写

这页解释文档里常见的命令名、缩写和项目术语。第一次使用只需要知道 `$jj-same` 或 `/jj-same`。

## 项目标识

- `jj`：简单命令标识，不代表组织或业务品牌。
- `jj-flow`：项目族编排工作流。在 Codex / Claude / Grok / Qoder 中提供同源迁移（same）、单仓闭环（ralph）与多项目调度（dispatch，Claude 无薄命令）。产品定义中心是编排协议，不是外部工具适配层。
- `$jj-*`：Codex 内触发 `.codex/skills/jj-*/SKILL.md` 的缩写命令前缀，主推连字符写法。
- `/jj-*`：Claude 薄命令（`.claude/commands/`）或 Grok/Qoder skill slash（`user-invocable`），主推连字符写法。
- `$jj` / `/jj`：兼容入口，按优先级路由到 same / ralph / dispatch。
- `jj` CLI：仓库内安装、维护、ralph 机械步骤和调试命令；业务分析/编码主入口仍是对话 skill。

## `jj-*` 缩写命令

- `$jj-same` / `/jj-same`：跨同源分叉项目迁移与持续同步入口。用于基于会话、需求、分支、commit、diff 或 handoff 首次迁移功能，并按上次成功检查点同步后续更新、修复和需求变更。
- `$jj-ralph` / `/jj-ralph`：单仓全流程自治闭环。需求分析 → 计划实施 → 验收完成 → 归档；产物在 `.workflow/ralph/`，能力地图在 `business-map.json`。
- `$jj-dispatch` / `/jj-dispatch`：多项目调度入口。在业务仓会话发起；协调状态默认 **`~/.jj-flow`**（用户主目录，自动创建；可用配置覆盖）。不要求打开或每波新建控制仓。Codex / Grok / Qoder 可装；**无** Claude 薄命令。写任务默认 `project-branch`；isolation 时才 `exclusive-worktree`。
- `delivery_id`：控制平面里一次跨项目交付任务的稳定身份，不是对话命令名。
- `control_root`：调度状态根目录（`control-plane.json` / task 索引）。产品默认 `~/.jj-flow`；配置项 `dispatch.control_root`。
- `portfolio_root`：项目族顶层目录（业务仓 / map / knowledge 所在树）。可选；配置项 `dispatch.portfolio_root`。
- `naming.json`：全局命名与目录 SSOT，位于 `$JJ_GLOBAL_CONFIG_DIR/naming.json`（Windows 未设 env 时默认识别 `D:/a/config/naming.json`）。
- `project-branch`：写任务默认 workspace 模式——命名 feature 分支 + 项目主路径（与 same 一致）。
- `exclusive-worktree`：隔离用独占 git worktree；仅并发写 / 脏主仓 / 用户显式要求时使用。
- `Handoff snapshot`：源侧不可变迁移交接清单。ralph 完成后可把交接包写到 `.workflow/handoffs/` 供 same 读取；迁移实现不在 `.workflow/ralph/` 下完成。
- `Ralph run`：一次单仓闭环实例，身份为 `RALPH-*`，状态在 `run.json`。
- `Business map`：跨 run 累积的能力地图（`business-map.json`），供下次会话 `map-find` 检索历史经验与任务。

## 交付协议术语

- `Recipe`：某类任务的流程定义。普通用户不需要直接关心它。
- `Evidence`：可追溯证据，例如 PRD、YApi 契约、ARMS/SLS 日志、diff、测试结果和交付记录。
- `Guard`：证据检查规则。证据不足时保持 `PENDING`，不能把猜测当作通过。
- `Context package`：交付上下文包，包含用户目标、资料来源、项目状态、约束、风险和关键决策。
- `工作提示词`：交给 agent 或 CLI 的结构化提示。
- `Correction backlog`：自检后生成的修正清单，用于优先处理文档、代码、测试或 workflow 漂移。
- `Workflow`：由 skills、commands、control-plane manifest、证据和验证门禁共同定义的项目交付流程。
- `Spec`：可复用规范或约束，用于沉淀项目级规则。
- `Knowhow`：可复用经验，重点记录触发条件、证据、决策和复用方式。
- `Sibling project`：同源但已分叉演进的项目。迁移时只能复用需求语义和目标项目模式，不能默认复制源文件。
- `Control root` / 控制状态根：调度落盘目录（默认 `~/.jj-flow` 或配置的 `control_root`），只保存 delivery、intent、task 索引与 artifact 引用，不承载业务需求正文或源码。用户日常**不必**打开该目录；从业务仓发起即可。
- `Origin project`：需求或 bug 最先出现的项目，不等于永久基线，也不必是本轮领头项目。
- `Requirement owner`：持有正式 `ANL-SOURCE / BLP/REQ / Handoff Snapshot` 的项目。
- `Lead project`：本轮首先实施的项目，可以与 origin 或 requirement owner 不同。
- `Reference implementation`：经过验证后可供其它目标参考的稳定 commit 和 snapshot；初始为空，不能因项目是基线就自动设置。
- `Dispatch intent`：创建 Codex task 前先写入控制项目的派发意图，使用稳定 `task_key` 保证重试不会重复创建任务。
- `Migration ledger`：迁移需求账本，通常包含 `MUST`、`TARGET-ONLY`、`DO-NOT-PORT` 和 `UNRESOLVED`。
- `Sync contract`：A/B 项目间某项功能的稳定同步关系，包含 `sync_key`、源/目标、功能范围、目标专有差异、排除项和触发策略；源项目保存 outgoing 索引，目标项目保存 incoming arch spec。
- `Sync checkpoint`：目标项目最近一次验证通过且评审无阻塞的同步点；它记录对应的源 commit，只有目标交付成功后才能推进。
- `Deferred sync`：用户选择暂不把当前源增量同步到某个目标。它以目标项目 open issue 保存，保持同步基线不变，恢复时从最近成功检查点重新计算累计范围。

## 外部工具和资料

- `Codex`：运行 `$jj-*` skill 和代码修改的对话环境。
- `Claude Code`：运行 `/jj-*` slash command 和代码修改的对话环境。
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
## 使用心智模型

- `Loop Engineer`：关注单点闭环——行动、反馈、修正、停止条件。对应 `$jj-ralph` / `$jj-review` 与 verification 证据。详见 [Loop 与 Graph 上手](loop-graph-guide.html)。
- `Graph Engineer`：关注多点编排——角色、依赖、批准、恢复。对应 `$jj-dispatch` 的 `task_key`、批准快照与 receipt。详见 [Loop 与 Graph 上手](loop-graph-guide.html)。

## 记忆与知识库

| 术语 | 含义 |
| --- | --- |
| Portfolio KB / 顶层知识库 | 跨项目知识与记忆库；路径可配（`knowledge_root` / `PORTFOLIO_KB_ROOT`，本机常为 `D:/a/knowledge`） |
| knowledge_refs | 挂到 ralph run / plan 的知识条目 id 列表 |
| candidate / active / deprecated | 知识生命周期：候选 / 已审核 / 退役 |
| extract / promote | 抽取与审核晋升 |
| provenance | source_path / run_refs / evidence 等溯源 |
| doctor | 知识库健康自检（索引、active、Web 等） |
| human-review | 人工复核队列（策略分不够高的必须过人） |
