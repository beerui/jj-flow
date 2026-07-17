---
name: jj-same
description: 基于会话 ID、需求、handoff snapshot、分支、commit 或 diff，首次迁移同源项目功能，或按上次成功基线持续同步后续更新、修复和需求变更。
argument-hint: "<准备交接、handoff_ref、更新交接、首次迁移或 sync_key、当前需求、源/目标项目、分支、commit 或 diff>"
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

同步需求不变量，不复制源项目文件。首次迁移建立可验证基线；后续只处理源项目自上次成功同步后的有效增量，再按目标项目真实能力做最窄适配。全流程**禁止调用 `maestro explore`**；代码定位使用 Read、Glob、Grep、Bash、`rg` 与定点读取。

## 交付生命周期

- 从领头项目的需求分析阶段进入 `/jj-same`，立即建立家族交付计划，不等源项目开发完成后才发现目标。
- 源项目形成稳定 commit、共享 `BLP/REQ` 和明确未解决项后，在源 `ANL-SOURCE` 内生成 `PARTIAL_HANDOFF` 或 `READY_FOR_HANDOFF` snapshot，并在家族计划记录唯一 `handoff_ref`。
- 承接项目领头时默认按 `cj -> dj -> cz` 串行；用户指定其它领头项目、顺序或子集时，以当前要求为准。
- 领头分支由用户创建。`cj -> dj -> cz` 只用于 agent 自动选择下一个目标；用户当前明确指定目标并要求“开始迁移/实施/开干”时，以该目标 `EXECUTION_READY` 为准，不要求其它 sibling 先完成 QA、UAT 或评审。
- 后续分支只替换项目角色前缀，保留类型、日期和任务序号：`feat/cj-0717-1 -> feat/dj-0717-1 -> feat/cz-0717-1`。
- 只为当前项目生成可执行任务；未来项目只记录高层范围、待验证差异和解锁门禁，不能预复制实现。
- 开发、修复、需求纠正、验证、评审、提交或阻塞变化后，同步更新家族交付计划。
- 共享需求变化时生成 successor snapshot，不原地改写旧版本；目标只复用共享需求语义，仍须验证自己的源码事实。
- 信息不足时先检查需求、会话、Git、文档和源码；仍不明确时，只采用不扩大范围、不新增产品行为且可回退的最窄默认值并记录假设。无法安全推断且会影响 `MUST`、验收、目标集合或不可逆实现时，直接记录为 `BLOCKED`，说明缺失证据和解除条件，不启动额外的需求拷问流程。
- 正常流程默认不执行编译、build、浏览器、E2E 或页面交互自测。完成非浏览器静态与聚焦检查后，只有改动涉及构建配置、运行时入口、用户交互、路由、异步状态、权限或跨页面流程，且静态证据不足时，才提示用户下一步手动测试，给出最小清单并标记 `READY_FOR_USER_TEST`；用户确认后进入 `READY_FOR_HANDOFF`。不需要时记录 `N/A` 理由并继续。用户主动要求代理执行时，才运行指定测试。

## 双门禁

- `EXECUTION_READY`：实施授权、稳定源 commit/diff、最终需求、目标调用链和 `MUST` 均已收敛。满足后选择 `EXECUTE_NOW`，生成最小计划并在同一轮直接修改业务代码和聚焦测试。
- `HANDOFF_READY`：目标实现、聚焦检查、非阻断评审和必要运行时验收均完成后，才允许宣称交接完成并推进检查点。
- 源 `quality-review`、`VRF/UAT`、家族计划或 canonical 产物为 `PENDING` 默认只是 caveat，不阻塞编码；明确失败、源不稳定、需求冲突或影响 `MUST` 的缺口才阻塞。
- 已有证据足够决策时，只补最小 ledger 和引用；不得用重复生成 `.workflow`、整套 blueprint 或计划状态更新代替业务实现。

## 五项门禁

每次迁移都必须逐项回答：

- 稳健：是否基于当前需求、真实会话、分支提交和目标调用链交叉验证？是否保护脏工作区和旧功能？
- 剃刀：哪些文件、提交、文档、格式化、legacy 对齐和顺手重构与验收无关，必须排除？
- 精准：是否定位到每个目标的真实入口、接口、状态、错误处理和专有场景？
- 最小化：能否用更少文件、更少控制流变化和更窄验证范围完成同一验收？
- 复用：是否复用需求语义以及目标项目已有 API wrapper、组件、store、常量和测试模式？

## 工作流

