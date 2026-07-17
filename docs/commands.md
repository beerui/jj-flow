# 命令参考

## 命令格式

Codex 和 Claude Code 内使用 `jj-*` 缩写命令：

```text
$jj-<命令> <自然语言输入>
/jj-<命令> <自然语言输入>
```

`<自然语言输入>` 可以是一句话，也可以是多段说明。把需求、资料路径、接口链接、设计图、日志、Codex 线程、验收标准和必须由你拍板的决策直接写进去即可。

命令名和缩写解释见 [术语与缩写](glossary.html)。本页主推连字符缩写，例如 `$jj-delivery` / `/jj-delivery`、`$jj-fix` / `/jj-fix`、`$jj-review` / `/jj-review`，不再主推 `$jj delivery` 这类空格写法。本页只回答 3 个问题：什么时候用、要给什么、会得到什么。

安装原生命令资产时使用：

```bash
npx @shendu-sdt/jj-flow@beta install-skill
npx @shendu-sdt/jj-flow@beta install-skill --platform claude
```

## 通用输入

所有 `jj-*` 原生命令都可以接受下面这些信息，不需要整理成固定参数：

- `目标`：要完成什么。
- `资料`：PRD、接口文档、设计图、截图、日志、diff、Codex 线程链接。
- `范围`：本次做什么，不做什么。
- `关键决策`：必须由人确认的业务取舍。
- `验收`：什么结果算完成。

写法示例：

```text
$jj-delivery
目标：完成 AI 获客列表、详情和精修。
资料：PRD 在 docs/v17.1，接口来自 YApi，设计图来自 MasterGo。
范围：本期不做导出。
验收：页面还原设计，接口字段真实，测试和 review 通过。
```

## `$jj-delivery`

### 什么时候用

默认入口。只要一个需求需要跨过理解需求、查资料、实现、审查、测试或 UI 精修，就从它开始。

### 你需要给什么

- `需求`：必填，一句话或多段都可以。
- `资料`：可选但推荐，包括 PRD、接口文档、设计图、Codex 线程。
- `关键决策`：可选，写清用户已拍板的取舍。
- `验收标准`：可选，缺失时由模型根据资料先推导，再保持待确认。

### 使用方案

当需求较完整时，直接把资料一起给 `$jj-delivery`。当资料分散时，只给线索也可以，模型会先自动发现项目上下文和已有项目状态。

```text
$jj-delivery 按 PRD、接口文档和设计图完成 AI 获客页面，本期不做导出
```

### 你会得到什么

- 先说明已找到哪些资料、还缺哪些关键证据。
- 给出范围、计划和验证方式。
- 按计划推进实现、审查、测试或 UI 精修。
- 只在会改变交付结果的问题上追问你。
- 完成后说明哪些已验证，哪些还需要人工确认。

## `$jj-validate`

### 什么时候用

维护 `jj-flow` 项目本身时使用。普通业务需求不用它。

### 你需要给什么

- `自检目标`：可选，不写时默认检查当前项目状态。
- `范围`：可选，例如只看文档、规则、测试或路线图。
- `证据`：可选，例如路线图、失败日志、用户反馈、已完成 diff。
- `升级偏好`：可选，例如优先减少用户参与次数、优先完善安装体验、优先补测试。

### 使用方案

```text
$jj-validate 检查 jj-flow 当前状态，找出文档、规则、测试和路线图的漂移
```

```text
$jj-validate 基于当前路线图和用户反馈，给出下一步最该实现的项目管理能力
```

### 你会得到什么

- 读取项目状态和路线图。
- 检查文档、规则、测试和项目状态是否一致。
- 报告底层工具是否可用。
- 标出 `PASS`、`PENDING`、`FAIL` 或需人工确认项。
- 生成下一步建议，并说明证据来源。

## `$jj-evolve`

### 什么时候用

维护 `jj-flow` 项目本身，并且已经有 `$jj-validate` 的自检结果时使用。它用于推进项目下一轮升级或修正文档代码漂移。

### 你需要给什么

- `迭代目标`：可选，不写时默认基于当前自检和路线图推进下一步。
- `优先级`：可选，例如先补自检失败、先完善安装、先减少用户参与次数。
- `约束`：可选，例如不改变项目定位、不引入重型执行系统、不做外部工具直连。
- `证据`：可选，例如 `$jj-validate` 输出、路线图、用户反馈、测试失败日志。

### 使用方案

```text
$jj-evolve 基于当前自检结果推进下一项项目管理能力
```

