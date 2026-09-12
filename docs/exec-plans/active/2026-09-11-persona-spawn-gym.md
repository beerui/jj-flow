# 人格标签 / 反 Start-broad / 运行中的审查占位 + 真人流程靶场

> 状态：active

开始：2026-09-11。样本：`01a08fa6-2e20-7851-96ed-7e49e7d1304b`（供应商 H5，cwd `D:\2025\daji-merchants-mobile`，交接采购商 H5）。对照客服：持久命名队友、人设提示词一次、短派单（读这些 / 交付 / 不要改）、team 在则禁止再开独立 subagent。

## 目标与边界

对话路径执行人必须像客服队友：pager 能认出谁在干活、开场不 Start broad、运行中的审查不能被 `$jj-same` 冲掉。靶场用 Family gym 隔离副本把这条真人流程跑成可迭代用例。

不改 accept 门禁。不恢复宿主 `/review`。不删引擎 / gym / CLI。不宣称加速百分比。不降父进程 `high`（除非用户点头）。P1 自定义 agent 已落地；P2 持久队友本刀落地。不降父进程 `high`（除非用户点头）。

## 完整方案

### 对照样本（01a08fa6）失败面

| 现象 | 证据 |
| --- | --- |
| 审查被 same 冲掉 | REVIEW `01a08fc5` 09:21:04–09:28:07；`/jj-same` 取消审查 wait；RESEARCH `01a08fcb` 09:28:03；两条都是 unlabeled `general-purpose` |
| 派完还在想 | TASK1 711s：思考 478s / 工具 14s；`reasoning_effort=high` 继承 |
| Start broad | TASK1 读完派单立刻 `grep imagePair` + `list_dir docs/code-reviews`；REVIEW 禁令下仍 grep，并读未列出的 `dynamic-enter-form.vue` |
| 派遣行空 | 全部 spawn 的 assistant `content=""` |
| 派单过宽 | TASK1「相关实现以现有代码为准」 |
| 人设提示词打架 | Ralph TASK 无人设提示词；same 调研+实施揉一段；子代理系统「Do not broaden」vs `general-purpose.md`「Start broad / Be thorough」 |

### P0 skill / assignment（本刀）

1. `description` 必须以 `[implementer]` / `[reviewer]` / `[research]` 开头（禁止 `[reviewer] local changes`）。Grok pager 只认第一个 `[tag]`。
2. 活着的 `[reviewer]` 未结束：禁止再 spawn（含 `$jj-same`）。先说「审查还在跑」，标签仍在。占位胜过 `work_policy`「本轮必须 spawn」。G-ralph-4 / G-review-4 / G-same-2。样本 `01a08fa6`。
3. spawn prompt 第一段：人设提示词 + 不要 Start broad / 全仓 grep / list_dir / 再 spawn。
4. ASSIGNMENT `## 读这些` / `## 交付` 必须是精确路径，禁止「以现有代码为准」。
5. 人设提示词拆四份：Ralph 实施 / Ralph 审查 / same 调研 / same 实施。
6. spawn 前非空「派遣…」行（已有 G-ralph-2 / G-review-2，本刀保持）。

### P1 自定义 agent（本刀）

仓库 SSOT：`agents/jj-implementer.md` / `jj-reviewer.md` / `jj-researcher.md`。`install-skill` 写入 `~/.grok/agents/`（及 `--project` 的 `.grok/agents/`）。spawn 用这些类型，替换 `general-purpose` 的 Start broad / Be thorough。不走内置 `explore`（只读且会全仓搜索，写不了 findings/RESEARCH）。审查执行人固定 `reasoning_effort: high`（不 inherit / 不用 `xhigh`）；实施 / 调研仍 inherit。不降父进程 `high`。缺失类型才回退 `general-purpose`。Pager 仍靠 description `[implementer]` / `[reviewer]` / `[research]`。

### P2 持久队友（本刀）

