---
name: jj-same
description: 基于用户给出的 Codex 会话 ID、需求文档、功能分支、commit 或 Git diff，在同源但已分叉的 A/B 项目之间首次迁移功能，或建立持续同步关系并按上次成功基线同步后续产品更新、需求增删、bug 修复和回退。用于需要按“稳健、剃刀、精准、最小化、复用”原则还原最终需求、识别项目差异、排除 legacy 和无关改动、生成迁移矩阵，并按目标项目原生架构实施与验证时。
---

# 跨项目精准迁移

同步需求不变量，不复制源项目文件。首次把 A 的功能迁到 B 时建立可验证基线；后续只处理 A 自上次成功同步后的有效增量，再按 B 的真实能力做最窄适配。

## 项目族

项目按业务角色形成 `2 x 3` 矩阵：

| 形态 | 承接 | 兑接 | 承载 |
|---|---|---|---|
| 前台 | 承接前台 | 兑接前台 | 承载前台 |
| 后管 | 承接后管 | 兑接后管 | 承载后管 |

开始任务时读取 [references/project-family.md](references/project-family.md)，确认逻辑角色、实际路径和迁移方向。业务角色由用户和项目事实决定，不能根据仓库名、框架或 API 前缀猜测。

同一行是默认 sibling 范围；前台与后管之间不是自动同步关系。只分析用户要求或需求确实覆盖的项目，只修改明确授权的目标项目。

开始生成迁移文档前读取 [references/maestro-artifact-routing.md](references/maestro-artifact-routing.md)，按 Maestro canonical path 保存并注册产物。不得创建 `.workflow/jj-same/` 或把需求正文写入 `.workflow/.maestro/*/status.json`。

用户要求 A 后续更新、修复或回退继续同步到 B 时，读取 [references/continuous-sync.md](references/continuous-sync.md)，建立或恢复 `sync_key` 与最近成功检查点。不要把“源分支已更新”误判为“目标已同步”。

## 五项门禁

每次迁移都必须逐项回答：

- **稳健**：是否基于当前需求、真实会话、分支提交和目标调用链交叉验证？是否保护脏工作区和旧功能？
- **剃刀**：哪些文件、提交、文档、格式化、legacy 对齐和顺手重构与验收无关，必须排除？
- **精准**：是否定位到每个目标的真实入口、接口、状态、错误处理和专有场景，而非只搜同名文件？
- **最小化**：能否用更少文件、更少控制流变化和更窄验证范围完成同一验收？
- **复用**：是否复用需求语义以及目标项目已有 API wrapper、组件、store、常量和测试模式，而不是复制源实现？

任一项没有证据时不得直接批量改代码。输出中保留五项门禁结论，不能只把关键词当口号。

## 证据入口

### 会话驱动

用户给出会话 ID 和需求时：

1. 优先使用 Codex `read_thread`；若旧会话不可见，定位 `$CODEX_HOME/sessions` 或 `archived_sessions` 中的 JSONL。
2. 可运行 [scripts/extract_session_evidence.py](scripts/extract_session_evidence.py) 提取用户变更指令、工作目录和 assistant 最终交付摘要。
3. 将当前用户需求置于最高优先级；会话中的后续纠正覆盖早期要求。
4. assistant 交付摘要只能作为定位线索，必须用 Git 和当前源码验证。

```powershell
python -X utf8 scripts/extract_session_evidence.py `
  --thread-id '019f3a6a-07f2-7c80-a75e-3d40be996901'
```

### 分支驱动

用户给出功能分支、commit 或 diff 时：

1. 确认源仓库、基线 ref 和功能 ref；不要假设当前 checkout 就是源分支。
2. 用 `merge-base..feature-ref` 按时间查看提交，区分新增、修复、回退和产品反转。
3. 可运行 [scripts/collect-port-evidence.ps1](scripts/collect-port-evidence.ps1) 比较源变更范围、技术栈和目标同路径文件。
4. 继续沿目标调用链分析；同路径文件存在不代表可直接复制。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/collect-port-evidence.ps1 `
  -SourceRepo 'D:\path\source' `
  -SourceBase 'master' `
  -SourceRef 'feat/example' `
  -TargetRepo 'D:\path\target' `
  -TargetRef 'HEAD'