```text
$jj-evolve 优先减少用户参与次数，但不要改变 jj-flow 的项目定位
```

### 你会得到什么

- 先复用 `$jj-validate` 的项目自检证据。
- 生成修正清单，优先列出必须修正的漂移。
- 给出下一轮升级计划、验收标准和建议执行顺序。
- 明确哪些改动属于项目维护，哪些不应该在本轮做。

## `$jj-feat`

### 什么时候用

明确的小功能交付。适合已有需求边界和接口资料，只需要按项目模式实现。

### 你需要给什么

- `功能目标`：必填。
- `接口资料`：涉及接口时推荐提供。
- `页面或模块`：推荐提供路径、组件名或路由。
- `验收标准`：推荐提供。

### 使用方案

```text
$jj-feat 在客户列表增加筛选项，接口字段看 YApi 链接，验收以现有列表页交互为准
```

### 你会得到什么

- 先确认边界和证据。
- 生成实现计划。
- 涉及接口时优先使用真实接口资料。
- 完成后给出验证结果和剩余风险。

## `$jj-fix`

### 什么时候用

线上问题定位与修复。适合 ARMS/SLS、报错、回归、异常行为。

### 你需要给什么

- `现象`：必填，用户看到的问题。
- `时间窗`：推荐提供，便于查日志。
- `错误指纹`：推荐提供，例如 ARMS、SLS、console error。
- `影响范围`：推荐提供，例如页面、租户、用户路径。

### 使用方案

```text
$jj-fix 线上 goods-detail 在 09:30 到 10:00 出现 500，ARMS 指纹如下，要求定位根因并最小修复
```

### 你会得到什么

- 先拿真实日志或复现证据。
- 说明根因机制、引入位置和修复位置。
- 修复范围尽量窄。
- 验证复现路径和回归点。

## `$jj-review`

### 什么时候用

交付前质量审查。适合检查计划、diff、测试结果、发布风险。

### 你需要给什么

- `审查目标`：必填。
- `diff 或变更范围`：推荐提供。
- `验收标准`：推荐提供。
- `风险关注点`：可选，例如兼容性、性能、权限、租户范围。

### 使用方案

```text
$jj-review 审查 AI 获客页面本次改动，重点看接口字段、设计还原、权限和测试缺口
```

### 你会得到什么

- 先列风险和缺陷。
- 每个结论追溯到文件、命令或证据。
- 没有证据的通过项保持 `PENDING`。

## `$jj-knowhow`

### 什么时候用

把真实交付过程沉淀成可复用知识。适合总结 Codex 线程、提交、问题和解决方案。

### 你需要给什么

- `沉淀对象`：必填，例如一次需求、一个 bug、一组 Codex 线程。
- `复用目标`：推荐提供，例如工作流模板、项目规范、排查路径。
- `证据`：推荐提供，例如线程链接、提交、文档、测试结果。

### 使用方案

```text
$jj-knowhow 总结这三个 Codex 线程的完整交付流程，沉淀成后续 delivery 模板
```

### 你会得到什么

- 保留问题、约束、证据、方案和复用条件。
- 区分一次性事实和可复用规则。
- 可沉淀为 knowhow、spec 或工作流模板。

## `$jj-dispatch`

### 什么时候用

多个同源项目需要由一个主任务统一拆解、派发和监控，而且需求可能先出现在 B 或 C、领头项目也会变化时，在独立控制项目中使用。首版只支持 Codex `$jj-dispatch`，不提供 Claude `/jj-dispatch`。

### 你需要给什么

- `需求引用`：需求文档、Codex thread 或正式 artifact 的引用，不复制正文。
- `origin_project`：需求或 bug 最先出现的项目。
- `requirement_owner`：持有正式 `ANL-SOURCE / BLP/REQ / Handoff Snapshot` 的项目。
- `lead_project`：本轮首先实施的项目。
- `lead_responsibilities`：当 lead 不在 `targets` 中时要先派发的责任，默认是 development 写任务。
- `targets`：本轮明确授权的项目；每个项目用 `responsibilities` 列出 development、product、test、review 等责任。同一项目允许多个写责任，但必须通过 `depends_on` 形成单一串行链；运行时同一项目最多一个 active write，其余责任通常为只读。
- `批准`：只有用户明确批准预览中的任务集合后才能派发。

`reference_implementation` 初始可以是 `null`。只有 lead 或已授权目标有稳定 commit、snapshot 和 PASS 验证证据后才能设置，不要求等于 origin。

