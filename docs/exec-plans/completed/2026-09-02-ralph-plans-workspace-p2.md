# Exec plan — Ralph 任务工作区 P2（身份稳定化）

> 状态：completed
>
> 负责人：jj-flow
>
> 开始日期：2026-09-02
>
> 关联设计：[Ralph 任务工作区 `.plans` 化改造](../../design-docs/ralph-plans-workspace.md)
>
> 前置：[P1](../completed/2026-09-02-ralph-plans-workspace-p1.md) 已关闭（P1a 拆分 / P1b 布局 8→4 / P1c 归档原地翻转）
>
> 边界：本计划只做设计 §4 的 P2。不做 lite 档（P2+）、不写业务仓 AGENTS.md / CLAUDE.md、不改 dispatch 检查点语义。`archive/` 历史快照只读不迁不删。

## 目标

把 ralph 任务身份从「带日期的 `RALPH-*` 目录」收成稳定 `task_key`：`run_id` ≡ 目录名 ≡ `task-<短语>`，机器面进 `.state/`。存量活跃目录靠 `ralph migrate` 硬切；`jj ralph adopt` 做人工绑定（合并 absorb 可后置）。

完成后人 `ls` 任务目录只见三个 md；`run.json` / reviews / handoff 在 `.state/`。

## 非目标

- P2+ lite 档（BRIEF→DELIVER→CLOSE）
- 业务仓库指令文件
- 自动合并双 run（`adopt --absorb` 可列 P2c，失败不阻断 1:1 migrate）
- 改 dispatch 协议 / checkpoint
- 迁移或删除 `.workflow/ralph/archive/` 旧副本
- 改 `skills/jj-evaluated` 冻结的旧 `RALPH-` 证据路径
- npm 发布 / 推远端（除非用户明确要求）

## 已锁定（实现时勿重新设计）

| 项 | 口径 |
| --- | --- |
| 身份 | `run_id` = `task_key` = 目录名；正则 `^task-[a-z0-9][a-z0-9-]{1,80}$` |
| 新布局 | `.workflow/ralph/tasks/<task_key>/{task_plan,progress,findings}.md` + `.state/{run.json,reviews/,handoff.json}` |
| schema | 升 **1.2**（init 只写 1.2 / `task-*`）。`validateRun` 仍读 1.0/1.1 的 `RALPH-*`（只读遗留 + migrate 输入）。不另加 required 键 |
| 硬切 | 活跃 `.workflow/ralph/RALPH-*`：**load / gate / save 报错**并提示 `jj ralph migrate`。`listRuns` 必须把它们标成 `needs_migrate`，禁止静默当成「没有 run」（§3.10 B8） |
| 旧 archive | `.workflow/ralph/archive/` 只读可定位（jj-review「新旧各一个」）；不迁不删 |
| `.migrated-*` | migrate 第 7 步；`listRuns` / load 不认；不自动删 |
| handoff 文件 | 新写 `.state/handoff.json`；`run.handoff` 仍是 SSOT。旧 `handoff/handoff.json` 仅 legacy 读 |
| reviews | `.state/reviews/REV-*.json`；`artifact_refs.latest_review_ref` 仍用 `reviews/REV-n.json`，读取侧拼 `.state/` |
| 1.0 读端回退 | P2a/P2b **保留**（migrate 输入与 archive 快照还要读英文标题）。**P2c migrate 收尾后移除**主动路径的 `Current`/`Tasks` 回退 |
| dispatch | 协议零改动；只同步 `tests/jj-dispatch-contract.test.mjs` 三处 fixture 字符串 |
| CAP/HOF/SNAP | 剥离正则 `/^(?:RALPH|task)-/`；存量 CAP id 不改号，仅新 run 用新形态 |
| 命名 | `namingConfig`：`run_id_pattern: task-{slug}`、`task_dir_pattern: tasks/{task_key}`、`layout.active_run` 改 tasks 路径。`buildRalphRunId` / `assertStrictRalphRunId` 改为 taskId 语义，保留旧导出名作别名以免门面裂 |

