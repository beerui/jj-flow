---
name: jj-end
description: Task closeout that commits with Chinese Conventional Commits, pushes the working branch, merges into the integration branch (default dev/develop), pushes integration, then returns to the working branch. Use for jj-end, $jj-end, 收工, 结束任务, 任务完成, 提交并合并到dev, land on dev; also proactively when implementation is finished and git closeout is expected. Do not use for mid-task checkpoints, commit-only, review-only, or when push/merge is forbidden.
---

# JJ End

固定顺序：提交 → 推送工作分支 → 合入 integration → 推送 → 切回返回分支。

失败即停。禁止 force push、删分支、改 git config、提交 secrets/无关文件。

## Core Rule

- 显式：`$jj-end` / 收工 / 结束任务 / 提交并合并到 dev
- **主动收尾**：实现完成且用户未禁止 push/merge 时，先用一行说明 `work→integration`，再执行
- 仅提交、不 push/merge：不用本 skill

## Defaults

| key | default |
|-----|---------|
| integration | auto：优先 `dev`，否则 `develop`；都可被显式覆盖 |
| return_to | `work`（`work` \| `integration`） |
| remote | `origin` |
| message | 自动：`type(scope): 中文摘要` |
| dry_run | `false` |

`$jj-end` · `$jj-end integration=release return_to=integration` · `$jj-end dry_run=true`

## Workflow

### 1. Inspect

```bash
git rev-parse --show-toplevel
git status --short --branch
git rev-parse --abbrev-ref HEAD
git status -sb
```

记录：

- `work_branch`
- 是否有未提交改动
- 是否有未推送提交（`git log --oneline @{u}..HEAD`；无 upstream 则视为待首次推送）

Hard-stop：非 git 仓库、detached HEAD、merge/rebase/cherry-pick/revert 进行中。

解析 `integration`：

1. 用户显式传入 → 用它
2. 否则本地或 `origin` 存在 `dev` → `dev`
3. 否则本地或 `origin` 存在 `develop` → `develop`
4. 否则停止并询问目标分支

`dry_run=true`：打印 plan（work/integration/return、是否 commit/push/merge）后停止。

### 2. Commit（仅本任务）

有本任务未提交改动时：

1. 读 diff；无关脏文件不 stage
2. `git add -- <paths>`
3. `git diff --check`
4. 非交互提交：`type(scope): 中文摘要`
5. `git log -1 --oneline` + `git status --short --branch`

工作区干净则跳过 commit。
干净且无未推送提交且已在 integration 且已与远端同步 → 报告「无可收尾内容」并停止。

### 3. Push work branch

若 `work_branch == integration`：跳到步骤 5。

```bash
git push -u <remote> <work_branch>
```

禁止 force。失败即停。

### 4. Land on integration

```bash
git fetch <remote>
git checkout <integration>
git pull --ff-only <remote> <integration>
git merge --no-edit <work_branch>
```

分支引导：

- 本地无、远端有：`git checkout -b <integration> --track <remote>/<integration>`
- 本地与远端都无：停止，不凭空建历史

冲突时：

```bash
git merge --abort
git checkout <work_branch>
```

报告冲突文件，不擅自解业务冲突。

### 5. Push integration

```bash
git push <remote> <integration>
```

### 6. Return

- `return_to=work` → `git checkout <work_branch>`
- `return_to=integration` → 留在 integration

```bash
git status --short --branch
git log -1 --oneline
```

## Final Response（中文）

只报事实：

- 工作分支 / integration / 最终所在分支
- commit hash + 中文 subject（若有）
- 已推送分支
- 是否执行 merge
- 阻塞与下一步（若失败）

Codex app 中 stage/commit 成功后按要求发出 git directives。

## Boundaries

- 仅提交 / 中途 checkpoint：不用本 skill
- ralph 归档/handoff → `$jj-ralph`（本 skill 不写 run）
- 多仓迁移/调度 → `$jj-same` / `$jj-dispatch`