Grok：`resume_from` 续已结束的同类型执行人（继承 transcript + **cwd**）；`send_subagent_message` 只纠偏还在跑的那一个。规则：同人格 + 同 cwd + 已结束 → `resume_from`；换人格或换仓 → 新 spawn。禁止拿源仓 `jj-implementer` resume 进目标仓 HANDOFF。禁止 resume 审查员当实施执行人。运行中的审查占位仍优先（G-ralph-4）。G-ralph-5 / G-review-5 / G-same-3。

### 靶场映射（Family gym，隔离副本）

真人：供应商 H5 TASK1 imagePair 展示 → TASK2 countryName 提交 → `/jj-review` → 审查未完 `/jj-same` 采购商 H5。

靶场：`notes-alpha`（Vuex）= 项目A；`notes-beta`（Pinia）= 项目B。

| 真人切片 | gym 切片 | 精确文件（alpha） |
| --- | --- | --- |
| TASK1 证件双槽展示 | 空列表展示 `暂无笔记` | `src/views/list.js` + `tests/store.test.mjs` |
| TASK2 提交补 countryName | `saveTitle` 持久化 trim 后的 title | `src/store/notes.js` + `tests/store.test.mjs` |
| REVIEW 6 文件 | 只审本轮交付文件 | 上列 + 对应测试 |
| RESEARCH / HANDOFF 采购商 H5 | ADAPT 进 Pinia `useNotes` / `NoteList` | beta：`src/screens/NoteList.js`、`src/composables/useNotes.js`、`tests/useNotes.test.mjs` |

不污染 `jj-lab-family/_materialized`。隔离根：P0 `.tmp/persona-flow-family/`；P1 `.tmp/persona-flow-p1/`（不复用 dirty P0）；P2 `.tmp/persona-flow-p2/`。不跑 `jj ralph init` / `ralph_ops`。

失败信号（迭代）：

- description 无 `[reviewer]`/`[implementer]`/`[research]`
- 运行中的审查期间 spawn 了 RESEARCH
- 执行人首轮（读完派单后）`grep`/`list_dir` 超出 listed 路径
- parent spawn 当拍 `content=""`
- TASK2 同 cwd 已结束同类型却 cold-spawn（缺 `resume_from`）
- `resume_from` 跨人格（审查员当实施、实施当调研）
- 用源仓 implementer `resume_from` 进目标仓 HANDOFF（cwd 会被继承）

## 任务

- [x] P0 skill / 人设提示词 / 合约 / 回归 / 文档 / CHANGELOG（G-ralph-4 / G-review-4 / G-same-2）
- [x] 真人 episode `EP-20260911-merchants-persona-spawn`（`01a08fa6`）
- [x] Family gym 隔离副本：TASK1 → TASK2 → REVIEW → 占位（不冲审查）→ RESEARCH → HANDOFF
- [x] 执行人首轮工具若仍 Start broad：收紧 prompt 再跑下一轮（TASK2 漏：派单写真人 session id → `git show`；SKILL 禁止 sample session/commit ids；same `assignment.md` 去掉「先搜再读」）
- [x] 相关合约 15/15 + `episode-validate` OK + `evaluated:check` OK + `git diff --check`（仅 CRLF warning）+ `install-skill --platform all --force`
- [x] 全量 `npm run verify` PASS（含 `ralph:check` / tests / host-trial / docs:check / evaluated:check / lab:check mechanical）
- [x] P1 自定义 agent SSOT + `install-skill` 写入 `~/.grok/agents` + 合约 `EP-20260911-p1-custom-agents`
- [x] P1 Family gym 第二轮隔离副本 `.tmp/persona-flow-p1/`：TASK1 → TASK2 → REVIEW → 占位 → RESEARCH → HANDOFF（执行人类型 `jj-implementer` / `jj-reviewer` / `jj-researcher`，未回退 `general-purpose`）
- [x] P2 skill / 合约 / eval（G-ralph-5 / G-review-5 / G-same-3）
- [x] P2 Family gym 第三轮隔离副本 `.tmp/persona-flow-p2/`：TASK2 `resume_from` TASK1；HANDOFF 新开（不同 cwd）
- [x] P2 全量 `npm run verify` + `git diff --check`
- [x] P2 文档对齐（CHANGELOG gym 路径、episode 第三轮、zh-bridge G-review-5 / G-same-3、usage 续执行人）
- [x] 真人仓基线：承接 `task-260911-risk-setting` `node --test test/order-risk-config.test.js` 22 pass；无未勾 Step 故未 spawn
- [x] 审查执行人 `reasoning_effort: high`（`agents/jj-reviewer.md`；不 inherit / 不用 `xhigh`；不降父进程 `high`；实施 / 调研仍 inherit）

