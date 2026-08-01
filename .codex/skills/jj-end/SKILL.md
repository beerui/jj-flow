---
name: jj-end
description: Task closeout that syncs remote branches, commits with Chinese Conventional Commits, pushes the working branch, merges into the integration branch (default dev/develop/main), pushes integration, then returns to the working branch. Use for jj-end, $jj-end, 收工, 结束任务, 任务完成, 提交并合并到dev, land on dev; also proactively when implementation is finished and git closeout is expected. Do not use for mid-task checkpoints, commit-only, review-only, or when push/merge is forbidden.
---

# JJ End

**一次跑完收尾全流程**，不得在中途「只 commit / 只 push」后停等用户，除非 Hard-stop 或冲突。

固定顺序：

```text
fetch → 解析分支 →（可选）提交 → 同步 work → 推送 work
  → 切到 integration 并同步 → merge work → 推送 integration → 切回
```

失败即停并**尽量回到 `work_branch`**。禁止 force push、删分支、改 git config、提交 secrets/无关文件。

## Core Rule

- 显式：`$jj-end` / 收工 / 结束任务 / 提交并合并到 dev
- **主动收尾**：实现完成且用户未禁止 push/merge 时，**先打印一行** `work→integration` 计划，再**自动执行到底**
- 用户说过禁止 push/merge，或 `dry_run=true`：**不得** merge / push；只报告计划或停在 dry_run 表
- 仅提交、不 push/merge：不用本 skill
- **禁止**因「怕 merge」或「先问问」而跳过步骤 4–6（冲突除外，或用户明确禁止）
- 本 skill **不**写 control plane、**不**读/推进 dispatch manifest；调度闭环用 `$jj-dispatch`

## Integration 解析优先级

按序解析 `integration`（每步检查**本地或** `<remote>/<name>` 是否存在）：

1. 用户显式 `integration=`（远端/本地皆无则 **hard-stop**）
2. 家族 / 仓库约定（若文档或用户配置写明 integration 分支名）
3. 启发式：`dev` → `develop` → `main`（仅当存在）
4. 否则停止并询问目标分支

**禁止** monorepo / 子包未声明时默默选 monorepo 根或上层仓库的 integration。工作区须是用户意图的 git 根（`git rev-parse --show-toplevel`）；误判为子包或上层根 → **hard-stop**，报告检出路径与建议。

## Defaults

| key | default |
|-----|---------|
| integration | 见「Integration 解析优先级」；可被显式覆盖 |
| return_to | `work`（`work` \| `integration`） |
| remote | `origin` |
| message | 自动：`type(scope): 中文摘要` |
| dry_run | `false` |
| work_sync | `merge`：work 与远端分叉时用 merge 拉取（非 force） |

`$jj-end` · `$jj-end integration=release return_to=integration` · `$jj-end dry_run=true`

## Workflow

### 1. Inspect + 必须先 fetch

```bash
git rev-parse --show-toplevel
git status --short --branch
git rev-parse --abbrev-ref HEAD
git remote get-url <remote>   # 确认 remote 存在
git fetch <remote> --prune
```

记录：

| 变量 | 含义 |
|------|------|
| `work_branch` | 当前分支（收工开始时的分支） |
| `dirty` | 是否有本任务未提交改动 |
| `ahead` / `behind` | 相对 `@{u}` 或 `origin/<work_branch>` |
| `integration` | 合入目标 |
| `branch_purpose` | 一句话：本任务是否**意图**落在 `work_branch`（非顺手 checkout） |

若本回合改动明显属于另一条 feature/发布线（例如埋点接到发布火车分支），**先停并报告**，建议切到正确 work 分支再收工；不要把错线提交默默 merge 进 integration。判定细则见同包 `jj-same` 的 `references/branch-purpose-preflight.md`（收工侧只做保护，不负责建迁移分支）。

Hard-stop（报告后停止，不改仓库）：

- 非 git 仓库、无 remote
- detached HEAD
- merge / rebase / cherry-pick / revert 进行中
- 工作区含**他人/无关**大量冲突式脏状态且无法安全只提交本任务文件

解析 `integration`：见上文「Integration 解析优先级」（勿在 monorepo 未声明时猜根）。

`dry_run=true`：打印可验证字段表后**停止，不写仓库**：

| 字段 | 含义 |
|------|------|
| `work_branch` | 收工开始时的工作分支 |
| `integration` | 解析后的合入目标 |
| `will_commit` | 是否将提交本任务改动 |
| `will_pull_work` | 是否将 pull/同步 work |
| `will_merge` | 是否将 merge work→integration（同分支则为 false 并说明） |
| `will_push_work` | 是否将 push work |
| `will_push_integration` | 是否将 push integration |
| `return_to` | `work` \| `integration` |
| `blockers[]` | 已知阻塞（无 remote、禁止 merge、路径误判等） |

### 2. Commit（仅本任务；可先于 pull）

有本任务未提交改动时：

1. 读 `git status` / `git diff`；**无关脏文件不 stage**（临时脚本、本地 dump、secrets）
2. `git add -- <paths>`
3. `git diff --check`（失败则修或停）
4. 非交互提交：`type(scope): 中文摘要`（Conventional Commits，摘要中文）
5. `git log -1 --oneline` + `git status --short --branch`

工作区对本任务已干净则跳过 commit。

**无可收尾**：干净 + 无未推送提交 + 已在 integration + 已与远端同步 → 报告后停止。