### 使用方案

先预览：

```text
$jj-dispatch PREVIEW 需求=支付状态优化 origin=B requirement_owner=B lead=C targets=A,B
```

确认任务清单后派发：

```text
$jj-dispatch DISPATCH 批准上面的任务集合
```

恢复创建成功但未绑定的任务：

```text
$jj-dispatch RECONCILE task_key=DEL-001/A/development/1
```

### 你会得到什么

- `PREVIEW`：动态角色、目标、依赖、稳定 `task_key` 和阻塞项，不创建 Codex task。
- `DISPATCH`：批准记录冻结完整 task key 清单；任务集合变化后必须重新预览和批准。派发时先持久化 `dispatch_intent`，再在目标 project 中创建独占 worktree task；重复 key 不创建第二个任务。
- `RECONCILE`：只有唯一候选 thread 才恢复绑定，否则保持 `BLOCKED`。
- `BIND_THREAD`：人工把已知 thread 与 task key 绑定。
- 状态汇总：只消费 commit、snapshot、测试和 Review 等结构化证据；thread 停止或文字回复“完成”不推进检查点。

实际需求交付、bug 修复和同源迁移仍分别委派给 `$jj-delivery`、`$jj-fix` 和 `$jj-same`。首版不自动 merge、push 或 release。

## `$jj-same`

### 什么时候用

同源但已分叉的项目之间首次迁移功能，或让同一功能后续持续同步修复、需求增删、产品调整和回退。典型场景是 A 项目已经完成某项功能，需要先稳健迁到 B，再在 A 后续更新或修复 bug 时按上次成功基线增量同步到 B。

### 你需要给什么

- `源证据`：Codex 会话 ID、需求文档、功能分支、commit 或 diff，至少提供一种。
- `当前需求`：推荐提供，历史会话中的旧要求会被当前明确要求覆盖。
- `源项目和目标项目`：推荐写业务角色或路径，例如承接前台、兑接前台、承载后管。
- `同步关系`：后续同步推荐提供首次迁移生成的 `sync_key`；没有时先从源项目 outgoing Maestro spec 发现目标，再从目标 incoming spec 和成功产物链查找检查点。
- `范围`：说明只分析、要迁移、要修复、要增删需求，或是否需要提交推送。
- `交接快照`：源项目已经准备过 handoff 时，优先提供 `handoff_ref`；目标不再重复传完整源会话和需求文档。

### 使用方案

```text
$jj-same 会话=019f... 当前需求=保留密码入口 源=承接前台 目标=兑接前台,承载前台
```

源项目准备共享交接快照：

```text
$jj-same 准备交接 会话=019f... 源提交=c0c360f9d 功能=密码更新提醒
```

目标项目消费交接快照：

```text
$jj-same 交接=@D:\path\to\ANL-SOURCE\requirement-baseline\HOF-feature-001\handoff-snapshot.yaml 当前项目=兑接 开始迁移
```

源需求、源实现或验证状态变化后更新交接：

```text
$jj-same 更新交接 交接=@D:\path\to\HOF-feature-001\handoff-snapshot.yaml 会话=019f... 源提交=<new-commit> 变更=<需求纠正或 bug fix>
```

### Handoff 标准步骤

1. 源会话执行 `准备交接`，得到 `PARTIAL_HANDOFF` 或 `READY_FOR_HANDOFF` 以及唯一 `handoff_ref`。
2. 目标会话传入 `handoff_ref`，先做 freshness gate，只能输出 `REUSE / REFRESH_SOURCES / REBASELINE / BLOCKED` 之一。
3. `REUSE + execution_readiness=READY` 时，目标复用共享 `ANL-SOURCE / BLP/REQ`，进入自己的 `ANL-TARGET` 和后续交付链；源评审或 UAT 待补只作为 caveat。
4. `PARTIAL_HANDOFF` 只有在 `execution_readiness=BLOCKED` 时才限制为高层差异分析；`STALE/BROKEN` 必须先回源刷新或 rebaseline。
5. 第二、第三个目标继续使用同一个 snapshot；不得重新读取完整源材料或复制前一目标实现。
6. 源发生变化时执行 `更新交接`，生成带 `parent_snapshot` 的 successor；已迁移目标按 delta 对账。
7. 各目标分别满足成功检查点后，才更新自己的同步基线。

```text
$jj-same 源仓库=D:\codeup\chengjie\cj-frontend-web 源分支=feat/cj-silence-0710 分析并迁移到同一行另外两个项目
```

