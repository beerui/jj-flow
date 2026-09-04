# Ralph 工作区目录对齐 exec-plans 与 progress 双轨

> 状态：Proposed
>
> **性质**：规划草案（目录结构预览 + 文件写入规范 + 分阶段实现方案）。本轮**不改 `src/ralph/`**；代码位置只为核对迁移成本而读。采纳后 §5 各 Phase 各自开 exec plan 再实现。
>
> 关联设计：[Ralph 任务工作区 `.plans` 化改造](ralph-plans-workspace.html)（Implemented，P0–P2+ 已落地；本草案是它的**后续修订**，冲突段落登记在 §3.5）· [Ralph 多轮任务内容预览](ralph-plans-workspace.preview.html)（Proposed，进度模板示例）· [jj-ralph](jj-ralph.html)
>
> 触发：业务仓 `scsk-admin` 的 `.workflow/ralph/` 在 P2 迁移后，根目录堆着多个 `.migrated-RALPH-*`，活跃任务与已完成任务混在 `tasks/`，没有一份「活跃表」；样本任务 `task-enter-form-fixed-preset` 的 `progress.md` 在二次纠正（字段 id → mapping）时**改写/交错**了第一轮正文，而且内容是门控机器流水账（`gate=PASS` / `deliver-attempt` / `archive in-place`），不是人可恢复的进度叙事。
>
> **样本可达性声明**：父代理暂存的 `/workspace/.tmp/ralph-sample-task-enter-form-fixed-preset/{task_plan,progress,findings}.md` 与 `ralph-sample-sidebar.png` 在本云端 VM 不存在（`.tmp/` 被 `.gitignore` 排除，未随仓库同步）。§4.2 的「反例」与 §6 短评基于父代理转述的场景与侧栏语义重构；§6 末尾给出核对清单，请父代理对照原文件确认。

## 0. 结论速览

| 问题 | 结论 | 章节 |
| --- | --- | --- |
| 活跃任务是否仍套 `tasks/`？ | **保留 `tasks/`，把它定义为 exec-plans 的 `active/`**：只放未关闭的任务；COMPLETED / ABANDONED 一律搬出。根上加 `index.md`。扁平化作备选，不推荐（P2 刚落地两天，二次硬切成本高，且 exec-plans 自己的活跃层也是子目录 `active/` 而非根） | §3.1 / §3.3 |
| 原地 COMPLETED 还是搬进专用目录？ | **搬**：`finalize` / `abandon` 把 `tasks/<id>` **rename** 到 `completed/<id>`；`resume` rename 回来。仍是零拷贝、同目录名、同 `run_id`，「任务目录即身份」不破——身份是目录**名**，不是父路径。`runDir()` 从字面拼接改为「tasks/ → completed/」两级解析 | §3.4 Q2 |
| 专用目录叫什么？ | `completed/`（不是 `archived/`）：对齐 exec-plans；`namingConfig` 已预留 `completed_dirname: 'completed'`；`listRuns` 已把 `completed` 列为保留名；避免与只读的 1.0 `archive/` 撞名 | §3.4 Q2 |
| `.migrated-RALPH-*` 去哪 | `migrated/RALPH-<原名>/`（去掉点前缀，目录本身就是标记）；重跑 `jj ralph migrate` 幂等收容存量；`jj ralph migrate --prune --yes` 人工触发删除；`index.md` 显示残骸数与提示。1.0 `archive/` 快照仍只读不动 | §3.4 Q3 |
| progress 流水账怎么治 | **双轨**：机器事件（gate / deliver-attempt / review / archive / setRunStatus / scope / promoted / hot_memory）全部改写到 `.state/events.log`（行格式不变，解析器只换文件）；`progress.md` 只留人读叙事，**按轮次追加**，`resume` 自动开新一轮标题，`jj ralph progress` 子命令代替 Read+Edit | §4.2 |
| 二次纠正怎么写 | 新开 `## 轮次 2 · 日期 · 用户纠正：…`，内含 `⟲ 回滚` 三行组 + `user_correction:` + 新迭代 + 本轮结果；**禁止改写轮次 1 正文**；因果进 findings `F-00N` 一条 | §4.2 样本 |
| Phase 0 能否先止血 | 能止一半：skill/模板能止住「改写历史」「无轮次结构」「叙事退化」；止不住「机器行混入」——那是 CLI 约 20 处 `appendProgressLine` 写进 progress.md 的，必须 Phase 2 分轨 | §5.1 |
| 不做什么 | 不升 schema 大版本（仍 1.2）；不动 dispatch；不迁不删 1.0 `archive/`；不把 `tasks/` 改名 `active/`；不自动 absorb；不写业务仓指令文件 | §5.8 |

## 1. 问题：P2 完成态离「当前层即活跃」还差三步

### 1.1 现场（scsk-admin 侧栏语义）

```text
.workflow/ralph/
  .migrated-RALPH-enter-form-…-20260825/   ← 迁移残骸堆在根（§3.12 步 7 的设计内产物）
  .migrated-RALPH-…/
  archive/                                  ← 1.0 只读快照（设计：不迁不删）
  business-map.json
  tasks/
    task-enter-form-api-fields/             ← 活跃
    task-enter-form-fixed-preset/           ← 已 COMPLETED 又被纠正、又 COMPLETED
    task-…/
```

用户想要的是本仓 `docs/exec-plans/` 的形态：`index.md` 写明活跃任务；当前层只放正在执行的；已归档 / 已迁移各进专用文件夹。

### 1.2 三个结构性缺口

| # | 现象 | 根因 | 代码位置 |
| --- | --- | --- | --- |
| 1 | 根上散落 `.migrated-RALPH-*` | 设计 §3.12 步 7 选了「原目录改点前缀名保留一轮，人手动删」，但**没有给删除命令**，也没有把残骸收进子目录；侧栏不隐藏点前缀目录 | `src/ralph/migrate.mjs:204-206`（`'.migrated-' + legacyId` + `renameSync`）；`state.mjs:630`（`listRuns` 跳过 `.migrated-`） |
| 2 | `tasks/` 里活跃与已完成混住，没有活跃表 | P1c「归档 = 原地翻转」让 COMPLETED 任务留在 `tasks/`；`jj ralph status` 能列，但磁盘上分不出来；仓内没有 `index.md` 这类导航文件 | `src/ralph/archive.mjs:86-153`（`archiveRun` 原地置 COMPLETED，`last_archive_path` 指回 live 目录）；`namingConfig.mjs:44-45`（`active_run` 与 `completed_run` 同一模板） |
| 3 | progress 是机器流水账，二次纠正改写历史 | (a) 约 20 处 CLI 调用 `appendProgressLine` 把 gate / deliver-attempt / archive / hot_memory / setRunStatus / scope / promoted 行写进 **同一个** `progress.md`，`review-record` 还直接 `appendFileSync`；(b) init 骨架只写头两行提示 + 机器行，**不生成 `## 轮次 1` 标题**，agent 无处「追加一轮」；(c) `resume` 只追一行 `setRunStatus COMPLETED→IN_PROGRESS`，不开新轮；(d) skill 没有 `progress` 子命令，agent 只能 Read+Edit 整文件——Read+Edit 是「改写历史」的直接温床（CCteam 明令禁止，见 §2.3） | `state.mjs:772-778`（`appendProgressLine`）；`knowledge.mjs:285-299`（init 骨架）、`:839-851`（review-record 直写）、`:859-867`（`resumeRun`）；`gates.mjs:1115,1225`（gate / rollback 行） |

设计 §3.4 其实已经写了「日期分节、轮次索引、⟲ 回滚三行组、`user_correction` 槽位」的 progress 模板，但**没有任何机械支撑**——这正是该设计 §1.4 自己警告过的「软约定进 ralph 就会漂移」。

