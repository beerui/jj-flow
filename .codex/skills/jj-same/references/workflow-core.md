# jj-same Workflow Core（细则）

从主 `SKILL.md` 下沉的长流程与证据细节。主路径 checklist 见 [happy-path.md](happy-path.md)。

## 交付生命周期

`jj-same` 从领头项目的需求分析阶段进入，不等领头项目开发完成后才做同步 discovery。识别到同源项目族后立即：

1. 登记本轮项目族、授权范围、领头项目和交付顺序。
2. 在领头项目建立家族交付计划，持续记录分支映射、会话 ID、artifact refs、验证证据、差异和下一个项目门禁。
3. 源项目形成稳定 commit、共享 `BLP/REQ` 和明确未解决项后，在源 `ANL-SOURCE` artifact 内生成 `PARTIAL_HANDOFF` 或 `READY_FOR_HANDOFF` snapshot，并把唯一 `handoff_ref` 写入家族计划。
4. 项目A领头时默认按 `pa -> pb -> pc` 串行；用户指定其它领头项目、顺序或子集时以当前要求为准。
5. 只为当前项目生成可执行实施任务；未来项目只保留高层范围和待验证差异。
6. 开发、修复、需求纠正、验证、评审、提交或阻塞状态变化后，先同步更新家族交付计划；共享需求变化时生成 successor snapshot，不原地改写旧版本。

领头分支由用户创建。`pa -> pb -> pc` 是 agent 自动选择下一个目标时的默认协调顺序，不是用来否决用户当前明确指定目标的硬门禁。用户在当前消息明确指定“当前项目/目标 + 开始迁移/实施/开干”时，视为已主动触发该目标；只要该目标满足 `EXECUTION_READY`，即可从**新鲜**集成基线（默认 `master` / `origin/master`）创建开发分支并实施，不要求其它 sibling 已完成 QA、UAT 或评审。未被本轮选择的项目保持原状态并记录原因。分支名沿用领头分支的类型、日期和任务序号，只替换项目角色前缀，例如 `feat/pa-0717-1 -> feat/pb-0717-1 -> feat/pc-0717-1`。

**CREATE 基线新鲜度（EP-20260803）**：创建功能分支前必须 `git fetch` 集成基线，并保证新分支 tip **不落后于** `origin/<base>`（默认 `origin/master`）。允许：干净 local base 上的 **ff-only** 更新，或 **直接从 `origin/<base>` 建分支**（可不移动 local master 指针）。**禁止**：在 `behind_count > 0` 时从陈旧 local tip 静默 `checkout -b`；**禁止**对脏/分叉 local `master` 做 `reset --hard` 或未确认的改写。不得修改未授权仓库。细节见 [branch-purpose-preflight.md](branch-purpose-preflight.md) checks 6–10 / G6。

存在 `$jj-dispatch` 控制项目时，以控制 manifest 中明确批准的角色与 `targets` 为本轮协调事实；`jj-same` 仍只负责迁移、差异适配和同步检查点。没有控制项目时兼容 `源=A 目标=B,C`，不强制升级旧 handoff snapshot。家族计划 ≠ dispatch 批准。

## 双门禁扩展（执行优先级）

- 源项目缺少最新 `quality-review PASS`、`VRF/UAT` 为 `PENDING`、家族计划未更新或 canonical 产物不完整，默认是交付 caveat 或待补记录，不是 `EXECUTION_READY` 的阻塞项。只有已有明确失败证据、源 commit 不稳定、最终需求无法收敛、目标事实不可验证，或存在影响 `MUST` 的冲突时才阻塞编码。
- 用户明确说“开始迁移”“实施”“开干”时选择 `EXECUTE_NOW`。完成必要事实核对后，下一项实质动作必须是目标业务代码或聚焦测试修改；不得继续用补齐 `.workflow`、重复 blueprint、重复源评审或更新计划状态代替实施。
- 家族计划、snapshot、`ANL/BLP/PLN` 用于保存会影响决策的证据。已有资料足以决策时只补最小引用和 ledger；不得为了产物数量重建已存在的源分析、需求正文或整套 blueprint。

遇到信息缺口时先检查当前需求、会话、Git、项目文档和源码；仍不明确时，只采用不扩大范围、不新增产品行为且可回退的最窄默认值，并在计划中记录假设。无法安全推断且会影响 `MUST`、验收标准、目标项目集合或不可逆实现时，直接记录为 `BLOCKED`，说明缺失证据和解除条件，不启动额外的需求拷问流程。

