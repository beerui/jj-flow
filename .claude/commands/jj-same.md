---
name: jj-same
description: 基于会话 ID、需求、分支、commit 或 diff，按稳健、剃刀、精准、最小化、复用原则迁移同源分叉项目中的功能、修复和需求变更。
argument-hint: "<会话 ID、当前需求、源/目标项目、分支、commit 或 diff>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj-same

用户输入：$ARGUMENTS

迁移需求不变量，不复制源项目文件。先把会话、需求、分支、commit 或 diff 还原成 Maestro 可追踪产物，再按目标项目真实能力做最窄适配。

## 五项门禁

每次迁移都必须逐项回答：

- 稳健：是否基于当前需求、真实会话、分支提交和目标调用链交叉验证？是否保护脏工作区和旧功能？
- 剃刀：哪些文件、提交、文档、格式化、legacy 对齐和顺手重构与验收无关，必须排除？
- 精准：是否定位到每个目标的真实入口、接口、状态、错误处理和专有场景？
- 最小化：能否用更少文件、更少控制流变化和更窄验证范围完成同一验收？
- 复用：是否复用需求语义以及目标项目已有 API wrapper、组件、store、常量和测试模式？

## 工作流

1. 确认源项目、目标项目、证据入口和操作类型：分析、新功能迁移、修复、增需、删需或产品调整。
2. 当前用户需求优先于历史会话；历史会话和 assistant 交付摘要只作为线索，必须用 Git 和当前源码验证。
3. 分支或 commit 证据用 `merge-base..feature-ref` 按时间看提交，区分新增、修复、回退和产品反转。
4. 用 `maestro-analyze` 生成源分析 `ANL-SOURCE`，建立需求账本、源变更地图和剃刀清单。
5. 用 `maestro-blueprint` 消费源分析，在 `.workflow/blueprint/BLP-*/requirements/REQ-*.md` 生成正式需求；保留 `UNRESOLVED`，不得把推断写成产品事实。
6. 每个目标用 `maestro-analyze --from blueprint:BLP-*` 生成独立 `ANL-TARGET`，建立能力矩阵，决策只使用：`DIRECT`、`ADAPT`、`EXTEND`、`BLOCKED`、`N/A`。
7. 仅在 blueprint readiness 通过且目标无阻塞时，用 `maestro-plan --from analyze:ANL-*` 生成 `PLN`，再调用 `maestro-execute` 和 `quality-review`。
8. 只改用户明确授权的目标项目；用户只要求分析时，不写业务代码。
9. 每一行改动都要追溯到 `REQ-*`、`MUST` 或目标专有的 `TARGET-ONLY`。
10. 多个目标分别实施、分别验证、分别提交；不要整分支 cherry-pick，不整文件覆盖。

## Maestro 产物规范

- 不创建 `.workflow/jj-same/`。目标项目没有 `.workflow/` 时先调用 `maestro-init`。
- 源总结和目标评审保存到各自 `.workflow/.csv-wave/{日期}-analyze-{主题}/`，并注册 `ANL-*`。
- 正式需求保存到 `.workflow/blueprint/BLP-{主题}-{日期}/`，并注册 `BLP-*`。
- 实施计划保存到 `.workflow/scratch/{日期}-plan-P{阶段}-{主题}/plan.json` 与 `.task/TASK-*.json`，并注册 `PLN-*`。
- 实施、验证和评审由对应 skill 注册 `EXC-*`、`VRF-*`、`REV-*`。
- `.workflow/.maestro/*/status.json` 只保存编排状态；`.workflow/specs/` 只保存交付后沉淀的跨任务稳定规则。
- 多目标迁移只共享一份源分析和 blueprint；每个目标分别生成自己的目标分析、计划、实施与评审产物。跨仓库引用使用直接 path，不假设 artifact ID 能跨仓库解析。

## 项目族规则

默认项目族是 `承接 / 兑接 / 承载` 与 `前台 / 后管` 的 `2 x 3` 矩阵。业务角色由用户和项目事实决定，不能根据 Vue 版本、Pinia/Vuex、构建工具、仓库名或 `/api/admin` 前缀猜测。

同一行是默认 sibling 范围。前台与后管之间只有在用户明确要求、需求文档明确覆盖或共享接口契约要求一致时才跨行分析。

## 验证与交付

每个目标至少执行 `git diff --check`、目标文件 lint/test、必要 build 或契约测试，并覆盖目标专有入口和未迁移场景。无法运行的验证说明原因，不把静态检查描述成运行时验证。

最终用中文按项目报告：证据入口、Maestro 产物链、最终需求账本、项目范围、迁移决策、关键差异、修改文件、剃刀排除项、五项门禁、验证结果、残余风险和提交/推送状态。