## 2. 参考模型事实（本次核对）

### 2.1 本仓 `docs/exec-plans/`（对齐目标）

- 布局 `index.md` + `active/` + `completed/`；`index.md` 有「状态约定」表：`active/` 只放 `active` / `blocked`，`completed/` 只放 `completed`，并写「必须记录下一步和阻塞原因」。
- 状态由 `harness-manifest.json` 的 `exec_plans` 策略（`status_prefix` / `active_statuses` / `completed_status`）在 `scripts/check-harness.mjs:520-547` **机械校验**：文件放错目录会报 finding。这一点是 ralph 侧要复制的核心——目录即状态，且有校验。
- 关闭一份计划 = `git mv active/x.md completed/x.md` + 改状态行 + 索引换表；被 supersede 的计划同样进 `completed/`（`2026-07-31-dispatch-ralph-rollback.md`「R3-3 由无终态冻结 supersede」）。**推论**：`completed/` 表示「循环已关闭」而非「全部成功」，这给 ABANDONED 的去向提供了先例。

### 2.2 planning-with-files（`OthmanAdi/planning-with-files`，master，SKILL v3.16.0）

- 三文件 `task_plan.md` / `findings.md` / `progress.md`；核心口径「Context Window = RAM，Filesystem = Disk」。
- **多任务隔离**：`.planning/YYYY-MM-DD-<slug>/`，`.planning/.active_plan` 指针文件；`resolve-plan-dir.sh` 解析顺序 `$PLAN_ID` → `.active_plan` → 最新 mtime 目录 → 根目录 legacy。
- **进度追加口径**：`## Session: [DATE]` 分节，`### Phase N` 记 Status / Started / Actions / Files；「Continue After Completion：加新 Phase，**在 progress.md 记一条新的 session entry**」——即完成后再改需求 = 追加新节，不是改旧节。PostToolUse 钩子提示「Update progress.md with what you just did」；PreCompact 钩子要求压缩前先把上下文里的进度刷进 progress.md。
- **机器与人分轨（v3）**：机器账本是 `.planning/<id>/ledger-<agent>.jsonl`（append-only JSONL，事件枚举 `progress / phase_complete / error / gate_block / attest / note`），「Workers append to their own ledger; the orchestrator owns progress.md and task_plan.md」；注入上下文时用 `ledger-summary.sh` 合成摘要**替代**原先的 `tail -20 progress.md`，理由是 progress.md 里的自由文本不受 attestation 保护。这是本草案「events.log 与 progress.md 分轨」的直接依据。
- 恢复 = 读三文件 + `git diff --stat`；5-Question Reboot（Where am I / going / goal / learned / done）。

### 2.3 CCteam-creator（`jessepwj/CCteam-creator`，master）

- `.plans/<project>/`：`task_plan.md`（导航图）、`findings.md`（**纯索引**）、`progress.md`、`decisions.md`、`docs/`、`archive/`（「Archived history (not deleted, but not read daily)」）、`<agent>/<prefix>-<task>/` 三文件任务夹。
- **进度写法**（`references/onboarding.md`）：progress / findings 是 append-only；「Use Bash to append，**do not Read then Edit**」（`echo … >> progress.md`）；读取只看最后 30 行（`Read offset=<end> limit=30`）；过长则归档到 `archive/progress-<period>.md` 并在文件头留链接；每次失败立即追加「Tried: X → Result: Y → Next approach: Z」；上下文过长先写「Completed: X, Y. Next step: Z. Blocked on: W」再上报；「progress.md is *where I left off*, not *what the code looks like now*」。
- 恢复顺序：`docs/index.md` → docs → 自己的 task_plan → 任务夹三文件；泛恢复读根 findings（索引）+ 根 progress 最后 30 行。
- 主 progress 模板：`## <date> Session N — <title>` → `### Completed / ### To Do / ### Key Decisions`。

### 2.4 取什么、不取什么

| 取 | 不取 |
| --- | --- |
| exec-plans 的「目录即状态 + index + 机械校验」 | `.planning/.active_plan` 单指针（ralph 可同时多活跃，`index.md` 表即指针） |
| pwf v3 的机器账本与人读 progress 分轨；「完成后再改 = 新 session entry」 | JSONL 账本格式——现有解析器是行正则，先保留文本行格式，只换文件 |
| CCteam 的 append via shell、最后 30 行、失败三段式、溢出先写文件 | 角色层 `<agent>/`、根 findings 索引层（已由 `~/.jj-flow/memory` 热层承担，设计 §3.6） |
| CCteam `archive/` 「不删但不日常读」的定位 → `migrated/` / `completed/` | progress 过长归档拆文件（与 `parseProgressEvents` 的单文件假设冲突；本方案用分轨把机器行移走，人读轨长度自然可控） |

## 3. A · 目录结构预览

### 3.1 推荐方案 B：`tasks/` ≡ `active/`，加 `index.md` / `completed/` / `migrated/`

```text
.workflow/ralph/
  index.md                          # 活跃表 + 已完成表 + 残骸计数 + 指针（CLI 生成，勿手改）
  business-map.json                 # L1 能力地图（不变）
  tasks/                            # ≡ exec-plans active/：只放未关闭任务
    task-enter-form-api-fields/     #   IN_PROGRESS / READY_FOR_USER_TEST / BLOCKED / PAUSED
      task_plan.md
      progress.md                   #   人读轨：按轮次追加
      findings.md
      .state/
        run.json                    #   唯一机器 SSOT（schema 1.2 不动）
        events.log                  #   机器轨：gate / deliver-attempt / review / archive …（新）
        reviews/REV-*.json
        handoff.json
  completed/                        # ≡ exec-plans completed/：finalize / abandon 后 rename 进来
    task-enter-form-fixed-preset/   #   目录内容与 tasks/ 完全同形；resume 时 rename 回 tasks/
      task_plan.md  progress.md  findings.md  .state/
  migrated/                         # 迁移残骸只读收容；`jj ralph migrate --prune --yes` 人工删
    RALPH-enter-form-…-20260825/
    RALPH-…/
  archive/                          # 1.0 只读快照（旧 8 文件副本），不迁不删（jj-review「新旧各定位一个」依赖）
```

**不变量**（`jj ralph status` / `jj ralph doctor` 校验，违反标 `misplaced` 而不是静默）：

1. `tasks/<task-*>/` 下的 `run.status ∈ {IN_PROGRESS, READY_FOR_USER_TEST, BLOCKED, PAUSED}`。
2. `completed/<task-*>/` 下的 `run.status ∈ {COMPLETED, ABANDONED}`。
3. 同一 `task_key` 不得同时出现在 `tasks/` 与 `completed/`。
4. 根目录只允许 `index.md`、`business-map.json`、`tasks/`、`completed/`、`migrated/`、`archive/`；其余目录 = 待迁移（`RALPH-*` → `needs_migrate`）或未知（报 finding）。
5. `index.md` 是派生视图，每次状态迁移后由 CLI 重写；checkpoint 仍只认 `run.json` / Git / review artifact（AGENTS.md 红线不变）。

与 exec-plans 的逐项对应：

| exec-plans | ralph（方案 B） | 说明 |
| --- | --- | --- |
| `index.md` | `index.md` | exec-plans 手写；ralph 由 CLI 从各 `.state/run.json` 派生 |
| `active/`（`active` / `blocked`） | `tasks/`（IN_PROGRESS / READY_FOR_USER_TEST / BLOCKED / PAUSED） | 「阻塞仍留活跃层」两边一致 |
| `completed/`（含被 supersede 的） | `completed/`（COMPLETED / ABANDONED） | 「循环关闭」而非「成功」，两边一致 |
| — | `migrated/`、`archive/` | ralph 特有：迁移残骸与 1.0 快照，均只读、不入活跃表 |