## 执行清单

### 切片 0 — 本计划入库

- [x] `docs/exec-plans/active/2026-09-02-ralph-plans-workspace-p2.md`
- [x] 执行索引 + 站点构建清单
- [x] 设计文档加执行指针；索引注明 P1 已落地、P2 进行中
- [x] CHANGELOG Unreleased 指针
- [x] `npm run docs:check` 与 `npm run harness:check`

### P2a — 身份与路径（新 run 只写新布局）

设计 §3.2 / §3.10 表 B5–B8。本切片改 **ralph 控制面路径与 id**；下游 skill 文案在 P2b。

- [x] `namingConfig`：`run_id_pattern` / `run_id_regex` / `layout.active_run` / `task_dir_pattern`；`normalizeRalphSlug` 去 `task-` 与 `RALPH-` 前缀；`buildRalphRunId` 产出 `task-<slug>`（无日期）
- [x] schema 1.2：`run_id` pattern 仅 `task-*`；skill 副本字节同步；`examples/ralph/sample-run.json` **保持 1.0**
- [x] `validateRun` / `validateReviewReport` / `createRunSkeleton`：1.2 必须 `task-*`；1.0/1.1 仍接受 `RALPH-*`
- [x] `runDir` = `.workflow/ralph/tasks/<run_id>/`；`runJsonPath` = `.../.state/run.json`
- [x] `listRuns`：扫描 `tasks/task-*`（有 `.state/run.json`）；活跃 `RALPH-*` 记 `needs_migrate`；忽略 `archive/`、`.migrated-*`、`business-map.json`
- [x] `loadRun` 命中活跃 `RALPH-*` 目录 → 抛错含 `jj ralph migrate`；命中 `archive/` 内旧快照允许只读
- [x] `last_archive_path` 继续指向 **live 任务目录**（P1c 原地翻转不变，只是根从 `RALPH-*` 换成 `tasks/task-*`）
- [x] `tests/jj-ralph-contract.test.mjs`：init 新 run 落在 `tasks/task-…/.state/run.json`；旧 `RALPH-*` fixture 改为 1.2 或标 needs_migrate；B8 静默空列表不得回归
- [x] `npm run ralph:sync` + `ralph:check` + ralph 合约 + `git diff --check`

### P2b — 下游路径与 id 派生

设计 §3.10 表 A / B2–B4。P1b 已把 jj-review 四文件读取改成 `task_plan.md` 三 section；本切片只改 **定位路径**。

- [x] CAP / HOF / SNAP 剥离 `/^(?:RALPH|task)-/`（`src/ralph/{map,gates}.mjs`）
- [x] `skills/jj-same` 五处路径：定位 `tasks/<task_key>/.state/run.json` 与 `.state/handoff.json`；无新布局时走既有 legacy（`RALPH-*/run.json`、`handoff/handoff.json`）
- [x] `skills/jj-review` 定位：优先 `tasks/*/ .state/run.json`；仍能 glob 到 leftover `archive/` 与未迁 `RALPH-*`（只读）。验收：**新旧布局各定位一个 run**
- [x] handoff 写入改 `.state/handoff.json`；`run.handoff.path` / `artifact_refs.handoff_ref` 跟随
- [x] reviews 写入 `.state/reviews/`；review-record 写回仍走 `validateReviewReport`（B7）
- [x] skill / CLI / `docs/commands/jj-ralph.md` 文案：`RALPH-…` 示例改 `task-…`；`artifact-layout.md` 换成 tasks + `.state/`
- [x] `tests/jj-dispatch-contract.test.mjs` 三处 `ralph:RALPH-…` fixture 同步（协议不改）
- [x] `npm run ralph:check` + `tests/jj-ralph-contract.test.mjs` + `tests/jj-dispatch-contract.test.mjs` + same/review 定位用例

