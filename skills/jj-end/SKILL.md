---
name: jj-end
description: Task closeout that syncs remote branches, commits with Chinese Conventional Commits, pushes the working branch, merges into the integration branch (default dev/develop/main), pushes integration, then returns to the working branch. Use for jj-end, $jj-end, closeout, end task, task done, commit and merge to dev, land on dev; also proactively when implementation is finished and git closeout is expected. Do not use for mid-task checkpoints, commit-only, review-only, or when push/merge is forbidden.
---

# JJ End

**Run the full closeout pipeline in one pass.** Do not stop after “commit only / push only” and wait for the user, unless Hard-stop or conflict.

Fixed order:

```text
fetch → resolve branches → (optional) commit → sync work → push work
  → checkout integration and sync → merge work → push integration → return
```

On failure, stop and **try to return to `work_branch`**.

## Red-light blacklist (never do)

| # | Forbidden | Why |
|---|-----------|-----|
| 1 | `git push --force` / `--force-with-lease` | Rewrites published history |
| 2 | Delete branches (`-d`/`-D` remote or local closeout cleanup) | Closeout is land-only, not branch GC |
| 3 | Change git config / credentials | Out of scope; security surface |
| 4 | Commit secrets, temp dumps, unrelated dirty files | Scope creep + leak risk |
| 5 | `git pull --rebase` unless user explicitly asks | Rewrites published commits |
| 6 | Skip steps 4–6 for “fear of merge” / “ask first” | Historical half-closeout failure mode |
| 7 | Leave a half-finished merge after failure | Must `merge --abort` or clearly report still merging |
| 8 | Treat `merge --abort` rollback as closeout success | Abort ≠ landed |
| 9 | Create empty integration history when branch missing | No inventing integration |
| 10 | Write control plane / ralph run / dispatch manifests | Use `$jj-dispatch` / `$jj-ralph` |

## Core Rule

- Explicit: `$jj-end` / closeout / end task / commit and merge to dev
- **Proactive closeout**: when implementation is done and the user did not forbid push/merge, **first print one line** of the `work→integration` plan, then **execute through to the end**
- 🔴 CHECKPOINT · 🛑 STOP — **user forbade push/merge**: must not merge / push; report plan only; do not continue steps 4–6
- 🔴 CHECKPOINT · 🛑 STOP — **`dry_run=true`**: print the field table → stop; no commit / pull-write / merge / push
- Commit only, no push/merge: do not use this skill
- **Do not** skip steps 4–6 because of “fear of merge” or “ask first” (except conflict, or user explicitly forbids)
- This skill does **not** write the control plane and does **not** read/advance dispatch manifests; scheduling closeout uses `$jj-dispatch`

## Integration resolution priority

Resolve `integration` in order (each step checks whether the name exists **locally or** as `<remote>/<name>`):

1. User-explicit `integration=` (if missing on both remote and local → **hard-stop**)
2. Family / repo convention (if docs or user config name the integration branch)
3. Heuristic: `dev` → `develop` → `main` (only when present)
4. Otherwise stop and ask for the target branch

**Do not** silently pick a monorepo root or parent-repo integration when monorepo / package roots are undeclared. The workspace must be the intended git root (`git rev-parse --show-toplevel`); mis-detecting a package or parent root → **hard-stop**, report discovered path and recommendation.

## Defaults

| key | default |
|-----|---------|
| integration | see “Integration resolution priority”; overridable |
| return_to | `work` (`work` \| `integration`) |
| remote | `origin` |
| message | auto: `type(scope): Chinese summary` |
| dry_run | `false` |
| work_sync | `merge`: when work diverged from remote, pull with merge (not force) |

`$jj-end` · `$jj-end integration=release return_to=integration` · `$jj-end dry_run=true`

## Workflow

### 1. Inspect + must fetch first

```bash
git rev-parse --show-toplevel
git status --short --branch
git rev-parse --abbrev-ref HEAD
git remote get-url <remote>   # confirm remote exists
git fetch <remote> --prune
```

Record:

| Variable | Meaning |
|------|------|
| `work_branch` | current branch (branch at closeout start) |
| `dirty` | whether this task has uncommitted changes |
| `ahead` / `behind` | relative to `@{u}` or `origin/<work_branch>` |
| `integration` | merge target |
| `branch_purpose` | one line: whether this task **intends** to land on `work_branch` (not an accidental checkout) |

If this turn’s changes clearly belong to another feature/release line (e.g. telemetry attached to a release-train branch), **stop and report first**; suggest switching to the correct work branch before closeout; do not silently merge the wrong line into integration. Decision details: [`skills/jj-same/references/branch-purpose-preflight.md`](../jj-same/references/branch-purpose-preflight.md) (closeout only protects; it does not create migration branches).

🔴 CHECKPOINT · 🛑 STOP — **Hard-stop** (report then stop; do not change the repo):

- not a git repo, or no remote
- detached HEAD
- merge / rebase / cherry-pick / revert in progress
- working tree has **other people’s / unrelated** heavy conflict-like dirt that cannot safely commit only this task’s files

Resolve `integration`: see “Integration resolution priority” above (do not guess monorepo root when undeclared).

`dry_run=true`: print a verifiable field table then **stop without writing the repo**:

| Field | Meaning |
|------|------|
| `work_branch` | work branch at closeout start |
| `integration` | resolved merge target |
| `will_commit` | whether this task’s changes will be committed |
| `will_pull_work` | whether work will be pulled/synced |
| `will_merge` | whether work→integration merge will run (false when same branch; explain) |
| `will_push_work` | whether work will be pushed |
| `will_push_integration` | whether integration will be pushed |
| `return_to` | `work` \| `integration` |
| `blockers[]` | known blockers (no remote, merge forbidden, path mis-detect, etc.) |

🔴 CHECKPOINT · 🛑 STOP — after dry_run table: end turn; do not run steps 2–7.

### 2. Commit (this task only; may precede pull)

When this task has uncommitted changes:

1. Read `git status` / `git diff`; **do not stage unrelated dirty files** (temp scripts, local dumps, secrets)
2. `git add -- <paths>`
3. `git diff --check` (fix or stop on failure)
4. Non-interactive commit: `type(scope): Chinese summary` (Conventional Commits; subject in Chinese)
5. `git log -1 --oneline` + `git status --short --branch`

If the working tree is already clean for this task, skip commit.

**Nothing to close out**: clean + no unpushed commits + already on integration + already synced with remote → report and stop.

> Commit before sync: avoid a dirty tree that cannot pull. Commit only this task’s files.

### 3. Sync work branch (after commit, before push — required)

Goal: local `work_branch` includes remote latest, then push.

```bash
git fetch <remote>
```

If `<remote>/<work_branch>` exists (or upstream is set):

```bash
# prefer fast-forward
git pull --ff-only <remote> <work_branch>
```

If `--ff-only` fails due to divergence (not network error):

```bash
# default work_sync=merge: merge remote into current work (merge commit OK)
git pull --no-rebase <remote> <work_branch>
```

- 🔴 CHECKPOINT · 🛑 STOP — **pull work conflict**: `git merge --abort` (if mid-merge) → stay on `work_branch` → report conflict files → stop (do not fake success)
- no remote work branch: skip pull; step 4 uses `push -u` to set tracking

**Forbidden** `pull --rebase` unless the user explicitly asks (see blacklist).
**Forbidden** to skip this step and push directly (push fails when remote is ahead — a common historical failure mode).

### 4. Push work branch

If `work_branch == integration`: **skip step 5 merge** (already on target), but still:

1. Step 3 already synced integration/work (same branch)
2. `git push -u <remote> <work_branch>` (or `git push` when upstream exists)
3. Jump to step 7 (return; no “merge into another branch”)

If `work_branch != integration`:

```bash
git push -u <remote> <work_branch>
```

No force / `--force-with-lease`. On push failure → stay on `work_branch`, report remote message.

### 5. Sync integration and merge work (required unless same-branch above)

**Do not omit.** Do not end the conversation after pushing work.

```bash
git fetch <remote>
```

Check out integration:

| Situation | Action |
|------|------|
| local exists | `git checkout <integration>` |
| local missing, remote exists | `git checkout -b <integration> --track <remote>/<integration>` |
| neither local nor remote | **stop**; do not create empty history; return to `work_branch` |

Sync integration to remote latest:

```bash
git pull --ff-only <remote> <integration>
```

If ff-only fails due to divergence:

```bash
git pull --no-rebase <remote> <integration>
```

🔴 CHECKPOINT · 🛑 STOP — **pull integration conflict**: abort → `git checkout <work_branch>` → report → stop.

Merge work branch:

```bash
git merge --no-edit <work_branch>
```

- Already ancestor (Already up to date) → note “no new merge needed”; still continue to push integration (may already be synced)
- 🔴 CHECKPOINT · 🛑 STOP — **merge work→integration conflict**:

```bash
git merge --abort
git checkout <work_branch>
```

Report conflict file list and recommendation (rebase/merge integration on work, then re-run `$jj-end`). **Do not resolve business conflicts on your own.**

### 6. Push integration

```bash
git push <remote> <integration>
```

No force. On failure → prefer `git checkout <work_branch>`, report error.

### 7. Return

- `return_to=work` → `git checkout <work_branch>`
- `return_to=integration` → stay on integration

```bash
git status --short --branch
git log -1 --oneline
git log -1 --oneline <integration>   # if resolvable
```

## Failure and recovery (must follow)

🔴 All rows below are **STOP exits** (not “retry until success”). Happy path does **not** pause for user confirmation before push/merge.

| Trigger | First fix | Still fails / must stop |
|--------|-----------|-------------------------|
| hard-stop before commit (no git/remote, detached, in-progress merge/rebase, unrelated heavy dirt) | Report condition; do not change branch | Stay stopped; do not merge/push |
| monorepo/package workspace mis-detect | Report `git rev-parse --show-toplevel` + intended root | No commit/merge until user fixes cwd/root |
| pull work conflict | `git merge --abort` if mid-merge; stay on work | Report conflict files; STOP (do not fake success) |
| push work failure | Stay on work; surface remote error | STOP; no checkout to integration |
| pull integration conflict | Abort pull/merge; `git checkout <work_branch>` | Report; STOP |
| merge work→integration conflict | `git merge --abort`; `git checkout <work_branch>` | Report files + “re-run `$jj-end` after resolving on work”; STOP |
| push integration failure | Prefer `git checkout <work_branch>` | Report: local may be merged but unpushed; needs manual push |
| 🔴 user forbids push/merge or `dry_run=true` | Plan / dry_run table only | No push/merge; STOP (do not run steps 4–6) |

## Self-check list (while executing)

- [ ] Already `git fetch`
- [ ] Already commit this task (or confirmed none)
- [ ] Already pull/sync **work**, then push work
- [ ] Already checkout **integration** and pull/sync
- [ ] Already `merge work` (or explained skip when same branch)
- [ ] Already push **integration**
- [ ] Already switched per `return_to`
- [ ] Final report includes branches and hashes (commit subject may be Chinese)

If any item is missing and it is **not** hard-stop / 🔴 CHECKPOINT / conflict → **finish it**; do not reply with only a plan.
If hard-stop or 🔴 CHECKPOINT hit → **stay stopped**; do not “finish it”.

## Final Response

Report facts only:

- work branch / integration / final branch
- commit hash + subject (if any; subject may be Chinese)
- whether work / integration were pulled
- branches pushed
- whether merge ran (or Already up to date / same-branch skip)
- blockers and next steps (on failure)

## Boundaries

- Commit only / mid-task checkpoint: do not use this skill
- ralph archive/handoff → `$jj-ralph` (this skill does **not** write run / does **not** write `COMPLETED` / does **not** hard-close ralph)
- **end ≠ task warehouse close**: Git land only; post-archive edits, mid-way abandon/resume still go through `$jj-ralph` (same run preferred; see jj-ralph no-terminal-freeze)
- multi-repo migrate/schedule → `$jj-same` / `$jj-dispatch`
- do not write business code or change CI secrets
