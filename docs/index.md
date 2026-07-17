# jj-flow 文档

`jj-flow` 是给 Codex 和 Claude Code 用的项目族交付入口。它把同源迁移、handoff 与多项目调度整理成可执行的 Maestro/Agent 工作流，避免在真实项目族里漏接口、漏场景、漏验证。全部流程禁止调用 `maestro explore`。

## 现在要做什么

- 第一次使用：先看 [安装](installation.html) 和 [使用说明](usage.html)。
- 要迁移同源项目、handoff 或持续同步：用 [$jj-same](command-jj-same.html)。
- 要统一调度多个项目：用 [$jj-dispatch](command-jj-dispatch.html)。
- 想浏览全部入口：打开 [命令总览](commands.html)。

## 先跑一个完整示例

```text
$jj-same
会话=019f...
当前需求=保留密码入口
源=承接前台
目标=兑接前台,承载前台
```

你会看到 Agent：

1. 先说明找到了哪些会话、commit、资料，还缺哪些关键证据。
2. 收敛迁移范围、剃刀排除项和不做范围。
3. 给出迁移矩阵与实施/验证计划。
4. 在批准边界内完成目标项目改动。
5. 区分已验证、待确认和阻塞项。

## 按任务选择

### 协作与迁移

- [$jj-same](command-jj-same.html)：首次迁移、handoff 和持续同步。
- [$jj-dispatch](command-jj-dispatch.html)：多项目任务预览、批准、绑定和恢复。

### 维护 jj-flow

- 直接修改本仓库并运行 `npm run verify`；不再提供 `$jj-validate` / `$jj-evolve` 对话入口。
- [CLI 调度与自动化](command-cli.html)：通过 `jj` / `jj-flow` 安装资产或执行 `dispatch-tick`。
- [M6 验收](milestones/m6-acceptance.html)：主调度运行时与目标差异门禁已关闭；下一里程碑为 M7 真实控制项目试跑。

## 文档已经可以搜索

左侧搜索框会搜索所有命令页、指南和维护文档。可以输入命令、场景或状态词：

```text
handoff
sync_key
PENDING
jj-dispatch
```

按 `/` 快速进入搜索，按 `Esc` 清空。
