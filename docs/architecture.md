# 架构

## 一句话

`jj-flow` 是 Maestro 上层的交付编排协议：它只负责把项目交付需求翻译成 Maestro 能执行的 prompt、上下文包和调用链。`jj` 只是一个简单标识，不代表组织或业务品牌。

## 数据流

```mermaid
flowchart LR
  A[用户输入 /jj] --> B[jj-flow 路由]
  B --> C[Recipe]
  B --> D[Evidence]
  C --> E[Guard]
  D --> E
  E --> F[Maestro Prompt]
  F --> G[Maestro Skills]
```

## 核心模块

- `bin/jj.mjs`：CLI 入口。
- `src/cli.mjs`：命令参数解析和内部 CLI 调度，供入口和测试复用。
- `src/dispatch.mjs`：模式识别、prompt 生成、Markdown/JSON 输出。
- `src/recipes.mjs`：`delivery`、`validate`、`evolve`、`feat`、`fix`、`knowhow`、`review` 的流程定义。
- `src/evidence.mjs`：证据结构。
- `src/evidenceProviders.mjs`：把 YApi、ARMS/SLS、禅道等工具输出转换成标准 evidence JSON。
- `src/guards.mjs`：判断证据是否足够，不足时保持 `PENDING`。
- `src/maestroCompatibility.mjs`：检查 Maestro CLI 是否可用、版本是否兼容，并把缺失或不兼容状态输出为 evidence。
- `src/maestroExecution.mjs`：基于 intent、evidence、guard 和 Maestro 兼容性生成可选执行决策。
- `src/knowledgeLoop.mjs`：把完成的交付整理成 knowhow、spec 或 workflow recipe 捕获计划，并生成团队协作上下文。
- `src/projectValidation.mjs`：读取项目文件、`.workflow`、文档、recipe 和测试状态，生成 `$jj validate` 证据。
- `src/projectEvolution.mjs`：把自检证据转换成 correction backlog、升级计划和边界证据。
- `scripts/build-docs.mjs`：把 `docs/*.md` 生成 GitHub Pages 可部署的静态站点。
- `skills/jj/SKILL.md`：Codex skill 草案。

## 关键决策

### 保持薄入口

原因：`catlog22/maestro-flow` 已经提供 intent routing、workflow orchestration、knowledge system 和 multi-agent dispatch。`jj-flow` 不重复这些能力，只把项目级真实证据和交付边界注入进去。边界是明确的：不 fork Maestro core，不把 `/jj` 做成重型编排引擎。

### 证据优先于结论

如果没有 YApi、ARMS/SLS、diff、测试、禅道任务等证据，guard 只能给 `PENDING`，不能因为模型写得像就算通过。

### 证据适配器只做转换

证据适配器的职责是把外部工具输出转换成 `src/evidence.mjs` 可接受的 JSON，不直接替代外部工具。适配器必须区分 3 类状态：成功输出标准 evidence，字段缺失或部分输出保持 `PENDING`，工具失败输出 `FAIL`。这样 `$jj` 后续可以基于真实 evidence 推进，而不是把工具失败包装成通过。

### Recipe 按证据类型收口

Recipe 的 guard 会把证据要求落到具体类型：功能交付要求接口、设计和测试 evidence；线上修复要求 ARMS/SLS、root cause 和验证 evidence；知识沉淀与交付审查要求来源、diff、测试或复盘证据可追溯。这样 `$jj` 只负责判断证据是否足够，具体执行仍交给 Maestro。

### 先输出 prompt，后续再执行

第一版默认不直接调用外部工具，先让输出稳定、可读、可测试。等 recipe 稳定后，再接真实 `maestro` CLI 和 npm 工具。

### 自检后再迭代

`$jj validate` 先读取当前项目状态、文档、recipe、guard、测试和 `.workflow`；`$jj evolve` 再把 validate evidence 转换成 correction backlog 和下一轮升级计划。这样项目管理入口的默认动作是自我验证、自我纠正，再进入下一项功能升级。这个管理入口仍是 Maestro 上层协议，不依赖未文档化的 Maestro core 行为。

### Maestro 兼容性先报告

`jj-flow` 不假设 Maestro 一定可用。`$jj validate` 会报告 Maestro 兼容性：CLI 缺失、不兼容或无法解析版本时都作为 evidence 输出，后续 `$jj evolve` 再决定是修正环境、延后执行，还是继续只生成 Maestro prompt。

### 执行决策不是执行引擎

`jj-flow` 可以根据 intent、evidence、guard 和 Maestro 兼容性输出 `execution_decision`：证据不足时 `disabled`，guard 失败或 Maestro 不兼容时 `blocked`，证据和兼容性都满足时才是 `ready`。它只决定是否应该进入 Maestro 调用链，不在 `jj-flow` 内重写 Maestro 编排。

### 交付完成后进入知识闭环

当 guard 和证据足够时，`jj-flow` 会输出 knowledge loop package：捕获目标可以是 `knowhow`、`spec` 或 `workflow_recipe`；团队协作者可以看到 evidence 摘要、guard 状态、execution decision 和下一步动作。这个闭环只组织上下文和捕获计划，不修改 Maestro core。

### 少参数 delivery

`$jj delivery` 是 Codex 内的端到端入口，不要求用户先传固定的 PRD、接口或设计参数。它先把当前项目、`.workflow`、用户消息、Codex 线程链接和已有资料整理成 Maestro 可消费上下文；只有阻塞交付边界、方案取舍或上线风险时才要求用户决策。

### 文档站是长期表面

GitHub Pages 文档站从 `docs/` 生成，和 CLI、recipe、guard 一样纳入 `npm run verify`。原因是 `jj-flow` 会长期维护，README 只负责快速入口，完整使用、架构、规划、维护和部署说明必须能稳定发布、可链接、可回归检查。

文档站的主体内容必须解释安装方式、每个 `$jj` 命令什么时候用、要给什么、使用方案和会得到什么。首页可以提供导航，但不能替代命令参考和安装说明。