### 3.2 备选方案 A：扁平化（活跃任务直接放根）

```text
.workflow/ralph/
  index.md
  business-map.json
  task-enter-form-api-fields/       # 活跃直接在根
  completed/
  migrated/
  archive/
```

可行——`task-` 前缀是硬正则（`^task-[a-z0-9][a-z0-9-]{1,80}$`），与保留名不会撞。但成本与副作用见下表。

### 3.3 决策表

| 维度 | 方案 B（保留 `tasks/`） | 方案 A（扁平） |
| --- | --- | --- |
| 与 exec-plans 的对应 | **逐项对应**（exec-plans 自己的活跃层也是子目录 `active/`） | 比 exec-plans 更扁；`index.md` 与任务目录同层 |
| 打开 `.workflow/ralph/` 看到什么 | 5–6 个固定条目，任务再点一层 | 任务直接可见，但与 `archive/` `business-map.json` `completed/` `index.md` `migrated/` 按字母**交错排序**，视觉上仍是混装 |
| 路径常量改动 | **0**（`RALPHS_DIR_REL` 等不变） | `state.mjs` 7 处、`migrate/map/knowledge/gates/archive` 17 处、`namingConfig` 3 处、`cli.mjs` 2 处 + skill lib 逐字节副本同步 |
| 测试 | 新增用例 | `tests/jj-ralph-contract.test.mjs` 56 处 `tasks/` 断言、`memory-hot-layer.test.mjs` 10 处全部改 |
| 下游 skill 文案 | jj-review 定位 glob 加 `completed/`（`SKILL.md:41`、`report-layout.md:6-15`）；jj-same 不变（只读活跃 run） | jj-same 5 处 + jj-review 3 处 + jj-ralph SKILL / artifact-layout / integrations / business-map 文案全改 |
| 存量数据 | `tasks/` 内目录不动；只搬 COMPLETED 与 `.migrated-*` | 每个 `tasks/<id>` 上提一层 + 重写 `last_archive_path` / `handoff.path` 字符串 |
| `listRuns` 根扫描语义 | 根目录任何 `RALPH-*` = `needs_migrate`，任何 `task-*` = 放错位置 | 根目录 `task-*` 是正常活跃，`RALPH-*` 是遗留；两种前缀两套语义并存 |
| 二次硬切风险 | 无（P2 身份与路径均保持） | P2 两天前刚落地（`b70f15c`），再切一次要重跑 P2a/P2b 的全部下游核查 |

**推荐 B**。A 的唯一收益是少点一层，代价是一次与 P2 同量级的硬切，而且在侧栏里并不比 B 更整洁。若父代理仍倾向 A，§5 的 Phase 1 清单可以直接换成 A 的路径常量改动，其余（index / completed / migrated / 双轨）不变。

### 3.4 三个必答问题

#### Q1 活跃任务是否仍要 `tasks/` 前缀目录？与 `active/` 如何对应？

要。`tasks/` 就是 `active/`，靠 §3.1 不变量 1–3 保证「当前层即活跃」：**目录里只有未关闭任务**，`index.md` 的「活跃任务」表与 `ls tasks/` 一一对应。不改名成 `active/`：改名的成本与方案 A 相同（同一批路径常量），而收益只是一个词；`namingConfig.task_dir_pattern: tasks/{task_key}` 与 `.plans` 参考模型的 `task-<name>` 语义也都已经用 `task` 这个词。

#### Q2 `archive/` 原地 COMPLETED vs 搬进 `completed/`

| | 原地翻转（现状 P1c） | 搬进 `completed/`（本草案） |
| --- | --- | --- |
| 零拷贝 | 是 | 是（`fs.renameSync`，同一文件系统原子） |
| 身份 | `run_id` ≡ 目录名 | 不变——身份是目录**名**，父路径不参与 `run_id` / `task_key` / CAP-HOF-SNAP 派生 |
| 可 resume | 同目录续写 | 同目录名续写：`resume` 先 rename 回 `tasks/` 再置 IN_PROGRESS |
| 「当前层即活跃」 | **不满足**（COMPLETED 留在 `tasks/`） | 满足 |
| 路径解析 | `runDir(id) = tasks/<id>` 字面拼接 | `resolveRunDir(id)`：`tasks/<id>` 存在 → 用它；否则 `completed/<id>`；都不在 → `run not found`。**按存在性解析**，所以 `run.json` 里的路径字符串只是提示，不是事实 |
| `last_archive_path` | `.workflow/ralph/tasks/<id>` | `.workflow/ralph/completed/<id>`（schema 该键是自由字符串，`schemas/ralph-run.schema.json:829-832`，**不升 schema**） |
| `archive_history[]` | 时间 + HEAD + 清单哈希 | 不变 |
| `handoff.path` / `artifact_refs.handoff_ref` | `tasks/<id>/.state` | 搬动时同步重写为 `completed/<id>/.state`（resume 时改回）；jj-same 读活跃 run 为主，不受影响 |
| 崩溃中间态 | — | 先 rename 再写 `run.json`：若中断，目录已在 `completed/` 而字符串仍旧 → 解析按存在性仍可 load，`jj ralph doctor` 修字符串；反向亦然 |
| 撞名 | — | `tasks/<id>` 与 `completed/<id>` 同时存在 → `resume` / `finalize` 拒绝并提示 `adopt`；`listRuns` 标 `misplaced` |

**resume 路径的变化**：`jj ralph resume --run-id task-x` → 解析到 `completed/task-x` → rename 到 `tasks/task-x` → `setRunStatus → IN_PROGRESS` → 在 `progress.md` 追加 `## 轮次 N · 日期 · <reason>`（§4.2）→ 在 `events.log` 记 `resume moved completed/→tasks/ round=N` → 重写 `index.md`。用户侧命令不变，只多了目录位置变化和一行新轮次标题。

ABANDONED 同样搬进 `completed/`（先例见 §2.1 末条：exec-plans 的 `completed/` 也收被 supersede 的计划）；PAUSED / BLOCKED 留在 `tasks/`（对应 exec-plans 的 `blocked` 留 `active/`）。

命名取 `completed/` 而非 `archived/`：(1) 对齐 exec-plans；(2) `namingConfig.ralph.completed_dirname` 已是 `'completed'`（`src/namingConfig.mjs:41`），`listRuns` 已把 `completed` 当保留名跳过（`state.mjs:631`）；(3) 业务仓里 1.0 `archive/` 还会长期存在，`archive/` 与 `archived/` 并排是可预见的混淆源。

#### Q3 `.migrated-RALPH-*` 清到哪、保留多久、谁删

- **去向**：`.workflow/ralph/migrated/RALPH-<原名>/`。去掉 `.migrated-` 点前缀——收进专用目录后前缀不再承担「让读端不识别」的职责（读端按目录名 `migrated` 整体跳过）。`jj ralph migrate` 重跑幂等：根上已有的 `.migrated-RALPH-*` 全部 rename 进 `migrated/`（只改名不拷贝）。
- **保留多久**：设计 §3.12「保留一轮」落成可判定口径——**新目录已被 `jj ralph status` 正常列出，且在新目录上至少成功跑过一次 `gate` 或 `finalize`**。`jj ralph migrate --prune` 只列出满足该口径的残骸（对应新任务存在且 `run.json` 可校验），加 `--yes` 才删。
- **谁删**：人，或 agent 在用户明确同意后执行（删除数据属 SKILL.md 第 8 条 🔴 不可逆 CHECKPOINT）。**永不自动删**。`index.md` 的「迁移残骸」节显示数量与 `--prune` 提示，让残骸不会被忘掉，也不会被误删。
- **不动的**：1.0 `archive/YYYY-MM-DD-<slug>/` 快照。理由与设计 §3.5 / §5 一致（jj-review P2 验收「新旧各定位一个 run」、`skills/jj-evaluated` 冻结证据路径）。若用户想清理，另开 `--prune-archive`，不在本草案内。