## 验证记录

隔离仓：`.tmp/persona-flow-family/{notes-alpha,notes-beta}`。alpha HEAD `dbab914`，beta `3939ebc`，branch `feat/empty-label-title-trim`。不污染 `jj-lab-family/_materialized`。

| 切片 | spawn | description | 时长 / 工具 / reasoningTokens | 首轮工具 | Start broad? |
| --- | --- | --- | --- | --- | --- |
| TASK1 | `01a09070-d466-74a0-88c1-bb969e396e4d` | `[implementer] Empty list 暂无笔记` | 149.95s / 7 / 598 | read ASSIGNMENT → listed 3 files → search_replace → test | 否（命中；对照 `01a08fae` 711s/93/30558 立刻 grep） |
| TASK2 | `01a09076-66c7-7543-9665-a33a4fbde047` | `[implementer] saveTitle persist trim` | 52.32s / 9 / 1495 | read ASSIGNMENT → listed 3 → **漏** `git show 01a08fa6` + 读未列出 `httpClient.js` → edit | 部分（派单泄漏 session id；无全仓 grep） |
| REVIEW | `01a09078-8681-7c73-964c-5fb512551cbf` | `[reviewer] Review task-empty-label-title-trim files` | 103.32s / 6 / 4517 | read ASSIGNMENT → listed 4 → write findings | 否（命中；对照 `01a08fc5` 423s/47/21584 仍 grep） |
| 占位 | — | 审查还在跑；未 spawn `[research]` | 命中 G-same-2 | 模拟 `$jj-same` 交接到 notes-beta | 守住 |
| RESEARCH | `01a0907b-fdc0-7840-9e84-c31ae5f4cd1e` | `[research] ADAPT empty-label title-trim notes-beta` | 51.56s / 9 / 1629 | read ASSIGNMENT → listed 源+目标 → write RESEARCH | 否（命中；调研人设提示词未混实施） |
| HANDOFF | `01a0907d-3838-7773-ad84-d0db30703aed` | `[implementer] ADAPT empty-label title-trim notes-beta` | 55.09s / 9 / 1153 | read ASSIGNMENT → listed → edit → test | 否（命中；实施人设提示词未混调研） |

TASK1 漏：上一拍 parent spawn `content=""`（无「派遣…」行）。TASK2 起必须先出派遣行再 spawn。

## 验证记录（P1 第二轮）

隔离仓：`.tmp/persona-flow-p1/{notes-alpha,notes-beta}`。alpha HEAD `15abf57`，beta HEAD `fa33ff9`，branch `feat/empty-label-title-trim`。不复用 `.tmp/persona-flow-family/`。不污染 `jj-lab-family/_materialized`。执行人 `reasoning_effort=xhigh`（未降 parent `high`）。

| 切片 | spawn | type / description | 时长 / 工具 / reasoningTokens | 首轮工具 | Start broad? |
| --- | --- | --- | --- | --- | --- |
| TASK1 | `01a0909f-e7c8-7512-9519-7bd7f19ff6b0` | `jj-implementer` `[implementer] Empty list 暂无笔记` | 36.92s / 7 / 1051 | read ASSIGNMENT → listed 3 → search_replace → test | 否 |
| TASK2 | `01a090a1-634f-7c81-ad9b-d16203017b31` | `jj-implementer` `[implementer] saveTitle persist trim` | 42.64s / 7 / 757 | read ASSIGNMENT → listed 3 → search_replace → test | 否（无 `git show` / 未列出 `httpClient.js`） |
| REVIEW | `01a090a2-db05-7da3-b2bf-603ff9152be0` | `jj-reviewer` `[reviewer] Review task-empty-label-title-trim files` | 130.25s / 6 / 4322 | read ASSIGNMENT → listed 4 → write findings | 否 |
| 占位 | — | 审查还在跑 9.51s / 0 tools；未 spawn `[research]` | 命中 G-same-2 | 模拟 `$jj-same` 交接到 notes-beta | 守住 |
| RESEARCH | `01a090a6-6319-7ca3-ae3d-ae3ae62aaf16` | `jj-researcher` `[research] ADAPT empty-label title-trim notes-beta` | 53.03s / 9 / 1536 | read ASSIGNMENT → listed 源+目标 → write RESEARCH | 否 |
| HANDOFF | `01a090a7-f48a-7c40-85e8-2c3854625ab8` | `jj-implementer` `[implementer] ADAPT empty-label title-trim notes-beta` | 30.79s / 9 / 303 | read ASSIGNMENT → listed → edit → test | 否 |

