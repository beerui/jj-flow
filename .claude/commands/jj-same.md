---
name: jj-same
description: 基于会话 ID、需求、分支、commit 或 diff，首次迁移同源项目功能，或按上次成功基线持续同步后续更新、修复和需求变更。
argument-hint: "<首次迁移或 sync_key、当前需求、源/目标项目、分支、commit 或 diff>"
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

同步需求不变量，不复制源项目文件。首次迁移建立可验证基线；后续只处理源项目自上次成功同步后的有效增量，再按目标项目真实能力做最窄适配。

## 五项门禁

每次迁移都必须逐项回答：

- 稳健：是否基于当前需求、真实会话、分支提交和目标调用链交叉验证？是否保护脏工作区和旧功能？
- 剃刀：哪些文件、提交、文档、格式化、legacy 对齐和顺手重构与验收无关，必须排除？
- 精准：是否定位到每个目标的真实入口、接口、状态、错误处理和专有场景？
- 最小化：能否用更少文件、更少控制流变化和更窄验证范围完成同一验收？
- 复用：是否复用需求语义以及目标项目已有 API wrapper、组件、store、常量和测试模式？

## 工作流

1. 确认源项目、目标项目、证据入口和操作类型：首次迁移、建立持续同步、继续同步、修复、增需、删需或产品调整。
2. 当前用户需求优先于历史会话；历史会话和 assistant 交付摘要只作为线索，必须用 Git 和当前源码验证。
3. 分支或 commit 证据用 `merge-base..feature-ref` 按时间看提交，区分新增、修复、回退和产品反转。
4. 用 `maestro-analyze` 生成源分析 `ANL-SOURCE`，建立需求账本、源变更地图和剃刀清单。
5. 用 `maestro-blueprint` 消费源分析，在 `.workflow/blueprint/BLP-*/requirements/REQ-*.md` 生成正式需求；保留 `UNRESOLVED`，不得把推断写成产品事实。
6. 每个目标用 `maestro-analyze --from blueprint:BLP-*` 生成独立 `ANL-TARGET`，建立能力矩阵，决策只使用：`DIRECT`、`ADAPT`、`EXTEND`、`BLOCKED`、`N/A`。
7. 仅在 blueprint readiness 通过且目标无阻塞时，用 `maestro-plan --from analyze:ANL-*` 生成 `PLN`，再调用 `maestro-execute` 和 `quality-review`。
8. 只改用户明确授权的目标项目；用户只要求分析时，不写业务代码。
9. 每一行改动都要追溯到 `REQ-*`、`MUST` 或目标专有的 `TARGET-ONLY`。
10. 多个目标分别实施、分别验证、分别提交；不要整分支 cherry-pick，不整文件覆盖。

## 持续同步

- 首次 A -> B 迁移成功后分配 `SYNC-{feature-slug}`，通过 `maestro spec add arch` 在 A 保存 outgoing 索引、在 B 保存 incoming 契约；两端记录源/目标、功能范围、目标专有行为、排除项和触发策略。
- 可变的 `last_source_head` 不写入 spec；从 B 最近一次成功的 `VRF/REV` 交付链或 `NO_CHANGE_REQUIRED` 目标分析反查。
- 后续只分析 `last_source_head..current_source_head`，并分类为 `REQUIREMENT_CHANGE / BUG_FIX / REFACTOR / REVERT / NOISE`。
- 产品行为变化时生成新的 blueprint 增量；仅修复同一需求下的 bug 时复用原 blueprint，但必须证明 B 存在同一根因。
- 目标分析比较上次成功状态、B 当前状态和 A 新增量，保护 B 的本地修改。
- 同步失败不推进基线；下次继续从旧基线累计补齐。
- 全部增量均被证据判定为 `N/A / NOISE / DO-NOT-PORT` 时，由 `ANL-TARGET` 记录 `NO_CHANGE_REQUIRED` 零改动检查点，不伪造执行和验证产物。
- 本命令不是后台监听器。自动化由 A 的 CI 发送 `sync_key`、`before_sha`、`after_sha` 和 `changed_paths`，默认只在 B 创建待审查 PR，不自动合并。

## 修改完成决策门禁

源修改和验证完成后，先展示并核对项目根目录、origin、业务角色、当前分支、HEAD、工作区和验证结果。与同步契约不一致、detached HEAD、ref 不可解析时标记 `BLOCKED`；未形成稳定 commit 时只标记 `PREVIEW_ONLY`。

逐项目列出角色、路径、目标分支、`sync_key`、检查点、源范围和 `READY / ALREADY_SYNCED / ELIGIBLE / DEFERRED / PREVIEW_ONLY / BLOCKED / N/A`。有可操作目标时询问用户选择 `SYNC_NOW / DEFER / NOT_APPLICABLE / PAUSE_RELATION`；当前消息已明确指定同步目标时不重复确认。

`DEFER` 通过 `manage-issue` 在目标项目创建或更新 open issue。相同 `sync_key + target` 保留最早未同步 `before_sha`、更新最新 `after_sha`，且不推进基线；恢复时从最近成功检查点重算累计范围，成功或 `NO_CHANGE_REQUIRED` 后关闭 issue。

## Maestro 产物规范

- 不创建 `.workflow/jj-same/`。目标项目没有 `.workflow/` 时先调用 `maestro-init`。
- 源总结和目标评审保存到各自 `.workflow/.csv-wave/{日期}-analyze-{主题}/`，并注册 `ANL-*`。
- 正式需求保存到 `.workflow/blueprint/BLP-{主题}-{日期}/`，并注册 `BLP-*`。
- 实施计划保存到 `.workflow/scratch/{日期}-plan-P{阶段}-{主题}/plan.json` 与 `.task/TASK-*.json`，并注册 `PLN-*`。
- 实施、验证和评审由对应 skill 注册 `EXC-*`、`VRF-*`、`REV-*`。
- `.workflow/.maestro/*/status.json` 只保存编排状态；`.workflow/specs/` 保存交付后沉淀的稳定规则和持续同步契约，不保存可变 commit 游标。
- 多目标迁移只共享一份源分析和 blueprint；每个目标分别生成自己的目标分析、计划、实施与评审产物。跨仓库引用使用直接 path，不假设 artifact ID 能跨仓库解析。

## 项目族规则

默认项目族是 `承接 / 兑接 / 承载` 与 `前台 / 后管` 的 `2 x 3` 矩阵。业务角色由用户和项目事实决定，不能根据 Vue 版本、Pinia/Vuex、构建工具、仓库名或 `/api/admin` 前缀猜测。

同一行是默认 sibling 范围。前台与后管之间只有在用户明确要求、需求文档明确覆盖或共享接口契约要求一致时才跨行分析。

## 验证与交付

每个目标至少执行 `git diff --check`、目标文件 lint/test、必要 build 或契约测试，并覆盖目标专有入口和未迁移场景。无法运行的验证说明原因，不把静态检查描述成运行时验证。

最终用中文按项目报告：证据入口、源项目/分支确认、候选项目状态、用户同步决策、延期 issue、`sync_key`、源 commit range、检查点状态、Maestro 产物链、需求账本、迁移决策、验证结果、残余风险和提交/推送状态。
