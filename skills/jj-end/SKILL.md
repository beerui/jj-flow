---
name: jj-end
description: "Task Git closeout: validate a preview, fetch, commit task files with Chinese Conventional Commits, sync/push work, merge/push integration, return to work. Use for $jj-end, /jj-end, closeout, 收工, 提交并合并. Git only; not commit-only, review, or Ralph archive."
---

# JJ End

Complete the authorized Git closeout in one pass. Keep the user’s task branch and integration target explicit. Ralph archive is separate; do not write run.json, dispatch manifests or checkpoint state.

## Immediate actions

1. Resolve `scripts/end_ops.mjs` beside this skill (portable library included); `jj end` is equivalent when the package is installed. Use the runner for the mechanical pipeline. Do not reread the full policy or issue individual Git commands for every happy-path step.
2. Confirm the current Git root and intended task branch from session evidence. Prepare a JSON array of exact task paths and a Chinese Conventional Commit message in OS temporary files outside the repository. Rename needs both endpoints. Existing staged/unstaged changes to a selected file are included together; unrelated dirt is a visible blocker, never silently staged or stashed.
3. Run `preview` once. It reads local refs without fetch or index writes. Check `work_branch`, `integration.branch/source`, `task_paths`, `other_paths`, and `blockers`. Print one line `work → integration（source）`. An explicit `dry_run=true` ends here. A preview does not require a second permission ceremony when closeout is already authorized.
4. Run `execute --plan-file <preview>` once. It validates the root, branch, local refs, remote identity and exact staged/unstaged/untracked snapshot, then executes the sequence below with normal hooks. The result contains per-step status/timing and separate push results. Failures stop dependent steps and try to return to work.
5. Conflicts → read only the relevant [conflict policy](references/git-policy.md), inspect both parents using returned blob ids, resolve on the recorded destination, verify/commit, regenerate preview and continue. A runner abort rolls back its own failed merge for inspection; it does not mean every conflict is unhandleable or that closeout succeeded. Do not end the task on an automatically aborted but resolvable conflict.

```text
fetch → resolve → optional commit → sync work → push work
→ sync integration → merge work → push integration → return
```

## Runner commands

Run from the intended business Git root, or pass `--cwd DIR`. The agent prepares the files and performs these commands; users continue to say `$jj-end` / `/jj-end`.

```text
node <skill>/scripts/end_ops.mjs preview --work-branch <work> --paths-file <OS-temp-paths.json> --message-file <OS-temp-message.txt> --output <OS-temp-preview.json>
node <skill>/scripts/end_ops.mjs execute --plan-file <OS-temp-preview.json>
```

Optional preview inputs: `--integration dev`, `--remote origin`, `--return-to work|integration`. Omit paths/message for a clean tree. `--path` is repeatable. `--convention-file` accepts `{branch, source_path, excerpt}` from real explicit repository guidance; the source sentence is checked and fingerprinted. Both PowerShell and Bash use the same Node runner; no inline complex JSON or `@{u}` quoting is needed. Git >= 2.38 is required for merge-tree verification.

## Integration and scope

Priority: explicit user target → explicit closeout target in repository/family docs → existing `dev` → `develop` → `main` (local or remote-tracking refs). A named missing target stops. History/MR titles, `origin/HEAD`, mere `staging` existence and staging build scripts are not conventions. Only an explicit user/docs target can override dev for staging. Fetch rechecks the selected target; newly changed target/source requires a fresh preview.

Known or explicit `work_branch` must match the task’s actual branch purpose. Wrong root, detached HEAD, no remote, unfinished merge/rebase/cherry-pick/revert, dirty submodules or unselected dirty paths block batch execution. Do not invent a branch purpose, integration history or product requirement.

## Invariants

- No force push, rebase, branch deletion, config/credential changes, blanket staging, secret/temp/unrelated commits, skipped hooks, stash or hard reset.
- Direction is work → integration. Never merge integration into work to pre-resolve. Never take an entire `--ours`/`--theirs` file; preserve both parents’ unique behaviors.
- Verify before closeout. Green tests do not replace code review or grant push authorization. User-forbidden push/merge means preview only.
- Failed commit/hooks never lead to push; failed work push never leads to integration. A locally merged but rejected integration push is reported as incomplete and recoverable.
- Code/index/HEAD/ref/remote changes invalidate preview. Regenerate after examining the change; do not edit plan hashes. Reruns preserve completed commits/pushes and skip merges already present.
- Conflicts that compose are resolved by the host and continued. Ask only when task/merge/product intent cannot be established from existing authorization and evidence. Do not classify Vue/docs/logic as unhandleable just by file type.

## Final Response

Success: exactly one Chinese line, based on the actual returned branch:

```text
已合并：<work_branch> → <integration> · 当前在 <HEAD after return>
```

Use the same format for either `return_to` value, reporting the actual current branch. Same branch: `已合并：<integration> · 当前在 <integration>`.
Incomplete/aborted: `已回退：<one-line reason> · 当前在 <HEAD after return>` only when rollback actually occurred; otherwise state the failed step and actual partial push/merge state. Abort is never success. Dry-run / preflight blockers use the field table instead. Detailed examples and manual recovery remain in [git-policy.md](references/git-policy.md); read those only for the relevant exception.
