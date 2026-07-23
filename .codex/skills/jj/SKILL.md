---
name: jj
description: 兼容入口；jj-flow 项目族编排工作流的路由层，把 $jj / /jj 转到 jj-same、jj-ralph、jj-review 或 jj-dispatch。
---

# jj

## 定位

`jj` 是兼容入口，不是终端命令入口。正式使用主推：

- Codex：`$jj-same` / `$jj-ralph` / `$jj-review` / `$jj-dispatch`
- Claude Code：`/jj-same` / `/jj-ralph` / `/jj-review`

## 路由优先级

1. 同源多仓迁移、handoff 消费、持续同步、`sync_key` → `$jj-same`
2. 控制项目多目标预览/批准/派发/恢复、`delivery_id` → `$jj-dispatch`（仅 Codex）
3. 单仓全流程闭环、ralph、归档、能力地图、从需求做到验收 → `$jj-ralph`
4. 单仓轻量审查、关联任务/审查会话、写 reviews 报告 → `$jj-review`
5. 不确定：默认 `$jj-same`（兼容历史）

## 执行契约

1. 先保留用户原始需求和动机，不把需求改写成固定 CLI 参数。
2. 优先读取项目资料、`.workflow` 状态、会话、handoff、ralph 地图、分支与 commit 证据。
3. 代码定位使用 Read、Glob、Grep、Bash 或已批准 skill。
4. 不通过 shell 执行 `jj-same` 等同名对话命令；`npx`/`jj` 用于安装资产或 `jj ralph *` 机械步骤。
5. 证据不足时保持 `PENDING`/`BLOCKED`，只在会改变交付结果的地方追问用户。

## 已移除

`$jj-delivery` / `$jj-validate` / `$jj-evolve` / `$jj-feat` / `$jj-fix` / `$jj-knowhow` / `$jj-auto`。
