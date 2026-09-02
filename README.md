# jj-flow

`jj-flow` 是面向 **项目族** 的 AI **编排工作流**：在 Codex / Claude / Grok / Qoder 里用对话入口，把同源迁移、持续同步和多项目调度做成可恢复、可验证的流程。

主入口：

- **`$jj-init` / `/jj-init`**：接入全局地图、梳理项目、补知识库（须用户同意后写入）
- **`$jj-same` / `/jj-same`**：同源分叉项目之间的功能迁移、handoff 与持续同步
- **`$jj-ralph` / `/jj-ralph`**：单仓全流程闭环（分析 → 计划 → 验收 → 归档）与能力地图
- **`$jj-dispatch` / `/jj-dispatch`**：在**业务仓**发起多项目预览、批准、派发与恢复（Codex / Grok / Qoder；无 Claude 薄命令）

协调状态、项目地图和知识库默认写 **`~/.jj-flow`**（`install-skill` 会生成空 `map.md` 与 `knowledge/`）。本机若另有 portfolio，用 `$JJ_GLOBAL_CONFIG_DIR/naming.json` 覆盖路径。接入地图和建知识库走 `$jj-init`（须用户同意）。`jj doctor` 可查看解析结果。

它解决的是「单仓如何可追溯地做完一件事」以及「多个已分叉项目如何协同改同一能力」。**产品定位是项目编排协议与工作流**。事实来源是 run ledger、control-plane、Git commit 与验证证据，不是聊天状态。

适合这类场景：

- 当前仓库从需求做到验收与归档，并沉淀能力地图。
- 同一功能要在同源分叉的多个前台/后管项目间迁移或同步。
- 需要可版本化 handoff / 分发快照，避免只靠会话记忆。
- 需要稳定 `task_key`、批准与恢复协议。

它不是新的应用框架。`npx` 管理 skills / agents / slash commands，并提供 `jj ralph *` 机械步骤；真实分析与编码在 Codex / Claude Code 对话里完成。

控制面里的 `delivery_id` 是调度任务身份，不是对话 skill 入口。

**npm 包名（2026-08）：** `@brewer/jj-flow`。旧包 `@shendu-sdt/jj-flow` 已弃用，请改用新 scope 安装。

## 快速使用

安装 Codex skills 和配套 agents：

```bash
npx @brewer/jj-flow@latest install-skill
```

安装 Claude Code slash commands：

```bash
npx @brewer/jj-flow@latest install-skill --platform claude
```

安装 Grok skills：

```bash
npx @brewer/jj-flow@latest install-skill --platform grok
```

当前项目同时安装全部平台资产（Codex / Claude / Qoder / Grok）：

```bash
npx @brewer/jj-flow@latest install-skill --platform all --project
```

卸载前先预览；旧版未登记或本地修改过的资产需要审查后显式加 `--force`：

```bash
npx @brewer/jj-flow@latest uninstall-skill --platform all --dry-run --json
```

Codex：

```text
$jj-init 当前仓加入全局地图
$jj-same 会话=019f... 当前需求=保留密码入口 源=项目A 目标=项目B,项目C
$jj-ralph 目标=登录后密码过期提醒 范围=仅登录成功路径 验收=提示可跳转改密
```

Claude Code / Grok：

```text
/jj-init 当前仓加入全局地图
/jj-same 会话=019f... 当前需求=保留密码入口 源=项目A 目标=项目B,项目C
/jj-ralph 目标=登录后密码过期提醒 范围=仅登录成功路径 验收=提示可跳转改密
```

更多示例：

```text
$jj-same 准备交接 会话=019f... 源提交=c0c360f9d 功能=密码更新提醒
$jj-same 交接=@D:\path\to\handoff-snapshot.yaml 当前项目=项目B 开始迁移
$jj-dispatch PREVIEW delivery=DEL-password
jj ralph map-find --query "密码过期"
jj ralph archive --run-id task-login-reminder
```

## 继续阅读

文档站：[https://beerui.github.io/jj-flow/index.html](https://beerui.github.io/jj-flow/index.html)

- [安装](https://beerui.github.io/jj-flow/installation.html) · [使用说明](https://beerui.github.io/jj-flow/usage.html)
- [命令总览](https://beerui.github.io/jj-flow/commands.html) · [术语](https://beerui.github.io/jj-flow/glossary.html)
- [架构](https://beerui.github.io/jj-flow/architecture.html)

## 维护仓库

见 [维护说明](https://beerui.github.io/jj-flow/maintenance.html)。