### 3.5 与现设计文本的冲突登记（采纳后修订 `ralph-plans-workspace.md`）

| 现设计段落 | 现口径 | 本草案口径 |
| --- | --- | --- |
| §3.2 目标目录布局 | `tasks/<task_key>/` + `business-map.json` + `archive/` | 增 `index.md` / `completed/` / `migrated/`；`tasks/` 定义为「只放未关闭任务」 |
| §3.4 progress 模板 | 机器行与人读行同文件，`fp=` / `unchanged=` 排除 | 机器行整体移到 `.state/events.log`；progress.md 只留人读轨；`### 本轮目标 / 本轮结果` 成为必备小节 |
| §3.5 归档语义反转 | 「原地翻转，不复制任何文件」 | 「翻转 + rename 到 `completed/`，仍不复制」 |
| §3.10 表 B10 | `parseProgressEvents` 读 progress.md | 改读 `events.log`（并集回退 progress.md 以兼容存量） |
| §3.12 步 7 | 原目录改名 `.migrated-RALPH-<原名>/`，人手动删 | rename 进 `migrated/RALPH-<原名>/`；`migrate --prune --yes` |
| §5「旧数据迁移与兼容策略」 | `.migrated-` 保留一轮 | 保留口径量化为「新目录可列出 + 一次 gate/finalize 成功」 |
| [ralph-auto-closeout.md](ralph-auto-closeout.html) §4.6（同期 Proposed） | 彼案把 index 刷新下沉到 `saveRun` 咽喉点：每次状态变更自动重写，含 gate / scope / rollback-phase | 本草案 §4.1 的 index 行是「init / finalize / abandon / resume / migrate 显式重写 + `status --write-index` 重生成」——修了 init 缺口，但 gate / scope / rollback 变更仍不刷新。若彼案先落地，本行收敛为冗余（显式重写点幂等无害），`--write-index` 降级为修复工具；实施顺序见彼案 §4.9.0（jj-review Locate → 彼案 §4.6 → 本草案 Phase 1/2） |

## 4. B · 具体文件写入规范

### 4.1 谁写什么

| 文件 | 写入者 | 时机 | 规则 |
| --- | --- | --- | --- |
| `index.md` | **CLI 机械**（`init` / `finalize` / `abandon` / `resume` / `migrate` / `status --write-index` 后重写） | 每次状态迁移 | 派生视图，文件头声明「勿手改」；内容全部来自 `.state/run.json` + 各 `progress.md` 最后一个 `## 轮次` 标题；过期可用 `jj ralph status --write-index` 重生成 |
| `task_plan.md` | agent（人读契约） | ANALYZE / PLAN / 需求变化时 | 不变：`## 目标 / 分析 / 计划 / 验收` + `### 当前 / 已落地 / 已取代` 分层累积（`artifact-layout.md` 现契约）。二次纠正 = 旧 `### 当前` 整块先移入 已落地/已取代，再写新 当前；REQ / TASK 编号跨轮顺延 |
| `progress.md` | **agent（人读轨）**，经 `jj ralph progress` 子命令或 shell 追加 | 每次迭代 / 回滚 / 轮次开关 | **只追加、时间正序、按轮次分节**；禁止出现机器行语法；`init` 写 `## 轮次 1` 标题，`resume` 写 `## 轮次 N` 标题；轮次索引块由 CLI 在标记之间维护 |
| `.state/events.log` | **CLI 机械**（`appendProgressLine` 改向） | 每个 gate / deliver-attempt / review / archive / setRunStatus / scope / promoted / hot_memory / finding 事件 | 行格式与今日 progress 机器行**完全一致**（`- <ISO> <event> k=v …`），只换落点；只追加；人不读 |
| `findings.md` | agent | DELIVER 当场（回滚 / 评审 / 用户纠正之后） | 不变：`F-00N` 五要素 + `## 可复用结论` 回指；**不得**变成 progress 副本（改动摘要只写文件 × 轮次 × 变更一行，不写过程） |
| `.state/run.json` | CLI | 每个状态迁移 | schema 仍 1.2。`last_archive_path` 值改指 `completed/<id>`；`handoff.path` / `handoff_ref` 随目录位置重写；**不新增键** |

### 4.2 progress 双轨隔离

#### 机器轨 `.state/events.log`

- 落点：`runStateDir(id)/events.log`，固定文件名，不进 `artifact_refs`（`artifact_refs` 是 `additionalProperties:false`，加键要动 schema；固定路径与 `reviews/` `handoff.json` 同类处理）。
- 内容：今天写进 progress.md 的全部机器行原样迁过来——`init` 参数块、`gate <k>=<S> phase= status=`、`deliver-attempt improved= iteration= signal=`、`review REV-n <outcome> …`、`rollbackPhase A→B`、`setRunStatus A→B reason=`、`scope in+= out+=`、`promoted lite→full`、`archive path= status= files= history=`、`hot_memory …`、`finding F-00N`、`knowledge-contribute …`、`instruction-correction …`、`gate-issue …`。
- 消费者只换文件：`parseProgressEvents` / `computeRunMetrics`（`gates.mjs:1252-1308`）读 `events.log`，**并集**回退 `progress.md`（存量 run 的机器行还在那里）；`looksLikeFixRun`（`:441-448`）与 `analyzeRework`（`:1283`）grep 的 `failed_must` / `user_correction` / `over_claimed` / `已取代` 是**人写**的信号，继续只读 `progress.md`；`parseProgressDraft`（finding 预填）同理读 `progress.md`。
- `commitPrep` 把 `.state/events.log` 加进待提交清单；`hashRunTree` 本就整目录哈希，`archive_history` 自动覆盖。
- 为什么不是 JSONL：现有三个正则解析器按「行首 ISO 时间戳 + 关键词」工作，文本行零改动最稳；JSONL 可作 Phase 2 之后的可选升级（pwf v3 的 `ledger-summary` 思路）。

#### 人读轨 `progress.md`：结构

```md
# <task_key> - 进度

> 用于上下文恢复：压缩/重启后先读本文件**最后 30 行**，再读 task_plan.md `### 当前`。
> 人读轨，**只追加、时间正序**。机器事件在 `.state/events.log`，不要抄进来。

<!-- rounds:begin（CLI 维护，勿手改）-->
| 轮次 | 日期 | 主题 | 结果 | 认知 |
| --- | --- | --- | --- | --- |
<!-- rounds:end -->

## 轮次 N · YYYY-MM-DD · <主题>（init | resume：<reason>）

### 本轮目标
- 一句话 + 对应 REQ / TASK 编号；若是纠正轮，先写 user_correction: <原话或要点>

### 迭代 n
- 实现：<要点，不贴 diff>
- 验证：<命令 → PASS/FAIL 与数字>
- 下一步：<单个下一动作>

### ⟲ 回滚 n — 触发源：自查 | 评审 REV-n | 用户纠正
- failed_must: <REQ-n 描述>
- failed_evidence_class: <diff-only | behavior-local | write-then-read | cross-path | runtime-env>
- over_claimed: <以为测到了、实际没测到的是什么>
- → findings.md **F-00N**

