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

`$jj-same` 产生的中间文档遵循 Maestro 的产物规范，不创建 `.workflow/jj-same/` 之类的私有目录：

1. 会话或分支总结由 `maestro-analyze` 生成，保存到 `.workflow/.csv-wave/{日期}-analyze-{主题}/`，并在 `.workflow/state.json` 注册 `ANL-*`。
2. AI 可执行需求由 `maestro-blueprint` 生成，保存到 `.workflow/blueprint/BLP-{主题}-{日期}/`；正式需求位于 `requirements/REQ-*.md`，同时保留 readiness 与 traceability 产物。
3. 目标项目评审再次使用 `maestro-analyze --from blueprint:BLP-*`，形成独立的目标差异分析和迁移决策。
4. 评审通过后才由 `maestro-plan --from analyze:ANL-*` 生成 `.workflow/scratch/{日期}-plan-P{阶段}-{主题}/plan.json` 和 `.task/TASK-*.json`，再进入 `maestro-execute` 与 `quality-review`。

`.workflow/.maestro/*/status.json` 只保存 Maestro 编排状态，不承载需求正文；`.workflow/specs/` 只用于交付后沉淀的跨任务稳定规则，不存放单次迁移文档。目标项目尚未初始化 `.workflow/` 时，应先执行 `maestro-init`，再生成上述正式产物。

如果你在维护 `jj-flow` 项目本身，再使用 `$jj-validate` 和 `$jj-evolve`：

```text
$jj-validate 检查当前项目状态，给出下一步升级建议
$jj-evolve 基于当前自检结果推进下一项项目管理能力
```
