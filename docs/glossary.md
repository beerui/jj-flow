# 术语与缩写

这页解释文档里常见的命令名、缩写和项目术语。第一次使用只需要知道 `$jj` 和 `delivery`。

## 项目标识

- `jj`：简单命令标识，不代表组织或业务品牌。
- `jj-flow`：给 Codex 用的交付入口，负责先整理需求、资料、边界和验证要求，再推进实现。
- `$jj`：Codex 内触发 `skills/jj/SKILL.md` 的 skill 入口。
- `jj` CLI：仓库内维护、安装和调试命令，不是普通交付主入口。

## `$jj` 命令

- `delivery`：端到端交付入口。用于需求需要跨分析、计划、实现、审查、测试和精修的场景。
- `validate`：项目管理者自检入口。用于检查文档、规则、测试、workflow 和路线图漂移。
- `evolve`：项目自身迭代入口。用于把自检结果转换成修正清单和升级计划。
- `feat`：feature 的缩写。用于边界明确的新功能交付。
- `fix`：修复入口。用于线上问题、异常、回归或错误指纹定位与修复。
- `review`：交付前审查入口。用于检查 diff、计划、测试证据和发布风险。
- `knowhow`：知识沉淀入口。用于把真实项目经验转成可复用规则、模板或 spec。
- `auto`：自动分类入口。当前只作为辅助判断，不推荐作为长期主入口。

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

## 外部工具和资料

- `Maestro`：底层工作流体系，`jj-flow` 只在它前面组织交付上下文。
- `Codex`：运行 `$jj`、Maestro skill 和代码修改的对话环境。
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