### P2c — migrate + adopt + 去掉 1.0 回退

设计 §3.12 / §5 硬切。默认单仓 cwd；`--all-projects` 才走 home 地图。

- [x] `jj ralph migrate` 逐目录 1:1：去日期 → `tasks/task-<slug>/`；slug 冲突 `-2` 并提示
- [x] 步 2–6：四文件已在 P1b 的合成 `task_plan.md`（若仍是 analyze/plan/acceptance 则合并）；英文标题转中文（失败不阻断）；progress 原样 + 轮次索引；无 findings 则建空骨架；`run.json`/reviews/handoff 进 `.state/`；内联残留 `archive-manifest.json`；删 attach/contribution
- [x] 步 7：原目录改 `.migrated-RALPH-<原名>/`；不自动删
- [x] `archive/` 跳过；evaluated 旧路径不改名
- [x] 活跃 `RALPH-*` 在 migrate 前 load 仍报错（P2a 硬切保持）
- [x] `jj ralph adopt --task <task_key>`：把已存在 run 绑到规范目录（可从 needs_migrate 或错误 slug 纠正）
- [x] init：先查 business-map / 热层相似历史，**建议复用**（打印候选，默认不新建）；已有同 `task_key` → resume 而非 init
- [x] `adopt --absorb`：人工确认后合并；REQ/TASK/REV 机械重编号；做不到则提示人工、**不自动**（可本切片落地最小路径：拒绝自动合并 + 打印 §3.12 示例命令）
- [x] 移除主动路径 1.0 标题回退（`当前`→`Current`→`Tasks`→全文 的后两级）。leftover `archive/` 只读定位不走该提取器则无需保留
- [x] 合约：1.0 八文件 fixture 迁到 `tasks/task-slug`；leftover `archive/` 不被 mutate；`.migrated-*` 不出现在 listRuns 活集

## 下一刀

P2 关闭。lite 档见 [P2+](../active/2026-09-03-ralph-plans-workspace-p2-lite.md)。

## 完成定义

- P2a：init 新 run 的 `run_id` 匹配 `task-*`；磁盘在 `tasks/<id>/.state/run.json`；活跃旧目录 load 失败且 `listRuns` 能看见 `needs_migrate`；`ralph:check` in_sync。
- P2b：same / review 能解析新路径；review 新旧布局各定位一个 run；dispatch 合约绿（仅 fixture 字符串）。
- P2c：`ralph migrate` 1:1 绿；archive 快照只读；主动路径不再认 `## Current`/`## Tasks` 为写端兼容。
- 全计划关闭：三切片勾完，本文件移入 `completed/`，设计文档 P2 段标落地。整体设计仍是 Proposed，直到 P2 也有 `> 验收证据：` 再标 Implemented（lite 仍未开）。
- `npm run verify` + `git diff --check`。不推远端。

## 残留风险

| 风险 | 缓解 |
| --- | --- |
| B8 `listRuns` 只扫 `task-*` 导致「没有 run」 | 活跃 `RALPH-*` 必须以 `needs_migrate` 出现，不能省略 |
| schema 1.2 把 1.1 样本判死 | sample 保持 1.0；`validateRun` 双版本；合约断言 LEGACY ≠ current |
| same/review 只改文案不改 glob | P2b 验收含真实路径存在性，不只是 SKILL.md 字符串 |
| migrate 合并双 run 毁掉 REQ 号 | 默认 1:1；absorb 不自动 |
| 去掉标题回退后 leftover archive 提取失败 | 回退只从**主动写路径**移除；archive 只读定位不依赖 Current 提取 |
| 合约测试 50+ 处 `RALPH-` 漏改 | P2a 以 `jj-ralph-contract` 全红驱动，禁止留 init 仍写 `RALPH-*` |
| CAP id 与存量 business-map 断代 | 剥离正则改掉；migrate **不改** 已有 `capability_ids` |