### 本轮结果
- 状态：<COMPLETED | READY_FOR_USER_TEST | BLOCKED …>；证据指针：events.log 的 archive 时间戳 / archive_history[i]
- 认知：F-00N 已写 / 无
- 下一步或待用户：<一句话>
```

**规则**（skill 文案 + Phase 2 机械化）：

1. **只追加**。追加走 `jj ralph progress …` 或 shell `cat >> progress.md <<'EOF'`；**禁止 Read 全文后 Edit**（CCteam 口径）。已有 `### 本轮结果` 的轮次正文一律冻结；要订正，在当前轮追加「更正：…」条目，因果进 findings。
2. **一次需求变化 = 一个新轮次**。`resume` 自动写 `## 轮次 N` 标题（N = 已有轮次数 + 1），agent 从 `### 本轮目标` 往下写；不得把第二轮内容插进第一轮的小节。
3. **每轮必须有 `### 本轮目标` 与 `### 本轮结果`**。`finalize` / `close` 做软检查：当前轮缺 `### 本轮结果` → 打印提示，不阻断（与 finding 软提示同一策略：强制会诱发凑数）。
4. **机器行语法禁入人读轨**。`jj ralph progress` 拒绝匹配 `^- \d{4}-\d{2}-\d{2}T.*\b(gate|deliver-attempt|archive|setRunStatus|rollbackPhase|hot_memory|scope)\b` 的文本；`gate` 命令对 progress.md 新增行做同一正则的软检查并提示「机器事件请看 events.log」。
5. **三行组与 `user_correction:` 槽位保留原样**——它们是 `looksLikeFixRun` / `analyzeRework` / finding 预填的输入，位置固定在 `### ⟲ 回滚` 与 `### 本轮目标` 下。
6. **恢复读法**：`tail -30 progress.md`（或 `Read offset=-30`）+ `task_plan.md` `### 当前`；不要整读 progress；要看机器事件 `rg '^- 20' .state/events.log | tail -20`。过渡期（Phase 2 前）存量文件用 `rg -v '^- \d{4}-\d{2}-\d{2}T' progress.md | tail -30` 过滤机器行。
7. **轮次索引块**是 CLI 在 `<!-- rounds:begin/end -->` 之间重写的唯一区域；这是文件里唯一允许「改写」的地方，且只有机器改。

#### 反例：当前样本的模式（示意，基于父代理转述）

```md
- 2026-08-25T09:35:10Z gate deliver=PASS phase=ACCEPT status=IN_PROGRESS
- 实现：预设字段渲染，key 取 field.mapping        ← 第二轮的纠正被就地改进第一轮的「实现」行
- 2026-08-25T09:40:57Z gate accept=PASS …
- 2026-08-25T09:41:12Z archive in-place path=… status=COMPLETED (resumable) files=5 history=0
- 2026-08-26T01:12:40Z setRunStatus COMPLETED→IN_PROGRESS reason=用户纠正
- 2026-08-26T02:16:03Z archive in-place … history=1
```

问题：没有轮次边界；「id → mapping」的纠正没有作为事件留下（既无 `user_correction:` 也无 ⟲ 三行组），而是改写了第一轮的描述——读者无法知道第一轮曾经用过 `id`；最后 30 行全是机器行，恢复时得不到「下一步是什么」。

#### 改写后的样本片段（同一场景：轮次 1 COMPLETED → 用户纠正 id=mapping → 轮次 2 DELIVER / ACCEPT / COMPLETED）

`progress.md`（人读轨）：

```md
# task-enter-form-fixed-preset - 进度

> 用于上下文恢复：压缩/重启后先读本文件最后 30 行，再读 task_plan.md `### 当前`。
> 人读轨，只追加、时间正序。机器事件在 `.state/events.log`，不要抄进来。

<!-- rounds:begin（CLI 维护，勿手改）-->
| 轮次 | 日期 | 主题 | 结果 | 认知 |
| --- | --- | --- | --- | --- |
| 2 | 2026-08-26 | 用户纠正：字段 key 改用 mapping | COMPLETED（archive_history[1]） | F-002 |
| 1 | 2026-08-25 | 入驻表单固定预设 | COMPLETED（archive_history[0]） | F-001 |
<!-- rounds:end -->

## 轮次 1 · 2026-08-25 · 入驻表单固定预设（init）

### 本轮目标
- REQ-001~003：入驻表单支持后台配置的固定预设字段集，前端不写死；切换预设清空已填值；TASK-1~4

### 迭代 1
- 实现：新增 usePresetFields，按后台 preset.fields[] 渲染；字段 key 取 field.id
- 验证：pnpm test enter-form → 6/6 PASS；pnpm build PASS
- 下一步：REQ-003 切换预设时清空已填值（保留 countryCode）

### 迭代 2
- 实现：切换预设调用 resetFields()，countryCode 例外
- 验证：pnpm test enter-form → 8/8 PASS
- 下一步：进 ACCEPT，验收表三项填证据

### 本轮结果
- 状态：COMPLETED（accept=PASS → finalize；events.log 2026-08-25T09:41 archive；archive_history[0]）
- 认知：F-001（预设切换要显式保留跨预设字段）
- 待用户：UAT 在预设 A / B 各提交一单

## 轮次 2 · 2026-08-26 · 用户纠正：字段 key 改用 mapping（resume：用户纠正 id→mapping）

### 本轮目标
- user_correction: 「字段 id 不对——后台预设里的 id 是自增主键，提交和回填要用 mapping 对应的业务字段名」
- 新增 REQ-004：提交 payload 与回填按 field.mapping 取 key；原 REQ-001 落地项「key 取 field.id」标 已取代；TASK-5~6

### ⟲ 回滚 1 — 触发源：用户纠正
- failed_must: REQ-001 字段 key 取 field.id（后台按 mapping 匹配，落库字段为空）
- failed_evidence_class: write-then-read
- over_claimed: 只断言渲染出 8 个字段与本地 state 回填，没有走一次真实「提交 → 读回」
- → findings.md **F-002**

### 迭代 1
- 实现：usePresetFields 的 key 改 field.mapping，id 只作列表 key；提交 payload 按 mapping 组装；回填按 mapping 反查
- 验证：pnpm test enter-form → 10/10 PASS（新增 2 例：payload key = mapping；mock 提交后读回一致）
- 下一步：ACCEPT 表 REQ-004 填 write_then_read 证据

