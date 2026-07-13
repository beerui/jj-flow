# 使用说明

这页只讲真实使用：你该怎么向 Codex 发 `$jj-*` skill，或向 Claude Code 发 `/jj-*` slash command，该给哪些资料，以及什么时候需要补充决策。安装看 [安装](installation.html)，所有命令看 [命令参考](commands.html)。

## 默认从 `$jj-delivery` 开始

```text
$jj-delivery 实现 AI 获客列表、详情和精修验收
/jj-delivery 实现 AI 获客列表、详情和精修验收
```

只要这件事需要跨过需求理解、实现、审查和验收，优先用 `$jj-delivery` 或 `/jj-delivery`。你不需要先准备 `--prd`、`--api`、`--design` 这类固定参数。

常用缩写直接按任务类型写：

```text
$jj-delivery <完整交付需求>
$jj-fix <线上问题和错误指纹>
$jj-review <审查目标和风险关注点>
$jj-knowhow <要沉淀的交付或问题>
$jj-same <会话、需求、分支和目标项目>
```

在 Claude Code 中把 `$` 换成 `/`，例如 `/jj-fix`。

好的输入通常包含 4 件事：

- 要完成什么。
- 资料在哪里，例如 PRD、YApi、MasterGo、截图、日志、历史线程。
- 本次边界是什么，特别是不做什么。
- 什么结果算完成。

示例：

```text
$jj-delivery
需求：实现 AI 获客列表和详情。
资料：PRD 在 docs/v17.1，接口看 YApi 链接，设计图是 MasterGo 链接。
范围：本期不做导出。
验收：页面还原设计，接口字段真实，测试通过。
```

如果资料还没整理好，也可以先给线索：

```text
$jj-delivery 按 PRD、接口文档和设计图完成页面交付
$jj-delivery 参考 codex://threads/019f2ba4-2c09-7750-8a77-a2e9b3b9093b 总结流程并完成后续交付
```

## 你会看到的过程

`$jj-delivery` / `/jj-delivery` 会先做和交付有关的事情，而不是直接写代码：

1. 说明它找到了哪些资料，还缺哪些关键证据。
2. 确认本次范围和不做范围。
3. 给出实现和验证计划。
4. 进入代码修改、审查、测试或 UI 精修。
5. 对不能自动验证的部分标出待确认。

它只会在答案会改变结果时问你，例如：

- 需求边界不清楚。
- 有多个实现方案会影响后续维护。
- 权限、登录态、后端环境或线上风险需要你确认。
- 资料缺失会导致只能猜。

## 提供资料的方式

直接把资料写进 Codex 对话即可：

- PRD 或需求文档路径。
- YApi、接口文档或真实请求记录。
- MasterGo、截图或设计图链接。
- Codex 历史线程，例如 `codex://threads/...`。
- 必须由用户拍板的业务决策。

缺少资料时，`jj-*` 命令应该把相关项标成待确认，而不是把猜测写成已完成。

## 其它常用入口

线上问题用 `$jj-fix`：

```text
$jj-fix 线上 ARMS 在 09:30 到 10:00 出现 TypeError，需要定位根因并最小修复
```

交付前检查用 `$jj-review`：

```text
$jj-review 审查这次 AI 获客页面改动，重点看接口字段、设计还原、权限和测试缺口
```

沉淀经验用 `$jj-knowhow`：

```text
$jj-knowhow 把这次真实工作对话沉淀成可复用流程
```

同源项目之间迁移功能、修复或产品调整，用 `$jj-same`：

```text
$jj-same 会话=019f... 当前需求=保留密码入口 源=承接前台 目标=兑接前台,承载前台
```

它适合 `承接 / 兑接 / 承载` 前台或后管之间的改动迁移。输入可以是 Codex 会话 ID、需求文档、功能分支、commit 或 diff；输出必须先还原最终需求，再按 `稳健 / 剃刀 / 精准 / 最小化 / 复用` 做迁移矩阵和最窄实现。

