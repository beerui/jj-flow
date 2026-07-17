---
name: jj
description: 兼容入口；当用户使用 $jj、/jj 或泛称 jj-flow 时触发，并路由到 jj-delivery、jj-validate、jj-evolve、jj-same、jj-dispatch 等原生命令。
---

# jj

## 定位

`jj` 是兼容入口，不是终端命令入口。正式使用主推连字符缩写：Codex 中用 `$jj-delivery`，Claude Code 中用 `/jj-delivery`。

## 路由

- 完整交付、明确功能、线上修复、交付前审查：转入 `$jj-delivery`。
- 项目自检：转入 `$jj-validate`。
- 项目迭代：转入 `$jj-evolve`。
- 同源项目间迁移功能、修复或需求变更：转入 `$jj-same`。
- 独立控制项目中的多项目任务预览、派发和恢复：转入 `$jj-dispatch`。该入口仅用于 Codex。
- 不确定分类：默认转入 `$jj-delivery`。

## 执行契约

1. 先保留用户原始需求和动机，不把需求改写成固定 CLI 参数。
2. 优先读取项目资料、`.workflow` 状态、PRD、接口文档、设计图、日志和历史线程。
3. 需要通用流程时调用 Maestro/Codex skills，例如 `maestro-analyze`、`maestro-plan`、`maestro-execute`、`quality-review`。
4. **禁止调用 `maestro explore`**；代码定位使用 Read、Glob、Grep、Bash 或已批准 skill。
5. 不通过 shell 执行 `jj-delivery` 等同名命令；`npx` 只用于安装或刷新本地命令资产。
6. 证据不足时保持 `PENDING`，只在会改变交付结果的地方追问用户。
7. 已移除 `$jj-feat` / `$jj-fix` / `$jj-knowhow` / `$jj-auto` / `$jj-review`；相关意图一律路由到 `$jj-delivery`。
