# jj-flow

`jj-flow` 是面向 **项目族** 的 AI **编排工作流**：在 Codex / Claude Code 里用对话入口，把同源迁移、持续同步和多项目调度做成可恢复、可验证的流程。

主入口：

- **`$jj-same` / `/jj-same`**：同源分叉项目之间的功能迁移、handoff 与持续同步  
- **`$jj-dispatch`（Codex）**：独立控制项目上的多项目任务预览、批准、派发与恢复  

它解决的是「多个已分叉前端/后管如何协同改同一能力」，而不是「给 Maestro 做一层薄包装」。Maestro 等工具可以按需参与分析、计划与验证，但 **产品定位是项目编排协议与工作流**，事实来源是 control-plane、Git commit、验证/审查证据，不是聊天状态。

适合这类场景：

- 同一功能要在同源分叉的多个前台/后管项目间迁移或同步。
- 需要可版本化 handoff snapshot，避免每个目标重复重建源分析。
- 需要稳定 `task_key`、批准与恢复协议，而不是只靠会话记忆。

它不是新的应用框架，也不是终端里一键跑完业务代码的流水线。`npx` 只安装 skills / agents / slash commands；真实推进在 Codex / Claude Code 对话里完成。

已移除 `$jj-delivery` / `$jj-validate` / `$jj-evolve` 等入口。控制面里的 `delivery_id` 是调度任务身份，不是对话命令。

## 快速使用

安装 Codex skills 和配套 agents：

```bash
npx @shendu-sdt/jj-flow@beta install-skill
```

安装 Claude Code slash commands：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform claude
```

当前项目同时安装两端资产：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform all --project
```

Codex：

```text
$jj-same 会话=019f... 当前需求=保留密码入口 源=承接前台 目标=兑接前台,承载前台
```

Claude Code：

```text
/jj-same 会话=019f... 当前需求=保留密码入口 源=承接前台 目标=兑接前台,承载前台
```

更多示例：

```text
$jj-same 准备交接 会话=019f... 源提交=c0c360f9d 功能=密码更新提醒
$jj-same 交接=@D:\path\to\handoff-snapshot.yaml 当前项目=兑接 开始迁移
$jj-dispatch PREVIEW delivery=DEL-password
```

## 继续阅读

文档站：[https://beerui.github.io/jj-flow/index.html](https://beerui.github.io/jj-flow/index.html)

- [安装](https://beerui.github.io/jj-flow/installation.html) · [使用说明](https://beerui.github.io/jj-flow/usage.html)
- [命令总览](https://beerui.github.io/jj-flow/commands.html) · [术语](https://beerui.github.io/jj-flow/glossary.html)
- [架构](https://beerui.github.io/jj-flow/architecture.html)

## 维护仓库

见 [维护说明](https://beerui.github.io/jj-flow/maintenance.html)。