alpha/beta `node --test` 各 3 pass。未 commit。未用户验收、未 finalize。P1 spawn 全部命中自定义类型，未回退 `general-purpose`。TASK2 上一轮漏已闭合。

## 验证记录（P2 第三轮）

隔离仓：`.tmp/persona-flow-p2/{notes-alpha,notes-beta}`。alpha HEAD `e69728b`，beta HEAD `4f7c34c`，branch `feat/empty-label-title-trim`。不复用 `.tmp/persona-flow-p1/`。不污染 `jj-lab-family/_materialized`。执行人 `reasoning_effort=xhigh`（未降 parent `high`）。

| 切片 | spawn | type / description | 时长 / 工具 / reasoningTokens | 首轮工具 | Start broad? |
| --- | --- | --- | --- | --- | --- |
| TASK1 | `01a090ed-78e6-7572-b4d9-5bdb8eb3b5e4` | `jj-implementer` `[implementer] Empty list 暂无笔记` | 42.63s / 7 / 1034 | read ASSIGNMENT → listed 3 → search_replace → test | 否 |
| TASK2 | `01a090ee-89c0-7282-87bd-ba1b7e26c98a` | `jj-implementer` `[implementer] saveTitle persist trim` **`resume_from` TASK1** | 30.63s / 14 / 1822（turn2 788） | `session_kind=subagent_resume` `parent_session_id=01a090ed`；listed 3 → edit → test | 否 |
| REVIEW | `01a090f3-4523-7783-a72d-cb9c0605eb6e` | `jj-reviewer` `[reviewer] Review task-empty-label-title-trim files` **新 spawn** | 97.92s / 6 / 4175 | read ASSIGNMENT → listed 4 → write findings；`session_kind=subagent`（未 resume implementer） | 否 |
| 占位 | — | 审查还在跑 8.59s / 1 tool `read_file`；未 spawn `[research]` | 命中 G-same-2 | 模拟 `$jj-same` 交接到 notes-beta | 守住 |
| RESEARCH | `01a090f7-03ff-7db3-bfa0-f6b19ec2f6aa` | `jj-researcher` `[research] ADAPT empty-label title-trim notes-beta` **新 spawn cwd beta** | 68.49s / 9 / 2139 | read ASSIGNMENT → listed 源+目标 → write RESEARCH | 否 |
| HANDOFF | `01a090f8-9e27-7820-9f6e-fc7b86c68722` | `jj-implementer` `[implementer] ADAPT empty-label title-trim notes-beta` **新 spawn cwd beta** | 41.44s / 9 / 315 | `session_kind=subagent` 无 `parent_session_id`（未 resume `01a090ee`）→ listed → edit → test | 否 |

G-ralph-5 HIT：TASK2 `resume_from` 同 cwd `jj-implementer`。G-review-5 HIT：审查新开，未 resume 实施执行人。G-same-3 HIT：HANDOFF 新开 notes-beta。alpha/beta `node --test` 各 3 pass。未 commit。未用户验收、未 finalize。审查 `[WARN]` nits 未修（用户未说「按审查改」）。全量 `npm run verify` PASS（tests 471/471；`ralph:check` in_sync 17；`evaluated:check` 含 `EP-20260911-p2-resume-teammates`；`lab:check` mechanical PASS）。`git diff --check` 仅 CRLF warning。