### 本轮结果
- 状态：COMPLETED（accept=PASS → finalize；archive_history[1]）
- 认知：F-002 已写；可复用结论已进热层
- 待用户：真实环境提交一单，核对后台落库字段名
```

`.state/events.log`（机器轨，行格式与今日 progress 机器行一致；节选）：

```text
- 2026-08-25T08:02:11.120Z init task-enter-form-fixed-preset intensity=standard gate_set=full max_iterations=12
- 2026-08-25T08:40:03.554Z gate analyze=PASS phase=PLAN status=IN_PROGRESS
- 2026-08-25T08:52:19.008Z gate plan=PASS phase=DELIVER status=IN_PROGRESS
- 2026-08-25T09:20:44.201Z deliver-attempt improved=true iteration=1 signal=behavior-local:enter_form_tests_6_pass
- 2026-08-25T09:33:02.917Z deliver-attempt improved=true iteration=2 signal=behavior-local:enter_form_tests_8_pass
- 2026-08-25T09:35:10.330Z gate deliver=PASS phase=ACCEPT status=IN_PROGRESS
- 2026-08-25T09:40:57.002Z gate accept=PASS phase=ARCHIVE status=IN_PROGRESS
- 2026-08-25T09:41:12.446Z archive path=.workflow/ralph/completed/task-enter-form-fixed-preset status=COMPLETED files=6 history=0
- 2026-08-25T09:41:12.900Z hot_memory promote status=ok added=1 skipped=0
- 2026-08-26T01:12:40.771Z setRunStatus COMPLETED→IN_PROGRESS reason=用户纠正：字段 key 改用 mapping
- 2026-08-26T01:12:40.771Z resume moved completed/→tasks/ round=2
- 2026-08-26T01:13:05.118Z rollbackPhase ARCHIVE→ACCEPT reason=REQ-001 证据失效
- 2026-08-26T01:13:09.440Z rollbackPhase ACCEPT→DELIVER reason=改 key 为 mapping
- 2026-08-26T02:04:33.615Z deliver-attempt improved=true iteration=3 signal=write-then-read:mock_submit_readback_mapping
- 2026-08-26T02:05:01.007Z finding F-002
- 2026-08-26T02:06:12.220Z gate deliver=PASS phase=ACCEPT status=IN_PROGRESS
- 2026-08-26T02:15:48.091Z gate accept=PASS phase=ARCHIVE status=IN_PROGRESS
- 2026-08-26T02:16:03.512Z archive path=.workflow/ralph/completed/task-enter-form-fixed-preset status=COMPLETED files=6 history=1
```

`findings.md` 对应新增的一条（不复述 progress，只写坑与因果）：

```md
### F-002 后台预设字段的 id 是主键不是业务键，提交 / 回填要用 mapping
- 现象: 按 field.id 组装 payload，后台按 mapping 匹配不到，落库字段为空；本地测试全绿
- 原因: 只在前端 state 内闭环验证（渲染 + 回填），没走一次「提交 → 读回」；id 这个名字诱导把主键当业务键
- 对策: 后台配置驱动的表单，先确认「哪个字段是业务键」再定 key；验收必须含一次 write-then-read（mock 提交后按同一 mapping 读回）
- 适用范围: 一切「后台 schema / 预设 → 前端表单」类需求
- 代价: 1 次用户纠正 + 轮次 2 全程（ARCHIVE→DELIVER 两跳回滚）
- 证据: progress 轮次 2 回滚 1；events.log 2026-08-26T01:13 rollbackPhase
```

`## 可复用结论` 追加一行：「配置驱动表单先辨业务键再定 key，验收含一次提交→读回（→ F-002）」。

### 4.3 `index.md`（CLI 生成）

```md
# Ralph 工作区索引 · scsk-admin

> 由 `jj ralph` 自动生成（最近：2026-08-26T02:16Z），勿手改；事实源是各任务 `.state/run.json`。
> 恢复顺序：本文件 → 活跃任务 `progress.md` 最后 30 行 → `task_plan.md` `### 当前`。

## 活跃任务（tasks/）
| 任务 | 标题 | 阶段 / 状态 | 档 | 最近一轮 | 更新 |
| --- | --- | --- | --- | --- | --- |
| [task-enter-form-api-fields](tasks/task-enter-form-api-fields/progress.md) | 入驻表单 API 字段对齐 | DELIVER / IN_PROGRESS | full | 轮次 1 · 2026-08-26 · API 字段对齐 | 2026-08-26 |

## 已完成（completed/）
| 任务 | 标题 | 结果 | 轮次 | 最后归档 |
| --- | --- | --- | --- | --- |
| [task-enter-form-fixed-preset](completed/task-enter-form-fixed-preset/progress.md) | 入驻表单固定预设 | COMPLETED | 2 | 2026-08-26 |

## 迁移残骸（migrated/）
- 3 个旧 `RALPH-*` 目录，对应新任务均已可列出；确认后 `jj ralph migrate --prune --yes`。

## 指针
- 能力地图：`business-map.json`（CAP-*）
- 热层知识：`~/.jj-flow/memory/scsk-admin.md`
- 1.0 只读快照：`archive/`
```

「最近一轮」列从该任务 `progress.md` 最后一个 `^## 轮次` 标题正则取得，取不到留空——这是 index 唯一读 md 的地方，其余全部来自 `run.json`。

### 4.4 `task_plan.md` / `findings.md` / `run.json` 不变项

- `task_plan.md` 三段分层与解析器（`extractMarkdownSection` 层级感知、两跳寻址）不动；二次纠正时的「先移旧 当前 再写新 当前」规则已在 `artifact-layout.md` 写明，本草案只把它与「progress 新开轮次」绑成同一动作清单（§5.1 skill 文案）。
- `findings.md` 五要素与 `## 可复用结论` 不动；新增一条口径：「改动摘要」表每文件每轮一行，**不记过程**（过程在 progress）。
- `run.json` schema 1.2 不动；变化只有 `last_archive_path` / `handoff.path` / `handoff_ref` 的**取值**随目录位置改变。

## 5. C · 实现方案（分阶段）

### 5.1 Phase 0 · 纯约定止血（skill + 模板 + 文档，不改 `src/`）

能止住什么：改写历史、无轮次结构、叙事退化为机器复述、纠正不留信号。止不住什么：CLI 写进 progress.md 的机器行（要 Phase 2）。

- `skills/jj-ralph/references/artifact-layout.md`：新增「File shape (`progress.md`)」小节，落 §4.2 的结构与规则 1–7；「When the task / approach / MUST changes」清单第 6 条扩成「append a new `## 轮次 N` heading first, then the ⟲ block, then new iterations」。
- `skills/jj-ralph/SKILL.md`：Immediate actions 第 4 点与 Failure modes「User changes approach」行加「open a new round in progress.md; never edit prior rounds」；Scripts 段加 shell 追加示例；恢复口径「read last 30 lines」。
- `skills/jj-ralph/references/post-complete-continue.md`：`resume` 后第一步写 `## 轮次 N` 标题；`tiny-example.md` 补最小人读轨样例。
- `docs/skill-zh-bridge/jj-ralph/README.zh.md` 同步；`docs/commands/jj-ralph.md`「做完还要改」段加一句。
- 过渡期读法：`rg -v '^- \d{4}-\d{2}-\d{2}T' progress.md | tail -30`。
- 可选：`evals/regression/` 加一条确定性用例——给定「已 COMPLETED + 用户纠正」的 fixture，期望产物含新 `## 轮次 2` 且轮次 1 字节不变（`$jj-evaluated`）。
- 验证：`node --test tests/jj-ralph-contract.test.mjs`（P2+b 起有 skill 文案标记断言）、`npm run docs:check`、`git diff --check`；`node src/cli.mjs install-skill --platform all --force` 分发。

### 5.2 Phase 1 · 布局迁移（index + completed + migrated）

- `state.mjs`：`RALPH_COMPLETED_DIR_REL` / `RALPH_MIGRATED_DIR_REL` 常量；`resolveRunDir(id)`（tasks → completed）替换 `runDir` 内部实现，`runStateDir` / `runJsonPath` 跟随；`listRuns` 扫 `tasks/` + `completed/`，根上 `RALPH-*` 仍 `needs_migrate`，`tasks/` 中 COMPLETED/ABANDONED 或 `completed/` 中 IN_PROGRESS 标 `misplaced`，`migrated/` 整体忽略；`loadRun` 对 `completed/` 内 run 允许读写（不是 `_readonly_archive_path`）。
- `archive.mjs`：`archiveRun` 在置 COMPLETED 后 `renameSync(tasks/<id> → completed/<id>)`，重写 `last_archive_path` / `handoff.path` / `handoff_ref`；`abandonRun` 同样搬动。
- `knowledge.mjs`：`resumeRun` 先 rename 回 `tasks/`，再 `setRunStatus`，再追加 `## 轮次 N` 标题到 progress.md；`initRun` 骨架写 `## 轮次 1 · 日期 · <title>（init）` 与轮次索引标记块。
- 新模块 `src/ralph/index.mjs`（或并入 `state.mjs`）：`writeWorkspaceIndex(cwd)`，被 init / finalize / abandon / resume / migrate 末尾调用；`jj ralph status --write-index` 手动重生成。
- `migrate.mjs`：步 7 改 rename 进 `migrated/`；`migrateRuns` 开头把根上存量 `.migrated-*` 收容进 `migrated/`，把 `tasks/` 内 COMPLETED/ABANDONED 搬进 `completed/`（幂等「整理」语义）；新增 `--prune` / `--yes`。
- 下游：`skills/jj-review/SKILL.md:41` 与 `references/report-layout.md` 定位 glob 加 `completed/*/.state/run.json`；jj-same 不改（活跃 run）；`docs/commands/jj-ralph.md:152-155` 目录图、`concepts-paths.md`、`claude-commands/jj-ralph.md`、`artifact-layout.md` 顶部布局图。
- `skills/jj-ralph/scripts/lib/` 逐字节 sync（`npm run ralph:sync` / `ralph:check`）；sibling gym pin 需再更新一次（`lab:check`，与 P2 时同样另行处理）。
- 合约：见 §5.6。