正常流程默认不执行编译、build、浏览器、E2E 或页面交互自测。代理完成非浏览器静态与聚焦检查后，根据改动与验收条件判断是否需要运行时验证。只有改动涉及构建配置、运行时入口、用户交互、路由、异步状态、权限或跨页面流程，且静态证据不足以覆盖风险时，才提示用户下一步手动执行必要测试，给出最小清单并标记 `READY_FOR_USER_TEST`。用户确认通过后进入 `READY_FOR_HANDOFF`；不需要时记录 `N/A` 理由并继续，不额外打扰用户。用户主动要求代理执行时，才运行指定的 build 或浏览器测试。

## 证据入口

### 会话驱动

用户给出会话 ID 和需求时：

1. 优先使用 Codex `read_thread`；若旧会话不可见，定位 `$CODEX_HOME/sessions` 或 `archived_sessions` 中的 JSONL。
2. 可运行 [../scripts/extract_session_evidence.py](../scripts/extract_session_evidence.py) 提取用户变更指令、工作目录和 assistant 最终交付摘要。
3. 将当前用户需求置于最高优先级；会话中的后续纠正覆盖早期要求。
4. assistant 交付摘要只能作为定位线索，必须用 Git 和当前源码验证。

```bash
python -X utf8 scripts/extract_session_evidence.py \
  --thread-id '019f3a6a-07f2-7c80-a75e-3d40be996901'
```

### 分支驱动

用户给出功能分支、commit 或 diff 时：

1. 确认源仓库、基线 ref 和功能 ref；不要假设当前 checkout 就是源分支。
2. 用 `merge-base..feature-ref` 按时间查看提交，区分新增、修复、回退和产品反转。
3. 可运行 [../scripts/collect-port-evidence.mjs](../scripts/collect-port-evidence.mjs) 比较源变更范围、技术栈和目标同路径文件（Windows / macOS / Linux 共用 Node 实现；`.sh` / `.ps1` 仅为薄启动器，见 [../scripts/README.md](../scripts/README.md)）。
4. 继续沿目标调用链分析；同路径文件存在不代表可直接复制。

优先入口（全平台）：

```bash
node scripts/collect-port-evidence.mjs \
  --source-repo /path/to/source \
  --source-base master \
  --source-ref feat/example \
  --target-repo /path/to/target \
  --target-ref HEAD
```

macOS / Linux 也可：

```bash
./scripts/collect-port-evidence.sh \
  --source-repo /path/to/source \
  --source-base master \
  --source-ref feat/example \
  --target-repo /path/to/target
```

Windows PowerShell 兼容入口：

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

### 交接快照驱动

用户给出 `handoff_ref` 时：

1. 解析 `jj-same/handoff-snapshot/1.0`，验证 source repo、HEAD、会话 cursor、来源指纹、父链和 canonical refs。细则见 [handoff-snapshot.md](handoff-snapshot.md)。
2. 输出 `FRESH / PARTIAL / STALE / BROKEN` 和唯一启动动作 `REUSE / REFRESH_SOURCES / REBASELINE / BLOCKED`。
3. `REUSE` 时直接消费 snapshot 引用的共享 `ANL-SOURCE / BLP/REQ`，目标仓库 MUST NOT 重新生成源分析或 blueprint。
4. `REFRESH_SOURCES` 只读取变化、新增、恢复可用或关联 `UNRESOLVED` 的来源，并在源 artifact 归属仓库生成 successor snapshot。
5. `PARTIAL_HANDOFF` 必须单独读取 `execution_readiness`：`READY` 表示仅缺交付完成证据，可带 caveat 实施；`BLOCKED` 表示源不稳定、需求冲突或存在影响 `MUST` 的缺口，不创建可执行 `PLN` 或业务改动。
6. 目标仍必须基于当前源码生成自己的 `ANL-TARGET`，并记录 `snapshot_id`、`handoff_ref`、snapshot hash 和 source HEAD。

## 产物路由（细节）

摘要与 canonical 表以 [artifact-routing.md](artifact-routing.md) 为准。不要在需求和目标事实尚未收敛时直接改代码，也不要把“产物链完整”误当成“事实充分”。根据输入选择最短路径：

- **快速实施**：用户明确要求迁移/实施，稳定源 commit/diff、最终需求来源和目标调用链均可验证，且无影响 `MUST` 的 `UNRESOLVED`。复用已有 `ANL/BLP/REQ`；缺失时在目标 `ANL-TARGET` 记录带来源引用的最小需求 ledger，生成最窄 `PLN` 后立即进入 `EXC`。不得仅为形式完整重建全量 `ANL-SOURCE` 或 blueprint；缺失的 canonical 交接产物在 `HANDOFF_READY` 前补齐。
- **标准发现**：需求存在冲突、源范围不清、需要多个目标复用共享语义，或影响 `MUST` 的证据尚未收敛。此时按完整链生成源分析和正式需求。
- **快照复用**：存在有效 `handoff_ref` 时复用共享源分析与需求，只做 freshness、目标分析、实施和验证。

