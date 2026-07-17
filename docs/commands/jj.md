# `jj` 兼容入口

`$jj` / `/jj` 只做路由，不承担完整迁移或调度协议。任务类型明确时，直接使用原生命令更清楚。

## 什么时候用

- 用户习惯说“用 jj-flow”或只打了 `$jj` / `/jj`。
- 暂时不确定该走 same 还是 dispatch，需要先分流。

## 什么时候不要用

- 已经确定是同源迁移时，直接用 [`$jj-same`](command-jj-same.html) 或 `/jj-same`。
- 已经确定是多项目调度时，直接用 [`$jj-dispatch`](command-jj-dispatch.html)（Codex）。
- 需要安装命令资产或为自动化生成结构化结果时，使用 [`jj` CLI](command-cli.html)，不要在 shell 中运行 `jj-same` 等名字指望它改业务代码。

## 你需要给什么

任意自然语言需求即可。完整时通常包含目标、资料、范围、关键决策和验收。

## 示例

```text
$jj 把承接前台的密码更新提醒迁到兑接前台
```

预期路由到 `$jj-same`。

```text
$jj 在控制项目预览 DEL-password 的多项目任务
```

预期路由到 `$jj-dispatch`（仅 Codex）。

## 执行过程

1. 保留用户原始需求和动机。
2. 判断任务属于 `same` 或 `dispatch`；不确定时默认 `same`。
3. 转入对应原生命令，不在兼容入口内重新发明流程。

## 平台差异

- Codex：`$jj`
- Claude Code：`/jj`（只能可靠路由到 `/jj-same`；dispatch 无 Claude slash command）

## 常见误区

- 把 `$jj` 当作长期主入口。任务类型明确时，直接使用 `$jj-same` 等命令更清楚。
- 在终端执行 `jj same ...`，期待它直接修改业务代码。CLI 只用于安装、维护和调试输出。
- 继续调用已移除的 `$jj-delivery` / `$jj-validate` / `$jj-evolve`。

## 相关命令

- [`jj-same`](command-jj-same.html)：同源迁移与持续同步。
- [`jj-dispatch`](command-jj-dispatch.html)：多项目调度控制面。