### 5.3 Phase 2 · CLI / 合约（双轨 + progress 子命令）

- `appendProgressLine` 改写到 `.state/events.log`（含 `review-record` 那处直写与 init 参数块）；`readRunEventsText(run)` = `events.log` ∪ `progress.md`（存量兼容）；`parseProgressEvents` / `computeRunMetrics` 改用它；`looksLikeFixRun` / `analyzeRework` / `parseProgressDraft` 维持读 progress.md。
- `commitPrep` 追加 `.state/events.log`。
- `jj ralph progress --run-id X [--goal … | --note … | --verify … | --next … | --correction … | --rollback --failed-must … --evidence-class … --over-claimed … --finding F-00N | --result …]`（`ralph_ops.mjs` 同名子命令）：追加到当前轮末尾；`--round-start "<主题>"` 手动开轮（`resume` 已自动开）；拒绝机器行语法；重写轮次索引块。
- `finalize` / `gate close` 软检查「当前轮有 `### 本轮结果`」；`gate` 软检查 progress.md 新增行无机器语法。
- `migrate` 对存量 progress.md 追加一行分隔注释 `<!-- 以上为双轨切分前的混合日志（只读）；以下按人读轨追加 -->`，不改旧内容（append-only 前提）。
- skill / 命令文档把 §5.1 的 shell 追加示例换成 `progress` 子命令；`artifact-layout.md` 顶部布局图加 `events.log`。
- 合约：见 §5.6；`tests/jj-dispatch-contract.test.mjs` 照跑（协议零改动，应全绿）。

### 5.4 兼容与迁移命令

| 场景 | 行为 |
| --- | --- |
| 旧机器行仍在 `progress.md` 的存量 run | 指标读取并集；`looksLikeFixRun` 不受影响；不重写旧文件 |
| `tasks/` 里已 COMPLETED 的存量任务 | `jj ralph migrate`（幂等整理）搬进 `completed/`；或下一次 `resume` / `finalize` 时按不变量归位 |
| 根上存量 `.migrated-RALPH-*` | `jj ralph migrate` rename 进 `migrated/`；`--prune --yes` 删 |
| 未迁移的活跃 `RALPH-*` | P2 硬切不变：load / gate / save 报错并提示 `jj ralph migrate` |
| 1.0 `archive/` 快照 | 只读定位（jj-review），不迁不删 |
| `naming.json` 自定义 `layout.archive` | 仅影响 1.0 命名助手；`completed/` 与 `migrated/` 走默认常量，P2 已锁死 `active_run` / `completed_run` 不可覆写，本草案把 `completed_run` 改指 `completed/{task_key}` |
| dispatch | 零改动：ralph → dispatch 仍是单向 `snapshot_path`（`.workflow/dispatch/recommendations/SNAP-*`，与 ralph 目录无关，`gates.mjs:152-165`） |

### 5.5 风险

| 风险 | 缓解 |
| --- | --- |
| P1c/P2 合约断言 `last_archive_path` 指向 `tasks/`（3 处）与 `.migrated-` 根路径（`:2193,:2201`） | Phase 1 同批改断言；断言语义改成「指向 `completed/`」「`migrated/` 下存在且 `listRuns` 不列」 |
| `resolveRunDir` 两级存在性解析引入「目录在 A、字符串说 B」 | 解析只信存在性；`jj ralph doctor` 报告并可 `--fix` 字符串；崩溃窗口只有 rename 与 saveRun 之间 |
| 编辑器 / 侧栏打开的文件在 finalize 时换路径 | 与 exec-plans `git mv` 体验一致；`index.md` 链接始终指向当前位置 |
| 同名撞车（`tasks/<id>` 与 `completed/<id>` 并存） | `finalize` / `resume` 拒绝并提示 `adopt`；`listRuns` 标 `misplaced`，永不静默 |
| 分轨后旧 skill 版本的 agent 仍手抄机器行进 progress | `gate` 软检查提示；`progress` 子命令拒绝；文案与 evals 用例 |
| `resume` 自动开轮与 agent 手动开轮重复 | `--round-start` 检测最后一个 `## 轮次` 标题下是否已有内容，无内容则复用不重开 |
| `index.md` 与磁盘状态漂移 | 派生视图、幂等重写；`status --write-index` 兜底；不进 checkpoint |
| sibling gym pin 再次落后布局（`lab:check`） | 与 P2 相同：另行更新 pin，不阻塞本计划 |
| 业务仓 `.workflow/ralph` 被 gitignore，`index.md` 单机 | 与现状一致（设计 §3.6 已承认），不在本草案解决 |

### 5.6 验收要点（合约测试）

Phase 1（`tests/jj-ralph-contract.test.mjs` 新增，`npm run verify` 全绿，`git diff --check` 干净）：

1. `init` → `tasks/<id>/` 存在，`progress.md` 含 `## 轮次 1` 与 `<!-- rounds:begin -->` 块，`index.md` 活跃表含该行。
2. `finalize` → `tasks/<id>` 不存在、`completed/<id>` 存在；`loadRun(id)` 成功；`last_archive_path` 以 `completed/` 开头；`archive_history` 语义与 P1c 用例一致；`index.md` 行迁到已完成表。
3. `resume` → 目录回到 `tasks/`；status IN_PROGRESS；`progress.md` 末尾新增 `## 轮次 2 · <日期> · <reason>`；轮次 1 正文字节不变（前缀断言）。
4. `abandon` → 进 `completed/` 且 status ABANDONED；`resume` 回 `tasks/`。
5. `migrate`：1.0 八文件 fixture → `tasks/task-<slug>` + `migrated/RALPH-<原名>`；重跑幂等收容根上 `.migrated-*`；`tasks/` 内 COMPLETED 被搬到 `completed/`；`--prune` 无 `--yes` 只列不删；`archive/` 字节不变。
6. `listRuns`：`migrated/` 永不出现；`completed/` 中 IN_PROGRESS 或 `tasks/` 中 COMPLETED 标 `misplaced`；根上 `RALPH-*` 仍 `needs_migrate`（B8 不回归）。
7. jj-review 定位 fixture：`tasks/` 一个、`completed/` 一个、leftover `archive/` 一个，三者各可定位。

Phase 2：

1. `gate` / `deliver-attempt` / `review-record` / `archive` / `setRunStatus` / `scope` / `promoted` 行落在 `.state/events.log`，`progress.md` 无新增机器行。
2. `computeRunMetrics` 对「旧行在 progress.md」「新行在 events.log」「两者混合」三种 fixture 给出相同指标。
3. `progress` 子命令：追加到最后一轮末尾；拒绝机器行语法；`--round-start` 重写索引块且其余内容字节不变。
4. `finalize` 缺 `### 本轮结果` 只提示不阻断（返回对象带 `hints`）。
5. `commitPrep` 清单含 `.state/events.log`。
6. `tests/jj-dispatch-contract.test.mjs` 全绿（未改协议）。