标准发现路径按顺序生成并注册：

1. **源分析 `ANL-SOURCE`**：用 `源/目标分析` 总结会话、需求演变、commit、diff、源变更地图、需求账本初稿和剃刀清单。
2. **正式需求 `BLP`**：用 `正式需求生成` 消费源分析，把确认内容生成到 `.workflow/blueprint/BLP-*/requirements/REQ-*.md`；`UNRESOLVED` 不得改写成确认需求。
3. **目标分析 `ANL-TARGET`**：每个目标用 `目标分析（from blueprint:BLP-*）` 评审当前架构、调用链、目标能力矩阵、风险和迁移决策。跨仓库时使用 blueprint 的直接 path。
4. **实施计划 `PLN`**：仅在需求 readiness 通过且目标分析无影响 `MUST` 的阻塞后，用 `实施计划（from analyze:ANL-*）` 生成最小 `plan.json` 和 `.task/TASK-*.json`；计划生成后同一实施请求继续编码，不停在计划交付。
5. **实施与复审 `EXC/VRF/REV`**：用 `实施执行` 实施，用 `quality-review` 复审；由各 skill 写入 canonical 产物并注册到目标仓库 `.workflow/state.json`。

源项目完成第 1、2 步并形成稳定 commit 后，用 [handoff-snapshot.md](handoff-snapshot.md) 的契约在源 `ANL-SOURCE` 内生成 handoff snapshot。目标提供有效 `handoff_ref` 时复用共享第 1、2 步，只执行 freshness gate 和自己的第 3 至 5 步；不得为了“产物完整”在每个目标复制一套源分析和 blueprint。

多项目任务从 `ANL-SOURCE` 阶段就维护家族协调计划。blueprint readiness 前只记录计划草案和阻塞项；readiness 通过后由 `实施计划` 在领头项目注册家族协调 `PLN`。它只管理项目顺序、状态、分支、会话交接和解锁门禁，不替代每个目标自己的 `ANL-TARGET -> PLN`。

无 handoff snapshot 的单目标迁移由目标仓库拥有整条产物链。准备交接模式由源 artifact 归属仓库持有共享源分析、blueprint 和 snapshot；无论一个还是多个目标，每个目标都必须分别拥有 `ANL-TARGET`、`PLN`、`EXC/VRF` 和 `REV`。目标仓库没有 `.workflow/` 时先运行 `工作流初始化`。

后续同步走增量链：

1. 从目标 arch spec 恢复 `sync_key` 和稳定范围，从最近成功的 `VRF/REV` 交付链或 `NO_CHANGE_REQUIRED` 目标分析反查 `last_source_head`。
2. 用 `源/目标分析` 分析 `last_source_head..current_source_head`，生成 `ANL-SOURCE-DELTA`。
3. 产品行为变化时生成新的 `BLP-*` 需求增量；仅修复同一需求下的 bug 时复用原 blueprint。
4. 每个目标重新生成 `ANL-TARGET -> PLN -> EXC/VRF -> REV`，不能沿用旧目标分析直接改代码。
5. 只有目标的非浏览器检查通过、必要的用户手动测试已确认通过或有证据标记为 `N/A`，且评审不阻塞；或目标分析证明全部增量无需修改，才把本次 `current_source_head` 作为下一次成功检查点。

源分析和目标分析至少形成以下内容：

- **需求账本**：`MUST`、`TARGET-ONLY`、`DO-NOT-PORT`、`UNRESOLVED`。
- **源变更地图**：需求行为 -> commit -> 文件 -> 方法/API -> 验证证据。
- **目标能力矩阵**：每个目标的对应入口、差异、风险和迁移决策。
- **剃刀清单**：明确不迁移的文件、legacy、文档、格式化和已回退行为。
- **交接快照**：共享需求引用、来源指纹、source HEAD、coverage、用户纠正顺序、验证状态和目标待验证差异。

对每项能力标记一种决策：

- `DIRECT`：目标契约和结构同构，可重放同一语义补丁。
- `ADAPT`：业务相同，但框架、API、状态或组件结构不同，按目标原生实现。
- `EXTEND`：目标存在源项目没有的专有入口，必须额外覆盖。
- `BLOCKED`：应支持但缺接口、产品口径或基础能力。
- `N/A`：目标没有该业务场景。