> 先 commit 再 sync：避免脏树无法 pull。commit 只含本任务文件。

### 3. 同步 work 分支（提交后、推送前 — 必做）

目标：本地 `work_branch` 包含远端最新，再推送。

```bash
git fetch <remote>
```

若存在 `<remote>/<work_branch>`（或已设置 upstream）：

```bash
# 优先快进
git pull --ff-only <remote> <work_branch>
```

若 `--ff-only` 因分叉失败（非网络错误）：

```bash
# 默认 work_sync=merge：把远端合入当前 work（生成 merge commit 可接受）
git pull --no-rebase <remote> <work_branch>
```

- pull **冲突**：`git merge --abort`（若在 merge 中）→ 留在 `work_branch` → 报告冲突文件 → **停止**（不要假装成功）
- 无远端 work 分支：跳过 pull，步骤 4 用 `push -u` 建跟踪

**禁止** `pull --rebase` 除非用户显式要求（减少改写已推送历史风险）。  
**禁止** 跳过本步直接 push（远端领先时 push 必失败，是历史失败主因之一）。

### 4. Push work 分支

若 `work_branch == integration`：**跳过步骤 5 的 merge**（已在目标分支上），仍须：

1. 步骤 3 已同步 integration/work（同一分支）
2. `git push -u <remote> <work_branch>`（或已有 upstream 时 `git push`）
3. 跳到步骤 7（return；此时无「合入另一分支」）

若 `work_branch != integration`：

```bash
git push -u <remote> <work_branch>
```

禁止 force / `--force-with-lease`。push 失败 → 停在 `work_branch`，报告远端提示。

### 5. 同步 integration 并 merge work（必做，除非上一步已判定同分支）

**不得省略。** 不得在 push work 后结束对话。

```bash
git fetch <remote>
```

检出 integration：

| 情况 | 动作 |
|------|------|
| 本地已有 | `git checkout <integration>` |
| 本地无、远端有 | `git checkout -b <integration> --track <remote>/<integration>` |
| 本地与远端都无 | **停止**，不新建空历史；回到 `work_branch` |

同步 integration 到远端最新：

```bash
git pull --ff-only <remote> <integration>
```

若 ff-only 因分叉失败：

```bash
git pull --no-rebase <remote> <integration>
```

冲突 → abort → `git checkout <work_branch>` → 报告 → 停止。

合入工作分支：

```bash
git merge --no-edit <work_branch>
```

- 已是 ancestor（Already up to date）→ 记「无需新 merge」，仍继续 push integration（可能已同步）
- **冲突**：

```bash
git merge --abort
git checkout <work_branch>
```

报告冲突文件列表与建议（在 work 上 rebase/merge integration 后重跑 `$jj-end`）。**不擅自解业务冲突。**

### 6. Push integration

```bash
git push <remote> <integration>
```

禁止 force。失败 → 尽量 `git checkout <work_branch>`，报告错误。

### 7. Return

- `return_to=work` → `git checkout <work_branch>`
- `return_to=integration` → 留在 integration

```bash
git status --short --branch
git log -1 --oneline
git log -1 --oneline <integration>   # 若可解析
```

## 失败与回退（必须遵守）

| 失败点 | 动作 |
|--------|------|
| commit 前 hard-stop | 不改分支、不 merge |
| monorepo/子包工作区误判 | 不 commit/merge；报告 `show-toplevel` 与意图根；停 |
| pull work 冲突 | abort merge；留在 work；停 |
| push work 失败 | 留在 work；停 |
| pull integration 冲突 | abort；checkout work；停 |
| merge work→integration 冲突 | `merge --abort`；checkout work；停 |
| push integration 失败 | checkout work；integration 可能已 merge 未推送，报告需人工 push |
| 用户禁止 push/merge 或 dry_run | 不 push/merge；仅报告计划 |

**禁止**在失败后留下半成品 merge 状态（必须 abort 或明确报告「仍在 merging」）。  
**禁止**把「merge --abort 后的回退」当成收工成功。

## 自检清单（执行中默念）

- [ ] 已 `git fetch`
- [ ] 已 commit 本任务（或确认无）
- [ ] 已 pull/同步 **work** 再 push work
- [ ] 已 checkout **integration** 并 pull/同步
- [ ] 已 `merge work`（同分支则已说明跳过原因）
- [ ] 已 push **integration**
- [ ] 已按 `return_to` 切回
- [ ] 中文完成报告含分支与 hash

缺任一项且非 hard-stop/冲突 → **继续做完**，不要只回复计划。

## Final Response（中文）

只报事实：

- 工作分支 / integration / 最终所在分支
- commit hash + 中文 subject（若有）
- 是否 pull 过 work / integration
- 已推送分支
- 是否执行 merge（或 Already up to date / 同分支跳过）
- 阻塞与下一步（若失败）

## Boundaries

- 仅提交 / 中途 checkpoint：不用本 skill
- ralph 归档/handoff → `$jj-ralph`（本 skill **不写** run / 不写 `COMPLETED` / **不关死** ralph）
- **end ≠ 任务关仓**：只做 Git 落地；归档后再改、半途废弃/resume 仍走 `$jj-ralph`（同 run 优先；见 jj-ralph 无终态冻结）
- 多仓迁移/调度 → `$jj-same` / `$jj-dispatch`
- 不写业务代码、不改 CI 密钥