### 5.7 业务仓 scsk-admin 迁移步骤草稿

1. 备份：`.workflow/ralph` 通常被 gitignore，先 `cp -r .workflow/ralph /tmp/ralph-backup-$(date +%Y%m%d)`。
2. 升级 jj-flow 到含 Phase 1 的版本并分发 skill：`jj install-skill --platform all --force`。
3. `jj ralph status` 看现状：应无 `needs_migrate`（P2c 已迁），能看到 `tasks/` 下的 COMPLETED 任务。
4. `jj ralph migrate`（幂等整理）：根上 `.migrated-RALPH-*` → `migrated/`；`tasks/` 内 COMPLETED → `completed/`；生成 `index.md`。
5. 核对：`ls .workflow/ralph` 只有 `index.md business-map.json tasks/ completed/ migrated/ archive/`；打开 `index.md` 对照侧栏。
6. `task-enter-form-fixed-preset` 的旧 `progress.md` 不被改写；Phase 2 后新事件进 `events.log`，人读轨从分隔注释之后开始按轮次追加。若要补写这两轮的叙事，只允许**追加**一节「轮次 1–2 · 回顾（补记于 YYYY-MM-DD）」，不改旧行。
7. 在新布局上跑通一次 `gate` 或 `finalize` 后，`jj ralph migrate --prune --yes` 删除 `migrated/`（用户确认）。
8. 之后所有 run 按 §4.2 写 progress；恢复时读 `index.md` → 活跃任务 progress 最后 30 行。

### 5.8 明确不做

- 不升 schema 大版本（仍 `jj-flow/ralph-run/1.2`）：`events.log` 走固定路径不进 `artifact_refs`；`last_archive_path` 只是取值变化。
- 不动 dispatch 协议与 checkpoint 语义；`index.md` / `progress.md` / `events.log` 都不推进 gate。
- 不迁移、不删除 1.0 `archive/` 快照；不改 `skills/jj-evaluated` 冻结证据路径。
- 不把 `tasks/` 改名 `active/`；不做方案 A 扁平化（备选保留）。
- 不自动 `adopt --absorb`；不自动删 `migrated/`。
- 不写业务仓 AGENTS.md / CLAUDE.md；不 npm publish。
- 不把 progress 过长拆文件归档（分轨后人读轨增长可控；`parseProgressEvents` 的单文件假设保留在 events.log 上）。

## 6. D · 对当前样本的短评

> 基于父代理转述的场景与侧栏语义；原文件在本 VM 不可达，请用文末清单对照。

**布局**：`tasks/task-enter-form-fixed-preset/{task_plan,progress,findings}.md + .state/` 是 P2 正确形态；根上的 `.migrated-RALPH-*` 是 P2c §3.12 步 7 的**设计内产物**，`archive/` 是 1.0 只读留存，也合设计。所以样本布局「按 P2 是对的」，错的是 P2 的完成态本身没满足「当前层即活跃」——已完成任务与活跃任务同住 `tasks/`，残骸没有收容目录，也没有删除命令。这是本草案 §3 要补的。

**progress**：不合格，四点。(1) 单轨——门控机器行（`gate=PASS` / `deliver-attempt` / `archive in-place` / `hot_memory`）与人读行混写，最后 30 行读不出「做到哪、下一步」；(2) 二次纠正没有新开轮次，而是改写 / 交错第一轮正文——违反 append-only，也让读者失去「第一轮曾用 id」这条事实；(3) 缺「本轮目标 / 本轮结果 / 下一步」，恢复靶点不存在；(4) 用户纠正若未落 `user_correction:` 与 ⟲ 三行组，`looksLikeFixRun` 拿不到 fix-run 信号，测试完整性检查与 finding 预填一起失效。不过要公平地说：init 骨架不生成轮次标题、`resume` 不开新轮、又没有 `progress` 子命令——agent 在现有工具下几乎只能 Read+Edit，「改写」是工具形状导出的行为，不只是文案问题。

**findings**：合格标准是 `F-00N` 五要素齐（尤其「对策」「适用范围」）+ `## 可复用结论` 回指 F 编号；不合格的典型是把改动清单或 progress 事件抄一遍、缺对策与适用范围。id→mapping 这次纠正应当产出**一条** F（§4.2 的 F-002 形态），而不是一段过程叙述。

**怎么改才「对」**：目录按 §3.1 归位（该任务两轮都已 COMPLETED → `completed/`）；progress 从当前文件末尾起**只追加**：一节「轮次 1–2 · 回顾（补记）」写清两轮各自的目标 / 结果 / user_correction / ⟲ 三行组，旧行不动；findings 加 F-002 与一条可复用结论；后续 run 按 §4.2 结构写。

**父代理核对清单**（对照原三文件）：

- progress.md 是否有 `## 轮次` 级标题？第二轮内容是出现在文件末尾，还是插在第一轮小节内？
- 是否存在 `user_correction:` 行与 `failed_must / failed_evidence_class / over_claimed` 三行组？指向了 F 编号吗？
- 最后 30 行里有几行是 `- 2026-…T…Z gate|deliver-attempt|archive|hot_memory`？有没有「下一步 / 待用户」？
- findings.md 的 F 条目是否有「对策」与「适用范围」？「改动摘要」是否在复述 progress？`## 可复用结论` 是否回指 F 编号？
- task_plan.md 的 `### 已取代` 是否收了「key 取 field.id」原文？`### 当前` 是否只剩本轮项？

## 7. 开放问题（需父代理 / 用户拍板）

1. 方案 B（保留 `tasks/`）还是方案 A（扁平）？本草案推荐 B；选 A 则 §5.2 换成路径常量批改，其余不变。
2. ABANDONED 进 `completed/`（本草案）还是留 `tasks/` 等人决定？前者满足「当前层只有在做的」，后者更显眼。
3. `events.log` 文本行（本草案）还是 JSONL（pwf v3）？文本行零解析器改动；JSONL 更利于后续 `ledger-summary` 式注入。
4. `finalize` 对「缺 `### 本轮结果`」是否要从软提示升为阻断？本草案沿用 finding 软提示策略。
5. 是否顺带提供 `--prune-archive` 清理 1.0 `archive/`？本草案不做。

## 8. 参考

- 本仓：`docs/exec-plans/index.md`（状态约定）；`harness-manifest.json` `exec_plans` 策略与 `scripts/check-harness.mjs:520-547`；`src/ralph/state.mjs:40-46,205-207,614-641,772-778`；`src/ralph/archive.mjs:86-153`；`src/ralph/migrate.mjs:136-215`；`src/ralph/knowledge.mjs:285-299,839-867`；`src/ralph/gates.mjs:441-448,1252-1308`；`src/namingConfig.mjs:33-49`；`schemas/ralph-run.schema.json:829-832`；`skills/jj-ralph/references/artifact-layout.md`；`skills/jj-review/SKILL.md:41`、`references/report-layout.md:6-15`；`skills/jj-same/SKILL.md:14,72,82`。
- 外部：[CCteam-creator](https://github.com/jessepwj/CCteam-creator)（master：`README_CN.md`、`skills/CCteam-creator/SKILL.md` § Directory Structure、`references/onboarding.md` § progress.md Archival / Context Recovery Rules / Documentation Read-Write Tips、`references/templates.md` § Main progress.md）；[planning-with-files](https://github.com/OthmanAdi/planning-with-files)（master：`.agents/skills/planning-with-files/SKILL.md` v3.16.0 § Continue After Completion / Parallel task workflow / Ledger contract summary、`templates/progress.md`、`scripts/ledger-append.sh` 头注释、`scripts/resolve-plan-dir.sh`）。核对日期 2026-09-03。