真实项目的任务、handoff、dispatch、报告和 receipt 必须进入 `.workflow/` 的任务分目录；**不得**创建 `.workflow/jj-same/` 私有目录或把需求正文写入 `.workflow/.sessions/*/status.json`。`jj-flow` 自身仓库仍不把 `.workflow` 作为事实源。

## 持续同步规则

完整契约、检查点与延期字段见 [continuous-sync.md](continuous-sync.md)。摘要：

- 为每项 A -> B 功能关系分配 `SYNC-{feature-slug}`，首次交付成功后通过 `写入 arch spec` 在 A 写 outgoing 索引、在每个 B 写 incoming 契约。
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

详细执行与延期字段读取 [continuous-sync.md](continuous-sync.md)。不要自行切换仓库或分支来让候选变成 `READY`。

## 工作流 1–7

### 1. 锁定范围

- 确认操作类型：首次迁移、建立持续同步、继续同步、问题修复、需求新增、需求删除或产品调整。
- 确认入口模式：准备交接、消费 `handoff_ref`、更新交接、无 snapshot 首次迁移或按 `sync_key` 后续同步。
- 确认源项目、目标项目、共享 blueprint 的产物归属仓库、证据入口和是否要求提交/推送。
- 确认领头项目、默认或用户指定的交付顺序、领头分支、目标派生分支和家族交付计划归属；项目A领头时默认 `pa -> pb -> pc`。
- **分支用途 + 基线新鲜度 preflight（硬门，开干前必做）**：读取 [branch-purpose-preflight.md](branch-purpose-preflight.md)。在写业务代码或创建目标分支前，用当前仓库 `git branch --show-current` / HEAD 回答：任务用途、当前分支用途、意图工作分支、本回合 integration、以及（若用户问发布内容）**tip 树**是否含目标能力。任务用途与当前分支用途不一致时标记 `BLOCKED`，只允许切换/创建正确分支或记录用户显式「就落在此 train 分支」的覆盖；禁止因 checkout 顺手把需求接到发布火车或无关 feature 线（回归：EP-20260730-S1）。**CREATE 时额外**：`git fetch` 后填 `base` / `origin_base` / `behind_count` / `base_action`；`behind_count > 0` 禁止从陈旧 local tip 建分支（回归：EP-20260803）。
- 持续同步时确认 `sync_key`、源 ref、触发模式和上一次成功检查点；缺失检查点且无法验证初始基线时保持 `BLOCKED`。
- 用户只要求分析时，无有效 handoff snapshot 才生成 `ANL-SOURCE` 和 `BLP`；已有有效 snapshot 时只完成 freshness gate 与当前目标 `ANL-TARGET`，不写业务代码。
- 用户要求迁移或修改时，完成分析后继续实施；未明确时不擅自提交或推送。
- agent 自动推进下一个项目时，前置项目须达到 `HANDOFF_READY`；用户在当前消息明确指定目标并要求实施时，以该目标 `EXECUTION_READY` 为准，不要求其它 sibling 先完成。
- 有 `handoff_ref` 时先做 freshness gate；`STALE/BROKEN` 不得继续使用，`PARTIAL` 不得绕过影响 `MUST` 的源门禁。

### 2. 建立仓库事实

在每个仓库分别执行其 `AGENTS.md` 和架构门禁。至少检查：

- `ARCHITECTURE.md` 相关章节、`package.json`、当前分支和工作区状态。
- 路由/入口 -> 页面 -> 组件 -> API -> store/request wrapper 的真实链路。
- 接口路径、参数、响应包裹层、错误码和错误提示所有权。
- 目标专有入口、feature flag、租户差异、权限和 legacy 条件。
- 目标已有测试、lint、build 和提交 hook。

定位代码时直接使用 `rg`/Grep、Git 和定点读取。

### 3. 生成正式需求

- 首次迁移从 `ANL-SOURCE` 生成 正式需求 blueprint，不手写散落的 AI 需求文档。
- 后续同步仅在产品行为变化时生成继承旧需求的新 blueprint；不改变产品契约的 bug fix 复用原 `BLP-* / REQ-*`。
- 把 `MUST` 与确认后的 `TARGET-ONLY` 转成可追踪的 `REQ-*` 和验收条件。
- 把 `DO-NOT-PORT` 写入 out-of-scope；保留 `UNRESOLVED` 并阻止 readiness 假通过。
- readiness 为 `Fail` 时停止；为 `Review` 时把 caveat 完整传给目标分析和计划。
- 源需求可交接后生成 handoff snapshot；目标命中有效 snapshot 时复用正式需求，不重复生成 blueprint。

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