```

### 混合驱动

同时存在会话、当前需求和分支时必须交叉验证：

- 会话解释“为什么改”和需求如何变化。
- 分支说明“实际改了什么”。
- 当前需求定义“这次最终要什么”。
- 目标源码决定“在这里如何最小实现”。

若四者冲突，先列冲突。当前用户明确要求优先；不能自行把源分支偶然实现升级为产品规则。

## Maestro 产物门禁

不要从会话或分支直接进入实现。首次迁移按顺序生成并注册：

1. **源分析 `ANL-SOURCE`**：用 `maestro-analyze` 总结会话、需求演变、commit、diff、源变更地图、需求账本初稿和剃刀清单。
2. **正式需求 `BLP`**：用 `maestro-blueprint` 消费源分析，把确认内容生成到 `.workflow/blueprint/BLP-*/requirements/REQ-*.md`；`UNRESOLVED` 不得改写成确认需求。
3. **目标分析 `ANL-TARGET`**：每个目标用 `maestro-analyze --from blueprint:BLP-*` 评审当前架构、调用链、目标能力矩阵、风险和迁移决策。跨仓库时使用 blueprint 的直接 path。
4. **实施计划 `PLN`**：仅在 blueprint readiness 通过且目标分析无阻塞后，用 `maestro-plan --from analyze:ANL-*` 生成 `plan.json` 和 `.task/TASK-*.json`。
5. **实施与复审 `EXC/VRF/REV`**：用 `maestro-execute` 实施，用 `quality-review` 复审；由各 skill 写入 canonical 产物并注册到目标仓库 `.workflow/state.json`。

单目标迁移由目标仓库拥有整条产物链。多目标迁移只生成一份共享源分析和 blueprint，但每个目标必须分别拥有 `ANL-TARGET`、`PLN`、`EXC/VRF` 和 `REV`。目标仓库没有 `.workflow/` 时先运行 `maestro-init`。

后续同步走增量链：

1. 从目标 arch spec 恢复 `sync_key` 和稳定范围，从最近成功的 `VRF/REV` 交付链或 `NO_CHANGE_REQUIRED` 目标分析反查 `last_source_head`。
2. 用 `maestro-analyze` 分析 `last_source_head..current_source_head`，生成 `ANL-SOURCE-DELTA`。
3. 产品行为变化时生成新的 `BLP-*` 需求增量；仅修复同一需求下的 bug 时复用原 blueprint。
4. 每个目标重新生成 `ANL-TARGET -> PLN -> EXC/VRF -> REV`，不能沿用旧目标分析直接改代码。
5. 只有目标验证通过且评审不阻塞，或目标分析有证据证明全部增量无需修改，才把本次 `current_source_head` 作为下一次成功检查点。

源分析和目标分析至少形成以下内容：

- **需求账本**：`MUST`、`TARGET-ONLY`、`DO-NOT-PORT`、`UNRESOLVED`。
- **源变更地图**：需求行为 -> commit -> 文件 -> 方法/API -> 验证证据。
- **目标能力矩阵**：每个目标的对应入口、差异、风险和迁移决策。
- **剃刀清单**：明确不迁移的文件、legacy、文档、格式化和已回退行为。

对每项能力标记一种决策：

- `DIRECT`：目标契约和结构同构，可重放同一语义补丁。
- `ADAPT`：业务相同，但框架、API、状态或组件结构不同，按目标原生实现。
- `EXTEND`：目标存在源项目没有的专有入口，必须额外覆盖。
- `BLOCKED`：应支持但缺接口、产品口径或基础能力。
- `N/A`：目标没有该业务场景。

## 持续同步规则

- 为每项 A -> B 功能关系分配 `SYNC-{feature-slug}`，首次交付成功后通过 `maestro spec add arch` 在 A 写 outgoing 索引、在每个 B 写 incoming 契约。
- spec 只保存源/目标、功能范围、目标专有行为、排除项和触发策略；可变 commit 游标从最近成功 artifact chain 反查。
- 后续同步必须比较“上次成功目标状态、B 当前状态、A 新增量”三方，保留 B 在首次迁移后产生的本地修改。
- 将源增量分类为 `REQUIREMENT_CHANGE / BUG_FIX / REFACTOR / REVERT / NOISE`。只有需求相关变化和同根因修复进入目标评审。
- 同步失败不推进基线；下次继续从旧基线累计分析，不能跳过中间 commit。
- 本轮全部增量均为 `N/A / NOISE / DO-NOT-PORT` 时，允许由 `ANL-TARGET` 形成 `NO_CHANGE_REQUIRED` 零改动检查点；不得伪造 `EXC/VRF/REV`。
- `jj-same` 不常驻监听 A。自动化只负责由 A 的 CI 发送 `sync_key + before_sha + after_sha + changed_paths`，默认在 B 创建待审查 PR，不静默改动或自动合并。

## 修改完成后的同步决策

源项目修改和验证完成后先做 discovery，不直接同步：

1. 展示并核对项目根目录、origin、业务角色、当前分支、HEAD、工作区与验证结果。
2. 从当前项目 arch spec 加载 outgoing sync contracts，并与当前项目和分支对齐；不一致、detached HEAD 或 ref 不可解析时标记 `BLOCKED`。
3. 源变更未形成稳定 commit 时只给 `PREVIEW_ONLY`，不能同步或推进检查点。
4. 列出每个可同步项目的角色、路径、目标分支、`sync_key`、检查点、源范围和 `READY / ALREADY_SYNCED / ELIGIBLE / DEFERRED / PREVIEW_ONLY / BLOCKED / N/A` 状态。
5. 有可操作目标时询问用户逐项目选择 `SYNC_NOW / DEFER / NOT_APPLICABLE / PAUSE_RELATION`。当前请求已明确指定立即同步的目标时不重复确认。
6. `DEFER` 通过 `manage-issue` 创建或更新目标项目 open issue；相同 `sync_key + target` 保留最早未同步起点并更新最新源 HEAD，不推进基线。
7. 恢复延期时从最近成功检查点重新计算累计范围；同步成功或形成 `NO_CHANGE_REQUIRED` 后关闭 issue。

详细执行与延期字段读取 [references/continuous-sync.md](references/continuous-sync.md)。不要自行切换仓库或分支来让候选变成 `READY`。

## 工作流

### 1. 锁定范围

- 确认操作类型：首次迁移、建立持续同步、继续同步、问题修复、需求新增、需求删除或产品调整。
- 确认源项目、目标项目、共享 blueprint 的产物归属仓库、证据入口和是否要求提交/推送。
- 持续同步时确认 `sync_key`、源 ref、触发模式和上一次成功检查点；缺失检查点且无法验证初始基线时保持 `BLOCKED`。
- 用户只要求分析时，完成并交付对应的 `ANL-SOURCE`、`BLP` 与 `ANL-TARGET`，不写业务代码。
- 用户要求迁移或修改时，完成分析后继续实施；未明确时不擅自提交或推送。

### 2. 建立仓库事实

在每个仓库分别执行其 `AGENTS.md` 和架构门禁。至少检查：

- `ARCHITECTURE.md` 相关章节、`package.json`、当前分支和工作区状态。
- 路由/入口 -> 页面 -> 组件 -> API -> store/request wrapper 的真实链路。
- 接口路径、参数、响应包裹层、错误码和错误提示所有权。
- 目标专有入口、feature flag、租户差异、权限和 legacy 条件。
- 目标已有测试、lint、build 和提交 hook。

仓库要求使用 Maestro 时先执行 `maestro search` 与 `maestro load`，定位代码先尝试 `maestro explore`。若 endpoint 未配置或调用失败，记录后回退到 `rg`、Git 和定点读取。

### 3. 生成正式需求

- 首次迁移从 `ANL-SOURCE` 生成 Maestro blueprint，不手写散落的 AI 需求文档。
- 后续同步仅在产品行为变化时生成继承旧需求的新 blueprint；不改变产品契约的 bug fix 复用原 `BLP-* / REQ-*`。
- 把 `MUST` 与确认后的 `TARGET-ONLY` 转成可追踪的 `REQ-*` 和验收条件。
- 把 `DO-NOT-PORT` 写入 out-of-scope；保留 `UNRESOLVED` 并阻止 readiness 假通过。
- readiness 为 `Fail` 时停止；为 `Review` 时把 caveat 完整传给目标分析和计划。

### 4. 评审目标并做迁移决策

建立矩阵：

| 能力/验收 | 源证据 | 目标入口 | 目标差异 | 决策 | 最小文件 | 剃刀排除项 |
|---|---|---|---|---|---|---|
| 业务行为 | 会话/doc/commit/file:line | 调用链或缺失 | 契约/框架/专有入口 | DIRECT/ADAPT/EXTEND/BLOCKED/N/A | files | 不迁移内容 |

- 同名目录、方法和接口只能当线索。
- 源项目有而目标没有的能力不能自动新建，先判定 `N/A` 或 `BLOCKED`。
- 目标额外入口必须作为 `EXTEND` 单独验收。
- 前台变更不能因“同品牌”自动迁入后管，反之亦然。

### 5. 设计最窄补丁

- 让每一行改动可追溯到需求账本中的 `MUST` 或该目标的 `TARGET-ONLY`。
- 复用目标现有 API wrapper、状态、组件、常量、错误处理和测试方式。
- 不整分支 cherry-pick，不整文件覆盖，除非已证明共同基线、内容同构且无目标专有逻辑。
- 不为了“方便维护”统一目标 legacy；只让新增或本次修改的逻辑保持一致。
- `.gitignore`、需求草稿、生成物、本地工具和无关格式化默认进入剃刀清单。

接口或异步 UI 额外检查：

- 慢请求 loading 范围和操作锁。
- 弹框关闭、切换对象、重复请求和旧响应晚到的竞态。
- 表单、验证码、滑块、倒计时和上一次对象状态重置。
- 全局与局部提示是否重复。
- 请求失败采用 fail-open、fail-closed 还是旧流程兜底。

把通过评审的矩阵交给 `maestro-plan`，让 `plan.json` 和每个 `TASK-*` 追溯到 `REQ-*`、目标分析与最小文件范围。存在影响 `MUST` 的 `UNRESOLVED`、`Deferred` 或 `BLOCKED` 时不得进入实现。

### 6. 实施增量

- 新功能：迁移完整行为闭环，不迁移源项目偶然结构。
- 修复问题：先证明目标存在相同根因；没有相同根因的不改。
- 增加需求：从最后接受状态只迁移新增增量。
- 删除需求：删除对应行为；只清理由该功能引入且确认无消费者的代码。
- 产品反转：用最新行为覆盖旧行为，并检查旧状态和条件是否残留生效。

发现用户已有改动时与其协作，不覆盖、不回退、不格式化无关内容。多个目标分别实施、分别验证、分别提交。

持续同步完成后，在目标交付报告中记录 `sync_key`、`last_source_head`、`current_source_head`、目标 commit 和产物链。只有第 7 步验证满足已实施检查点，或目标分析满足 `NO_CHANGE_REQUIRED` 零改动检查点，才能把 `current_source_head` 标记为新的已同步基线。

### 7. 分层验证

每个目标至少完成：

1. `git diff --check` 和目标文件 lint/test。
2. 按 `package.json` 与仓库规则执行必要 build 或契约测试。
3. 按目标能力矩阵覆盖正常、业务错误、慢请求、失败、关闭重开和快速切换。
4. 验证目标专有入口和未迁移场景确实不受影响。
5. 检查 `git status`；提交 hook 运行后再次检查工作区。
6. 用五项门禁复审最终 diff，发现无验收价值的行就删除。

无法运行的验证必须说明原因，不把静态检查描述成运行时验证。

## 交付格式

用中文按项目报告：

- 证据入口：使用了哪些会话、需求、分支和提交。
- 同步关系：`sync_key`、源/目标、分析 commit range、旧检查点与新检查点状态。
- 同步决策：源项目/分支确认结果、候选项目状态、用户对每个目标的选择和延期 issue ID。
- Maestro 产物链：每个仓库的 `ANL-*`、`BLP-*`、`PLN-*`、`EXC-*`、`VRF-*` 和 `REV-*` 路径及状态。
- 最终需求账本及后续要求覆盖关系。
- 六项目中哪些被分析、哪些被修改、哪些不适用及原因。
- 每个目标的迁移决策、关键差异、修改文件和剃刀排除项。
- `稳健 / 剃刀 / 精准 / 最小化 / 复用` 五项门禁结论。
- 实际验证、残余风险、提交与推送状态。

## 参考

- 处理项目角色、路径和迁移方向时读取 [references/project-family.md](references/project-family.md)。
- 生成需求、分析、计划、实施和评审文档时读取 [references/maestro-artifact-routing.md](references/maestro-artifact-routing.md)。
- 建立持续同步关系或同步后续更新、bug 修复和回退时读取 [references/continuous-sync.md](references/continuous-sync.md)。
- 处理沉默账户、登录或切换账户案例时读取 [references/silence-account-case.md](references/silence-account-case.md)。使用前重新验证分支，不把案例快照当永久源码事实。

## 调用示例

```text
$jj-same 会话=019f... 当前需求=保留密码入口 源=承接前台 目标=兑接前台,承载前台
$jj-same 源仓库=D:\... 源分支=feat/example 分析并迁移到同一行另外两个项目
$jj-same 基于 commit abc123 检查六个项目是否存在同根因，只修存在同根因的项目
$jj-same 建立持续同步：功能=沉默账户登录 源=A 目标=B，首次迁移并记录同步基线
$jj-same 同步 SYNC-silence-login，检查 A 从上次成功基线到 HEAD 的更新和 bug 修复并同步到 B
$jj-same 源修改完成，确认当前项目和分支，列出可同步项目并询问立即同步还是延期
```