`$jj-same` 不是等承接项目开发完成后才进入。只要当前需求已明确属于同源项目族，就从当前领头项目的分析阶段建立家族交付计划，并持续更新项目顺序、分支映射、产物状态、验证结果和下一项目门禁。默认顺序为 `cj -> dj -> cz`：承接项目完整开发并验证后，才允许进入兑接项目；兑接项目完整开发并验证后，才允许进入承载项目。用户明确指定其它领头项目或顺序时，以当前要求和项目事实为准，不倒推补做不在范围内的项目。

领头项目的开发分支由用户创建。后续项目只在前置项目通过门禁、且用户在新会话中主动引用前一会话 ID 后，才从该项目本地 `master` 创建分支；`$jj-same` 不自动切换或提前创建后续分支。分支名只替换项目角色前缀，保留类型、发布日期和任务序号：

```text
feat/cj-0717   -> feat/dj-0717   -> feat/cz-0717
feat/cj-0717-1 -> feat/dj-0717-1 -> feat/cz-0717-1
```

本地 `master` 不存在、工作区不干净、分支名无法按规则解析，或前置项目没有稳定 commit、验证与评审证据时，后续项目保持 `BLOCKED`。命名中的任务序号标识同一发布日期下的第几个任务，跨项目同步同一任务时必须保持一致，不能把项目顺序误写成任务序号。

家族交付计划只负责跨项目协调，记录 `cj / dj / cz` 的顺序、状态、分支、会话 ID、artifact refs、验证证据、差异假设和下一门禁。每个目标项目仍必须重新执行 `ANL-TARGET -> PLN -> EXC/VRF -> REV`，不能因为计划中已有占位任务就复制领头项目实现。开发或修复过程中发现需求变化、目标差异、阻塞或验证结果时，必须先更新家族交付计划，再决定是否继续当前项目或解锁下一个项目。

跨会话交接至少携带：前一会话 ID、领头项目与当前项目路径、业务角色、分支、HEAD、已验证 commit range、`BLP/ANL/PLN/VRF/REV` 引用、家族交付计划位置、下一目标及派生分支名、未解决项和 `TARGET-ONLY / DO-NOT-PORT`。新会话必须重新验证 Git 和目标源码事实，不能把旧会话摘要当作当前事实。

遇到信息缺口时，先从当前需求、会话、Git、项目文档和源码验证；仍不明确时，只采用不扩大项目范围、不新增产品行为且可回退的最窄默认值，并在计划中记录假设。无法安全推断且会影响 `MUST`、验收标准、目标项目集合或不可逆实现时，直接记录为 `BLOCKED`，说明缺失证据和解除条件，不启动额外的需求拷问流程。

`$jj-same` 产生的中间文档遵循 Maestro 的产物规范，不创建 `.workflow/jj-same/` 之类的私有目录：

1. 会话或分支总结由 `maestro-analyze` 生成，保存到 `.workflow/.csv-wave/{日期}-analyze-{主题}/`，并在 `.workflow/state.json` 注册 `ANL-*`。
2. AI 可执行需求由 `maestro-blueprint` 生成，保存到 `.workflow/blueprint/BLP-{主题}-{日期}/`；正式需求位于 `requirements/REQ-*.md`，同时保留 readiness 与 traceability 产物。
3. 目标项目评审再次使用 `maestro-analyze --from blueprint:BLP-*`，形成独立的目标差异分析和迁移决策。
4. 评审通过后才由 `maestro-plan --from analyze:ANL-*` 生成 `.workflow/scratch/{日期}-plan-P{阶段}-{主题}/plan.json` 和 `.task/TASK-*.json`，再进入 `maestro-execute` 与 `quality-review`。