首次迁移并建立持续同步：

```text
$jj-same 建立持续同步：功能=沉默账户登录 源=A 目标=B，首次迁移并记录同步基线
```

同步后续更新和 bug 修复：

```text
$jj-same 同步 SYNC-silence-login，检查 A 从上次成功基线到 HEAD 的增量并同步到 B
```

Claude Code 中使用：

```text
/jj-same 会话=019f... 源=承接后管 目标=兑接后管,承载后管
```

### 你会得到什么

- 从当前分析阶段建立家族交付计划；存在 `$jj-dispatch` 控制项目时由 control manifest 持有跨项目状态，没有控制项目时由领头项目持有协调 `PLN`。
- 承接领头时默认按 `cj -> dj -> cz` 推荐下一目标；用户当前明确指定目标并要求迁移/实施时，以该目标 `EXECUTION_READY` 为准，不等待其它 sibling 完成。
- 领头分支由用户创建；后续项目从各自本地 `master` 建分支，只替换角色前缀并保留日期与任务序号，例如 `feat/cj-0717-1 -> feat/dj-0717-1`。
- 家族计划持续记录项目状态、分支映射、artifact refs、验证证据、差异和交接门禁，但每个目标仍重新生成自己的目标分析与实施计划。
- 源项目达到 `PARTIAL_HANDOFF` 或 `READY_FOR_HANDOFF` 时生成唯一 handoff snapshot；后续目标复用它，不各自重建源分析和 blueprint。
- handoff snapshot 的 `FRESH / PARTIAL / STALE / BROKEN` freshness 决定 `REUSE / REFRESH_SOURCES / REBASELINE / BLOCKED`，但缓存命中不能跳过目标分析与验证。
- 先用 `maestro-analyze` 生成源证据总结 `ANL-SOURCE`，还原最终需求账本，区分 `MUST`、`TARGET-ONLY`、`DO-NOT-PORT` 和 `UNRESOLVED`。
- 再用 `maestro-blueprint` 生成正式 `BLP-*`，把确认需求写入 `requirements/REQ-*.md`，保留 readiness 和 traceability。
- 每个目标单独生成 `ANL-TARGET`，形成源变更地图、目标能力矩阵和剃刀排除清单。
- 每个目标给出 `DIRECT / ADAPT / EXTEND / BLOCKED / N/A` 决策。
- 按 `稳健 / 剃刀 / 精准 / 最小化 / 复用` 五项门禁复审修改范围。
- `EXECUTION_READY` 只要求实施授权、稳定源行为、最终需求、目标调用链和无影响 `MUST` 的冲突；满足后生成最小 `PLN-*` 并在同一轮进入业务实现。`HANDOFF_READY` 才要求目标验证、评审和必要 UAT 完整。
- 首次成功后在 B 的 arch spec 中建立 `sync_key`；后续从最近成功的 `VRF-* / REV-*` 交付链或 `NO_CHANGE_REQUIRED` 目标分析反查源 commit 检查点。
- 同步失败不推进检查点，下一次继续累计未同步的 A 项目变更。
- 全部增量都是 `N/A / NOISE / DO-NOT-PORT` 时记录有证据的 `NO_CHANGE_REQUIRED` 检查点，不伪造代码和验证产物。

### 文档放在哪里

- 源总结和目标评审：`.workflow/.csv-wave/{日期}-analyze-{主题}/`，注册 `ANL-*`。
- 迁移交接快照：源 `ANL-SOURCE` 下的 `requirement-baseline/{snapshot_id}/handoff-snapshot.yaml`；`context-package.json` 只保存 `handoff_ref`。
- 正式需求：`.workflow/blueprint/BLP-{主题}-{日期}/`，注册 `BLP-*`。
- 实施计划：`.workflow/scratch/{日期}-plan-P{阶段}-{主题}/plan.json` 和 `.task/TASK-*.json`，注册 `PLN-*`。
- 实施、验证和评审：由 `maestro-execute`、`quality-review` 生成并注册 `EXC-*`、`VRF-*`、`REV-*`。
- 持续同步契约：通过 `maestro spec add arch` 在源项目保存 outgoing 索引、在目标项目保存 incoming 契约；可变 commit 游标仍由目标交付产物链承载。

不创建 `.workflow/jj-same/`。`.workflow/.maestro/*/status.json` 只保存编排状态。多目标迁移共享一份源分析和 blueprint，但每个目标分别保存自己的同步契约、目标分析、计划、实施和评审产物。

