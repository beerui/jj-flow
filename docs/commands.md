# 命令总览

这页帮你在 30 秒内选到正确入口。每个命令的完整输入、示例、执行过程和完成标准已经拆到独立页面；需要细节时直接打开对应命令。全部流程禁止调用 `maestro explore`。

## 不确定用哪个

默认使用 [$jj-delivery](command-jj-delivery.html)。它覆盖完整交付、明确功能、线上最小修复、交付前审查，以及类型尚不清晰但需要推进的请求。

如果你希望使用兼容入口，也可以使用 [$jj](command-jj.html)。它只负责把需求路由到合适的原生命令。

## 交付与开发

- [$jj-delivery](command-jj-delivery.html)：默认的完整交付入口，覆盖端到端交付、边界明确的功能开发、线上问题最小修复，以及 diff/风险审查。

## 协作与迁移

- [$jj-same](command-jj-same.html)：把同一个功能、修复或需求调整迁移到同源项目，或按 `sync_key` 持续同步增量。
- [$jj-dispatch](command-jj-dispatch.html)：在独立控制项目中预览、批准、绑定和恢复多项目任务；首版仅支持 Codex。

## 维护 jj-flow

- [$jj-validate](command-jj-validate.html)：检查项目状态、文档与代码漂移、测试、路线图和证据门禁。
- [$jj-evolve](command-jj-evolve.html)：把 validate 结果和用户反馈转成 correction backlog、升级计划和验证要求。
- [CLI 调度与自动化](command-cli.html)：通过 `jj` 或 `jj-flow` 生成 Markdown/JSON dispatch，适合维护、调试和自动化脚本。

## 通用输入模板

所有对话命令都接受自然语言，不要求先整理成固定参数。完整输入通常包含：

```text
$jj-<命令>
目标：要完成什么。
资料：PRD、YApi、设计图、日志、diff、线程或文件路径。
范围：本次做什么，不做什么。
关键决策：已经由用户拍板的取舍。
验收：什么结果算完成。
```

例如：

```text
$jj-delivery
目标：完成 AI 获客列表和详情。
资料：PRD 在 docs/v17.1，接口看 YApi，设计图来自 MasterGo。
范围：本期不做导出。
验收：页面还原设计，接口字段真实，聚焦测试和 quality-review 通过。
```

## 平台差异

Codex 使用 `$jj-*`，Claude Code 使用 `/jj-*`。例如：

```text
$jj-delivery 定位登录页 1027 重复提示并做最小修复
/jj-delivery 定位登录页 1027 重复提示并做最小修复
```

`$jj-dispatch` 依赖 Codex App 的 task、thread 和 worktree 能力，当前没有对应的 `/jj-dispatch`。

## 状态怎么理解

- `PASS`：证据满足当前门禁。
- `PENDING`：信息或验证还不完整，不能当成已经通过。
- `FAIL`：已有证据证明当前结果不满足要求。
- `BLOCKED`：缺少关键权限、环境、来源或决策，继续执行会扩大风险。
- `REUSE`：现有资料或目标实现仍然新鲜，可以直接复用。
- `REFRESH_SOURCES`：来源已变化，需要刷新后再继续。
- `REBASELINE`：现有基线无法可靠对账，需要重新建立。

同源迁移的 Handoff 标准步骤和 `REUSE / REFRESH_SOURCES / REBASELINE / BLOCKED` 判断见 [$jj-same](command-jj-same.html)。

## 安装命令

安装 Codex skills 或 Claude commands 使用 `install-skill`，完整参数和冲突处理见 [安装](installation.html)：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform all --dry-run --json
```

## 下一步

第一次使用建议先读 [使用说明](usage.html)，然后从 [$jj-delivery](command-jj-delivery.html) 开始。