`.workflow/.maestro/*/status.json` 只保存 Maestro 编排状态，不承载需求正文；`.workflow/specs/` 只用于交付后沉淀的跨任务稳定规则，不存放单次迁移文档。目标项目尚未初始化 `.workflow/` 时，应先执行 `maestro-init`，再生成上述正式产物。

如果目标不是只迁移一次，而是让 A 项目的同一功能后续持续同步到 B，首次迁移成功后还要建立 `sync_key`：

```text
$jj-same 建立持续同步：功能=沉默账户登录 源=A 目标=B，首次迁移并记录同步基线
$jj-same 同步 SYNC-silence-login，检查 A 从上次成功基线到 HEAD 的更新和 bug 修复，并同步到 B
```

稳定的同步范围、源/目标仓库、目标专有差异和排除规则通过 `maestro spec add arch` 写入两端：A 的 `.workflow/specs/architecture-constraints.md` 保存 outgoing 目标索引，B 保存 incoming 同步契约。当前游标不手工写进 spec，而是从 B 最近一次成功产物链反查；只有 B 实施完成、验证通过且评审无阻塞，或目标分析有证据证明本轮全部增量无需修改时，才把本次 A 的 `source_head` 视为新的同步基线。

后续每次同步只检查 `last_source_head..current_source_head`：产品行为变化时生成新的 blueprint 需求增量；不改变产品契约的 bug 修复复用原 blueprint，但仍重新分析 B 是否存在相同根因。B 已有本地修改时做三方比较并按 B 的原生架构适配，不覆盖目标专有逻辑。A 中与该功能无关的重构、格式化和其它模块改动继续进入剃刀排除项。

`$jj-same` 是同步执行入口，不是后台常驻监听器。需要“A 一修改就通知 B”时，在 A 的 CI 中发送包含 `sync_key`、`before_sha`、`after_sha` 和变更路径的同步事件，再由 Codex/Claude Code 执行 `$jj-same` 并创建 B 的 PR；默认不静默修改或自动合并 B。

源项目修改和验证完成后，`$jj-same` 不能直接开始同步。它必须先展示并核对：项目根目录、`origin`、项目角色、当前分支、`HEAD`、工作区状态和源验证结果；当前仓库或分支与同步契约不一致、处于 detached HEAD，或变更尚未形成稳定 commit 时，只能报告候选项目，不能推进同步。

核对通过后，列出所有可同步项目及状态：已有同步关系且存在增量的目标标记 `READY`；没有新增量的标记 `ALREADY_SYNCED`；同项目族但尚未建立关系的标记 `ELIGIBLE`；延期中的标记 `DEFERRED`；分支、工作区、权限或依赖不满足的标记 `BLOCKED`；业务场景不适用的标记 `N/A`。随后按目标项目询问用户选择：

- `SYNC_NOW`：立即分析并同步。
- `DEFER`：本次延期，不修改目标，也不推进同步基线。
- `NOT_APPLICABLE`：用户明确确认本次变化不适用于该目标，记录原因并形成零改动检查点。
- `PAUSE_RELATION`：暂停后续提示；通过新的 Maestro arch decision 保留审计记录，不直接删除旧同步契约。

延期同步通过 `manage-issue` 在目标项目 `.workflow/issues/issues.jsonl` 创建或更新一个 open issue，tag 包含 `jj-same`、`sync-deferred` 和 `sync_key`。issue 记录源/目标项目与分支、成功检查点、`before_sha`、`after_sha`、延期原因和恢复条件。相同 `sync_key + target` 再次延期时不重复建 issue，而是保留最早未同步起点、更新最新源 HEAD。恢复同步时仍从最近成功检查点重新计算完整范围；只有同步成功或形成有证据的零改动检查点后才关闭 issue。

如果你在维护 `jj-flow` 项目本身，再使用 `$jj-validate` 和 `$jj-evolve`：

```text
$jj-validate 检查当前项目状态，给出下一步升级建议
$jj-evolve 基于当前自检结果推进下一项项目管理能力
```
