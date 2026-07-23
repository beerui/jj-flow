# `jj` 兼容入口

`$jj` / `/jj` 只做路由，不承担完整迁移、闭环或调度协议。任务类型明确时，直接使用原生命令更清楚。

## 什么时候用

- 用户习惯说“用 jj-flow”或只打了 `$jj` / `/jj`。
- 暂时不确定该走 same、ralph 还是 dispatch，需要先分流。

## 什么时候不要用

- 已经确定是同源迁移时，直接用 [`$jj-same`](command-jj-same.html) 或 `/jj-same`。
- 已经确定是单仓全流程闭环时，直接用 [`$jj-ralph`](command-jj-ralph.html) 或 `/jj-ralph`。
- 已经确定是多项目调度时，直接用 [`$jj-dispatch`](command-jj-dispatch.html)（Codex）。
- 需要安装命令资产或机械步骤时，使用 [`jj` CLI](command-cli.html)，不要在 shell 中运行 `jj-same` 等名字指望它改业务代码。

## 路由优先级

1. 同源多仓迁移 / handoff / 持续同步 → same
2. 单仓闭环 / ralph / 归档 / 能力地图 → ralph
3. 控制项目多目标调度 → dispatch（Codex）
4. 不确定 → 默认 same

## 你需要给什么

任意自然语言需求即可。完整时通常包含目标、资料、范围、关键决策和验收。

## 示例

```text
$jj 把承接前台的密码更新提醒迁到兑接前台
```

预期路由到 `$jj-same`。

```text
$jj 在当前仓库完成密码过期提醒并归档
```

预期路由到 `$jj-ralph`。

```text
$jj 在控制项目预览 DEL-password 的多项目任务
```

预期路由到 `$jj-dispatch`（仅 Codex）。

## 执行过程

1. 保留用户原始需求和动机。
2. 按优先级判断 same / ralph / dispatch。
3. 转入对应原生命令，不在兼容入口内重新发明流程。

## 平台差异

Codex 支持 `$jj-same` / `$jj-ralph` / `$jj-dispatch`。Claude Code 支持 `/jj-same` / `/jj-ralph`；无 `/jj-dispatch`。
