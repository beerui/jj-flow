---
name: jj
description: 兼容入口；当用户使用 $jj、/jj 或泛称 jj-flow 时触发，并路由到 jj-delivery、jj-fix、jj-review、jj-knowhow、jj-validate、jj-evolve、jj-auto、jj-same、jj-dispatch 等原生命令。
---

# jj

## 定位

`jj` 是兼容入口，不是终端命令入口。正式使用主推连字符缩写：Codex 中用 `$jj-delivery`，Claude Code 中用 `/jj-delivery`。

## 路由

- 完整交付：转入 `$jj-delivery`。
- 明确功能：转入 `$jj-feat`。
- 线上问题：转入 `$jj-fix`。
- 质量审查：转入 `$jj-review`。
- 经验沉淀：转入 `$jj-knowhow`。
- 项目自检：转入 `$jj-validate`。
- 项目迭代：转入 `$jj-evolve`。
- 同源项目间迁移功能、修复或需求变更：转入 `$jj-same`。
- 独立控制项目中的多项目任务预览、派发和恢复：转入 `$jj-dispatch`。该入口仅用于 Codex。
- 不确定分类：转入 `$jj-auto`。

## 执行契约

1. 先保留用户原始需求和动机，不把需求改写成固定 CLI 参数。
2. 优先读取项目资料、`.workflow` 状态、PRD、接口文档、设计图、日志和历史线程。
3. 需要通用流程时调用 Maestro/Codex skills，例如 `maestro-analyze`、`maestro-plan`、`maestro-execute`、`quality-review`。
4. 不通过 shell 执行 `jj-delivery`、`jj-fix` 等同名命令；`npx` 只用于安装或刷新本地命令资产。
5. 证据不足时保持 `PENDING`，只在会改变交付结果的地方追问用户。