### 修改完成后怎么确认

`$jj-delivery`、`$jj-feat` 和 `$jj-fix` 修改并验证代码后，会把当前仓库交给 `$jj-same` 做轻量 discovery。它先确认项目根目录、origin、业务角色、当前分支、HEAD、工作区和验证结果，再列出目标项目及 `READY / ALREADY_SYNCED / ELIGIBLE / DEFERRED / PREVIEW_ONLY / BLOCKED / N/A` 状态。

只有 `READY / ELIGIBLE / DEFERRED` 会询问用户选择 `SYNC_NOW / DEFER / NOT_APPLICABLE / PAUSE_RELATION`。延期使用目标项目的 Maestro open issue，保持最早未同步起点并更新最新源 HEAD；同步成功或形成 `NO_CHANGE_REQUIRED` 后才关闭 issue。仓库或分支不正确时只报告解除条件，不自动 checkout。

## `$jj-auto`

### 什么时候用

自动判断意图。当前文档不推荐把 `auto` 当主入口；真实交付优先用 `$jj-delivery`，明确任务优先用 `$jj-fix`、`$jj-review` 或 `$jj-knowhow`。

### 使用方案

```text
$jj-auto 帮我判断这件事应该走交付、修复、审查还是沉淀
```

### 你会得到什么

- 选择最合适的入口。
- 给出选择理由。
- 证据不足时明确标出待确认。

## `install-skill`

### 什么时候用

把 npm 包里的 `.codex/skills`、`.codex/agents` 或 `.claude/commands` 安装到本机。Codex skills 与 agent profiles 作为一组安装，让 Codex 能识别 `$jj-delivery`、`$jj-dispatch` 并加载受控 Reviewer/Developer；Claude Code 能识别 `/jj-delivery`。这是安装命令，不是对话里的交付命令。`$jj-dispatch` 没有对应的 Claude command。

### 参数

- `--platform codex|claude|all`：安装 Codex skills + agents、Claude commands 或全部资产。默认是 `codex`。
- `--project`：安装到当前项目的 `./.codex/skills`、`./.codex/agents` 或 `./.claude/commands`。
- `--target <dir>`：自定义 skills/commands 目标；Codex agents 安装到该目录的兄弟 `agents` 目录。不能和 `--platform all` 一起使用。
- `--force`：任一 Codex skill/agent 冲突时覆盖整组安装文件。
- `--dry-run`：显示所有目标和冲突，不写文件。
- `--json`：输出结构化结果，便于脚本检查。

### 使用方案

首次安装：

```bash
npx @shendu-sdt/jj-flow@beta install-skill
```

升级已有安装：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --force
```

安装 Claude Code commands：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform claude
```

同时安装到当前项目：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform all --project
```

预览安装位置：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --dry-run
```

### 你会得到什么

- 安装成功时，`~/.codex/skills/jj-delivery/SKILL.md`、`~/.codex/skills/jj-fix/SKILL.md` 等文件存在。
- 安装 Codex 时，`~/.codex/agents/jj-workflow-reviewer.toml` 与 `jj-workflow-developer.toml` 同时存在。
- 安装 Claude Code 时，`~/.claude/commands/jj-delivery.md`、`~/.claude/commands/jj-fix.md` 等文件存在。
- 首次安装或 `--force` 更新成功后，输出当前版本对应的最新版本日志；`--dry-run` 和失败结果不输出。
- 目标资产已存在且未传 `--force` 时，命令失败并提示如何覆盖。
- `--json` 输出包含 `ok`、`status`、`source`、`target`、`message`；Codex 还包含 `agents`、`agent_source`、`agent_target`，安装或更新成功时还包含 `version` 和 `release_notes`。

## 选择建议

- 完整需求：用 `$jj-delivery`。
- 项目自检和下一步升级：用 `$jj-validate`。
- 推进项目自身迭代：用 `$jj-evolve`。
- 明确新增功能：用 `$jj-feat`。
- 线上问题或异常：用 `$jj-fix`。
- 交付前把关：用 `$jj-review`。
- 总结和沉淀：用 `$jj-knowhow`。
- 同源分叉项目之间迁移功能、修复或需求变更：用 `$jj-same`。
- 独立控制项目中统一预览、派发和恢复多个项目任务：用 `$jj-dispatch`。
- 不确定分类：用 `$jj-auto`，但不要把它当长期主入口。
