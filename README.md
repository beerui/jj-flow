# jj-flow

`jj-flow` 让你在 Codex 或 Claude Code 里用 `$jj-same` / `/jj-same` 做同源项目迁移与持续同步，用 `$jj-dispatch`（Codex）做多项目调度。把会话、需求、handoff、分支和必须拍板的决定放进对话，Agent 按证据门禁推进。

它适合这种场景：

- 同一功能要在同源分叉的多个前台/后管项目间迁移或同步。
- 你希望用可版本化 handoff snapshot，避免每个目标重复重建源分析。
- 你希望多项目任务有稳定 `task_key`、批准与恢复协议，而不是只靠聊天状态。

它不是一个新的开发框架，也不是让你在终端里跑完整流水线的工具。`npx` 只负责把原生命令资产安装到 `.codex/skills`、`.codex/agents` 或 `.claude/commands`，真实使用入口在 Codex/Claude Code 对话里。

已移除 `$jj-delivery` / `$jj-validate` / `$jj-evolve` 等通用交付与协议自检入口。控制面中的 `delivery_id` 是调度任务身份，不是对话入口。

## 快速使用

安装 Codex skills 和配套 agents：

```bash
npx @shendu-sdt/jj-flow@beta install-skill
```

安装 Claude Code slash commands：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform claude
```

只想给当前项目同时安装两端资产：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform all --project
```

然后在业务项目里对 Codex 直接发送：

```text
$jj-same 会话=019f... 当前需求=保留密码入口 源=承接前台 目标=兑接前台,承载前台
```

在 Claude Code 里：

```text
/jj-same 会话=019f... 当前需求=保留密码入口 源=承接前台 目标=兑接前台,承载前台
```

也可以把资料和边界直接写进去：

```text
$jj-same
准备交接
会话=019f...
源提交=c0c360f9d
功能=密码更新提醒
```

在同源分叉项目间迁移功能、修复或需求变更时：

```text
$jj-same 会话=019f... 当前需求=保留密码入口 源=承接前台 目标=兑接前台,承载前台
/jj-same 会话=019f... 当前需求=保留密码入口 源=承接前台 目标=兑接前台,承载前台
$jj-same 准备交接 会话=019f... 源提交=c0c360f9d 功能=密码更新提醒
$jj-same 交接=@D:\path\to\handoff-snapshot.yaml 当前项目=兑接 开始迁移
$jj-same 更新交接 交接=@D:\path\to\handoff-snapshot.yaml 会话=019f... 源提交=<new-commit> 变更=<需求纠正或 bug fix>
```

源项目在可验证或可实施就绪时生成一次可版本化 handoff snapshot；目标项目复用共享需求语义，只做自己的实施与验证，不必重复读取完整源文档、会话和文件地图。

## 继续阅读

完整文档站：

[https://beerui.github.io/jj-flow/index.html](https://beerui.github.io/jj-flow/index.html)

- 第一次用：看 [安装](https://beerui.github.io/jj-flow/installation.html) 和 [使用说明](https://beerui.github.io/jj-flow/usage.html)。
- 要知道该用哪个命令：看 [命令总览](https://beerui.github.io/jj-flow/commands.html)。
- 要查术语缩写：看 [术语与缩写](https://beerui.github.io/jj-flow/glossary.html)。

## 维护仓库

维护者请使用文档站与仓库内 [维护说明](https://beerui.github.io/jj-flow/maintenance.html)。README 不再重复维护者长文，避免和文档站重复维护。