1. 确认源项目、目标项目、证据入口和操作类型：首次迁移、建立持续同步、继续同步、修复、增需、删需或产品调整。
2. 确认入口模式：`准备交接`、消费 `handoff_ref`、`更新交接`、无 snapshot 首次迁移或按 `sync_key` 后续同步。
3. 当前用户需求优先于历史会话；历史会话和 assistant 交付摘要只作为线索，必须用 Git 和当前源码验证。
4. 分支或 commit 证据用 `merge-base..feature-ref` 按时间看提交，区分新增、修复、回退和产品反转。
5. 无有效 snapshot 时，用 `maestro-analyze` 和 `maestro-blueprint` 生成共享 `ANL-SOURCE / BLP/REQ`；准备交接时按 `jj-same/handoff-snapshot/1.0` 写入 source inventory、source HEAD、coverage、验证状态和 canonical refs。
6. 消费 `handoff_ref` 时验证 source repo、HEAD、会话 cursor、来源指纹、父链和 canonical refs，输出唯一动作 `REUSE / REFRESH_SOURCES / REBASELINE / BLOCKED`。
7. `REUSE` 时目标 MUST NOT 重建源 `ANL-SOURCE / BLP`；`PARTIAL_HANDOFF` 按 `execution_readiness` 决策，`READY` 可带 caveat 实施，`BLOCKED` 只能分析。
8. 从源分析阶段维护家族协调计划；blueprint readiness 前只记录草案和阻塞项，通过后在领头项目注册协调 `PLN`。
9. 每个目标用 `maestro-analyze --from blueprint:BLP-*` 生成独立 `ANL-TARGET`，建立能力矩阵，决策只使用：`DIRECT`、`ADAPT`、`EXTEND`、`BLOCKED`、`N/A`。
10. 需求 readiness 通过且目标无影响 `MUST` 的阻塞时，用 `maestro-plan --from analyze:ANL-*` 生成最小 `PLN`；当前请求已要求实施时，同一轮继续调用 `maestro-execute` 修改业务代码，不停在计划产物。
11. 只改用户明确授权的当前项目；用户只要求分析时，不写业务代码。
12. 每一行改动都要追溯到 `REQ-*`、`MUST` 或目标专有的 `TARGET-ONLY`。
13. 多个目标按计划顺序分别实施、验证和提交；不要整分支 cherry-pick，不整文件覆盖。

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
- Handoff snapshot 保存到源 `ANL-SOURCE/requirement-baseline/{snapshot_id}/handoff-snapshot.yaml`；`context-package.json` 只记录 `snapshot_id` 和 `handoff_ref`。
- 正式需求保存到 `.workflow/blueprint/BLP-{主题}-{日期}/`，并注册 `BLP-*`。
- 实施计划保存到 `.workflow/scratch/{日期}-plan-P{阶段}-{主题}/plan.json` 与 `.task/TASK-*.json`，并注册 `PLN-*`。
- 实施、验证和评审由对应 skill 注册 `EXC-*`、`VRF-*`、`REV-*`。
- `.workflow/.maestro/*/status.json` 只保存编排状态；`.workflow/specs/` 保存交付后沉淀的稳定规则和持续同步契约，不保存可变 commit 游标。
- 多目标迁移只共享一份源分析和 blueprint；每个目标分别生成自己的目标分析、计划、实施与评审产物。跨仓库引用使用直接 path，不假设 artifact ID 能跨仓库解析。
- 有效 `handoff_ref` 是共享源分析和 blueprint 的发现入口；目标不得复制 snapshot、Source Inventory 或需求正文。
- 家族协调 `PLN` 由领头项目持有，只记录顺序、状态、分支、会话交接和门禁；不替代目标仓库的实施 `PLN`。

## 项目族规则

默认项目族是 `承接 / 兑接 / 承载` 与 `前台 / 后管` 的 `2 x 3` 矩阵。业务角色由用户和项目事实决定，不能根据 Vue 版本、Pinia/Vuex、构建工具、仓库名或 `/api/admin` 前缀猜测。

同一行是默认 sibling 范围。前台与后管之间只有在用户明确要求、需求文档明确覆盖或共享接口契约要求一致时才跨行分析。

## 验证与交付

每个目标由代理执行 `git diff --check`、目标文件 lint、聚焦单元测试或契约测试等非浏览器检查，并默认跳过编译、build、浏览器、E2E 和页面交互自测。运行时验证不必要时记录 `N/A` 理由并继续；必要时提示用户下一步手动测试，输出覆盖本次实际风险的最小清单并保持 `READY_FOR_USER_TEST`，用户确认通过后才记录验收证据并进入 `READY_FOR_HANDOFF`。只有用户主动要求时才由代理运行 build 或浏览器测试。

最终用中文按项目报告：证据入口、源项目/分支确认、候选项目状态、用户同步决策、延期 issue、`sync_key`、源 commit range、检查点状态、Maestro 产物链、需求账本、迁移决策、验证结果、残余风险和提交/推送状态。

当前项目完成时还要输出跨会话交接包：前一会话 ID、`snapshot_id`、`handoff_ref`、snapshot hash 和 freshness、领头/当前/下一项目路径与角色、分支、HEAD、验证 commit range、`BLP/ANL/PLN/VRF/REV` 引用、家族计划位置、派生分支、未解决项及 `TARGET-ONLY / DO-NOT-PORT`。新会话必须先验证 snapshot、Git 和目标源码事实。

典型调用：

```text
/jj-same 准备交接 会话=019f... 源提交=c0c360f9d 功能=密码更新提醒
/jj-same 交接=@D:\path\to\ANL-SOURCE\requirement-baseline\HOF-feature-001\handoff-snapshot.yaml 当前项目=兑接 开始迁移
/jj-same 更新交接 交接=@D:\path\to\HOF-feature-001\handoff-snapshot.yaml 会话=019f... 源提交=<new-commit> 变更=<需求纠正或 bug fix>
```
