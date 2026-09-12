# EP-20260911 merchants persona spawn

样本会话 `01a08fa6-2e20-7851-96ed-7e49e7d1304b`（供应商 H5 → 采购商 H5）。

## 失败面

- 11× 新上下文 `general-purpose`，`description` 无 `[implementer]` / `[reviewer]` / `[research]`，pager 全是 Generic General。
- TASK1 `01a08fae` 711s：思考 478s，工具 14s；派单「以现有代码为准」；读完 assignment 立刻全库 `grep imagePair`。
- REVIEW `01a08fc5` 禁令下仍 grep，并读未列出文件。
- `/jj-same` 打断运行中的审查：`user_cancel` 审查 poll；RESEARCH `01a08fcb` 09:28:03 vs REVIEW 结束 09:28:07。
- 全部 spawn 当拍 assistant `content=""`（无「派遣…」）。

## 靶场映射

Family gym 隔离副本 `.tmp/persona-flow-family/`：`notes-alpha` = 项目A，`notes-beta` = 项目B。

| 真人 | gym |
| --- | --- |
| imagePair 展示 | 空列表 `暂无笔记` |
| countryName 提交 | `saveTitle` persist trim |
| `/jj-review` | `[reviewer]` 只审 listed files |
| 审查未完 `/jj-same` | 占位：审查还在跑，不 spawn `[research]` |

计划：`docs/exec-plans/active/2026-09-11-persona-spawn-gym.md`。

## 靶场实跑（2026-09-11）

隔离仓 `.tmp/persona-flow-family/`（alpha=`项目A`，beta=`项目B`）。不污染 live gym。不跑 `jj ralph init` / `ralph_ops`。

| 切片 | spawn | description | 时长 / 工具 / reasoning | 对照真人 | 结果 |
| --- | --- | --- | --- | --- | --- |
| TASK1 | `01a09070` | `[implementer] Empty list 暂无笔记` | 150s / 7 / 598 | `01a08fae` 711s / 93 / 30558 | 命中：读派单→listed→改。无 grep |
| TASK2 | `01a09076` | `[implementer] saveTitle persist trim` | 52s / 9 / 1495 | `01a08fbd` 317s | 部分：派单写了 `01a08fa6`，执行人 `git show` + 读未列出 `httpClient.js` |
| REVIEW | `01a09078` | `[reviewer] Review task-empty-label-title-trim files` | 103s / 6 / 4517 | `01a08fc5` 423s / 47 / 21584 | 命中：只读 listed；`[WARN]` |
| 占位 | — | 审查还在跑，未 spawn `[research]` | — | RESEARCH 09:28:03 vs REVIEW 到 09:28:07 | 命中 G-same-2 |
| RESEARCH | `01a0907b` | `[research] ADAPT empty-label title-trim notes-beta` | 52s / 9 / 1629 | `01a08fcb` 192s / 7103 | 命中：调研人设提示词未混实施 |
| HANDOFF | `01a0907d` | `[implementer] ADAPT empty-label title-trim notes-beta` | 55s / 9 / 1153 | `01a08fcf` 379s / 10832 | 命中：Pinia ADAPT；3 pass |

迭代：ASSIGNMENT 禁止贴样本 session/commit id；same `assignment.md` 去掉「先搜再读」。alpha/beta `node --test` 各 3 pass。未 commit。未用户验收、未 finalize。

## 靶场第二轮（P1 自定义 agent，2026-09-11）

隔离仓 `.tmp/persona-flow-p1/`。spawn 类型 `jj-implementer` / `jj-reviewer` / `jj-researcher`（已装入 `~/.grok/agents`）。未回退 `general-purpose`。未降 `high`（执行人 `xhigh`）。

| 切片 | spawn | type | 时长 / 工具 / reasoning | 结果 |
| --- | --- | --- | --- | --- |
| TASK1 | `01a0909f` | `jj-implementer` | 36.92s / 7 / 1051 | 命中；无 grep |
| TASK2 | `01a090a1` | `jj-implementer` | 42.64s / 7 / 757 | 命中；无 `git show` |
| REVIEW | `01a090a2` | `jj-reviewer` | 130.25s / 6 / 4322 | 命中 `[WARN]` |
| 占位 | — | — | reviewer live 9.51s | 未 spawn `[research]` |
| RESEARCH | `01a090a6` | `jj-researcher` | 53.03s / 9 / 1536 | 命中 ADAPT；未实施 |
| HANDOFF | `01a090a7` | `jj-implementer` | 30.79s / 9 / 303 | Pinia ADAPT；3 pass |

## 靶场第三轮（P2 持久队友，2026-09-11）

隔离仓 `.tmp/persona-flow-p2/`。TASK2 `resume_from` TASK1 同一 `jj-implementer`（同 cwd）。审查 / 调研 / 交接均为新 spawn（换人格或换仓）。未 resume 源仓实施执行人进 notes-beta。未降 `high`（执行人 `xhigh`）。

| 切片 | spawn | type | 时长 / 工具 / reasoning | 结果 |
| --- | --- | --- | --- | --- |
| TASK1 | `01a090ed` | `jj-implementer` | 42.63s / 7 / 1034 | 新 spawn；无 grep |
| TASK2 | `01a090ee` | `jj-implementer` | 30.63s / 14 / 1822（turn2 788） | `session_kind=subagent_resume` `parent_session_id=01a090ed` |
| REVIEW | `01a090f3` | `jj-reviewer` | 97.92s / 6 / 4175 | 新 spawn；未 resume 实施执行人；`[WARN]` |
| 占位 | — | — | reviewer live 8.59s | 未 spawn `[research]` |
| RESEARCH | `01a090f7` | `jj-researcher` | 68.49s / 9 / 2139 | 新 spawn cwd beta；ADAPT |
| HANDOFF | `01a090f8` | `jj-implementer` | 41.44s / 9 / 315 | 新 spawn cwd beta；无 `parent_session_id`；3 pass |

G-ralph-5 / G-review-5 / G-same-3 命中。alpha/beta `node --test` 各 3 pass。未 commit。未用户验收、未 finalize。