把通过评审的矩阵交给 `实施计划`，让 `plan.json` 和每个 `TASK-*` 追溯到 `REQ-*` 或带来源引用的临时 `MUST` ledger、目标分析与最小文件范围。只有影响 `MUST` 的 `UNRESOLVED` 或 `BLOCKED` 才阻止实现；评审、UAT、家族计划和 canonical 交接记录的待补状态不得伪装成业务阻塞。

### 6. 实施增量

进入本节即代表 `EXECUTION_READY`。若当前请求明确要求实施，完成最小计划后必须在同一轮继续修改业务代码和聚焦测试，除非新发现影响 `MUST` 的硬阻塞；不得只更新任务状态、scratch、blueprint 或家族计划后结束。

- 新功能：迁移完整行为闭环，不迁移源项目偶然结构。
- 修复问题：先证明目标存在相同根因；没有相同根因的不改。
- 增加需求：从最后接受状态只迁移新增增量。
- 删除需求：删除对应行为；只清理由该功能引入且确认无消费者的代码。
- 产品反转：用最新行为覆盖旧行为，并检查旧状态和条件是否残留生效。

发现用户已有改动时与其协作，不覆盖、不回退、不格式化无关内容。多个目标分别实施、分别验证、分别提交。

每次状态变化后更新家族交付计划。源项目达到交接门禁时生成或更新不可变 handoff snapshot；当前项目完成后生成跨会话交接包，至少包含前一会话 ID、`snapshot_id`、`handoff_ref`、项目路径和角色、分支、HEAD、验证 commit range、`BLP/ANL/PLN/VRF/REV` 引用、计划位置、下一目标和派生分支、未解决项及 `TARGET-ONLY / DO-NOT-PORT`。新会话先验证 snapshot freshness、Git 和目标源码事实，再消费旧会话证据。

持续同步完成后，在目标交付报告中记录 `sync_key`、`last_source_head`、`current_source_head`、目标 commit 和产物链。只有第 7 步验证满足已实施检查点，或目标分析满足 `NO_CHANGE_REQUIRED` 零改动检查点，才能把 `current_source_head` 标记为新的已同步基线。

### 7. 分层验证

每个目标至少完成：

1. 代理运行 `git diff --check`、目标文件 lint、聚焦单元测试或契约测试等非浏览器检查。
2. 默认跳过编译、build、浏览器、E2E 和页面交互自测；只有用户主动要求代理执行时才运行。
3. 判断运行时验证是否必要：构建配置、运行时入口、用户交互、路由、异步状态、权限或跨页面流程发生变化，且静态证据不足以覆盖风险时为必要；无运行时影响时记录 `N/A` 理由并继续。
4. 必要时提示用户下一步手动测试，按目标能力矩阵输出最小清单，覆盖本次实际风险，并将状态标记为 `READY_FOR_USER_TEST`。
5. 用户未确认时不得写成验证通过、`COMPLETED` 或 `READY_FOR_HANDOFF`；确认通过后写入 `VRF` 和家族交付计划，反馈失败时回到修复流程。
6. 检查 `git status`；提交 hook 运行后再次检查工作区；按五项准则**内心**复审最终 diff（不输出给用户）。

用户可见验证说明：一句话说清代理实际运行、默认跳过、`N/A`、等待用户测；不能把静态检查描述成运行时或用户验收。

## 交付格式（用户可见 = 短总结）

**默认**对用户按项目输出**紧凑中文小结**，不要长报告、不要「五项门禁」分项：

| 必含 | 内容 |
| --- | --- |
| 目标 | 项目角色 / path / 分支 @ short sha |
| 决策 | `DIRECT` / `ADAPT` / … + 一句差异 |
| 改动 | 文件列表或路径 + 行为一句话 |
| 验证 | 跑了 / 跳过 / 待用户 |
| Git | 是否 commit/push；脏工作区 |
| 阻塞/下一步 | 仅当有时写一句 |

**禁止**（除非用户明确要求「详细报告 / 写 artifact / BLOCKED 举证」）：

- 标题或列表背诵「稳健 / 剃刀 / 精准 / 最小化 / 复用」及类似口号式打勾
- 默认甩完整 `ANL/BLP/PLN/EXC/VRF/REV` 路径清单
- 复读 skill 全文式交付模板

**需要落盘时**（`.workflow/` artifact、家族计划、dispatch receipt）：可写完整证据链与自检记录；那是文件事实，不是聊天仪式。用户聊天仍以短总结为主。

持续同步场景在小结中补一行：`sync_key`、源/目标 head 范围、检查点是否推进即可。
