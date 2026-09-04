---
name: jj-end
description: Task closeout that syncs remote branches, commits with Chinese Conventional Commits, pushes the working branch, merges into the integration branch (default dev/develop/main), pushes integration, then returns to the working branch. Use for jj-end, $jj-end, closeout, end task, task done, commit and merge to dev, land on dev; also proactively when implementation is finished and git closeout is expected. Do not use for mid-task checkpoints, commit-only, review-only, or when push/merge is forbidden.
---

# JJ End

**Run the full closeout pipeline in one pass.** Do not stop after “commit only / push only” and wait for the user, unless Hard-stop or **unhandleable** conflict (see Conflict classify).

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
| 6 | Skip steps 4–6 for “fear of merge” when task / requirement / both-side intents are **already clear** | Historical half-closeout. **Unclear** → ask (G-end-4); fear ≠ unclear |
| 7 | Leave a half-finished merge after failure | Must `merge --abort` or clearly report still merging |
| 8 | Treat `merge --abort` rollback as closeout success | Abort ≠ landed |
| 9 | Create empty integration history when branch missing | No inventing integration |
| 10 | Write control plane / ralph run / dispatch manifests | Use `$jj-dispatch` / `$jj-ralph` |
| 11 | Treat git log / MR titles / `origin/HEAD` / a staging-merge parent / mere `staging` existence / a build-script name containing `staging` as the closeout integration | Historical EP-20260828 land-on-预发; build flavor ≠ land target |
| 12 | Abort because a file is Vue/docs/logic or “looks complex”, or resolve a subset then abort | Historical over-classify (feat/dynamic-form); mixed merge + silent loss |
| 13 | Leave `<<<<<<<` / `=======` / `>>>>>>>` in a completed closeout | Merge not actually finished |
| 14 | Merge integration (`dev` / `develop` / `main`) into the work / feature branch | Direction is only `work → integration`. Never `git merge <integration>` on `work_branch` to “pre-resolve” |
| 15 | `checkout --ours/--theirs` or take one parent file wholesale on conflict | Silent loss (EP-20260904 `40e3f959`: `audit-detail.vue` ≡ feature; dest 外综服 guards dropped) |

## Core Rule

- Explicit: `$jj-end` / closeout / end task / commit and merge to dev
- **Proactive closeout**: when implementation is done and the user did not forbid push/merge, **first print one line** of the `work→integration` plan, then **execute through to the end**
- 🔴 CHECKPOINT · 🛑 STOP — **user forbade push/merge**: must not merge / push; report plan only; do not continue steps 4–6
- 🔴 CHECKPOINT · 🛑 STOP — **`dry_run=true`**: print the field table → stop; no commit / pull-write / merge / push
- 🔴 CHECKPOINT · 🛑 STOP — **unclear task / merge / requirement**: ask first (G-end-4). Do not invent, do not pick a side, do not land
- Commit only, no push/merge: do not use this skill
- **Do not** skip steps 4–6 because of “fear of merge” when both sides are already clear (except **unhandleable** / unclear → ask, or user explicitly forbids)
- This skill does **not** write the control plane, ralph `run.json`, or dispatch manifests. Ralph closeout is `finalize` first; this skill is Git only. Scheduling closeout uses `$jj-dispatch`

## Integration resolution priority

Resolve `integration` in order (each step checks whether the name exists **locally or** as `<remote>/<name>`):

1. User-explicit `integration=` (if missing on both remote and local → **hard-stop**)
2. Family / repo convention (if **docs / AGENTS.md / naming.json / user config explicitly name the closeout/land/merge-target branch**)
3. Heuristic: `dev` → `develop` → `main` (only when present)
4. Otherwise stop and ask for the target branch

Priority-2 “explicitly name” means a sentence that the **closeout / land / merge target** is that branch. A word match for `staging` / `dev` in a script, env, or build flavor is **not** naming.

**Not convention** (EP-20260828): if a candidate target came only from the list below, **discard it** and continue the priority list (usually heuristic `dev`). Do **not** let these override a present `dev`/`origin/dev`:

- git log / `Merge #N into staging` (or other MR titles)
- `origin/HEAD` pointing at `master`
- the work branch was created from a staging-merge commit
- a `staging` / 预发 branch merely existing alongside `dev`
- AGENTS.md / README / `package.json` scripts that only mention `staging` as a **build flavor, env, or script name** (example: `pnpm build:h5:staging`)

To land on 预发/`staging`, the user must write `integration=staging`, or docs/config must name that **closeout** branch. If `dev` exists and convention is undocumented → **merge `dev` only**.

Print the one-line `work→integration` plan **with source** (`user` / `docs` / `heuristic`) before executing steps 4–6. Never print source=`git-log`.

**Do not** silently pick a monorepo root or parent-repo integration when monorepo / package roots are undeclared. The workspace must be the intended git root (`git rev-parse --show-toplevel`); mis-detecting a package or parent root → **hard-stop**, report discovered path and recommendation.

### Golden Q&A — G-end-1 (must not regress)

**Q:** Recent commits are `Merge #N into staging`. `origin/dev` exists. User says `/jj-end` with no `integration=`. Land where?

**A:** `dev`. Git history of staging MRs is not family convention. Regression: `EP-20260828-jj-end-staging-not-dev`.

### Golden Q&A — G-end-2 (must not regress)

**Q:** `git merge work` into `dev` conflicts in AGENTS.md (two “AI commit” policy paragraphs + extra tracking check on feature), `upload.vue` (`readonly` vs `uploadDisabled` on the same drag/delete/upload conditions), a draft-restore block (old tab-drag vs `promptEnterDraftForTab`), and a logo display condition (`showBusinessLogo` vs `userType===2`). Abort because they are “logic”?

**A:** No. Label them `self-merge`. Combine both sides’ intent (union policy text; keep the more complete guard; keep the newer draft helper and the still-true restore; keep the more specific logo condition if it subsumes the other). Resolve **all**, continue closeout. Do **not** abort the whole merge because files are Vue/docs/logic. Do **not** resolve a subset then abort. STOP only if the same product flag is true on one side and false on the other and you cannot tell which product wants. Classify table is user-visible only on STOP.

### Golden Q&A — G-end-3 (must not regress)

**Q:** `git merge feat/dynamic-form` into `dev` conflicts on `merchant-detail.vue` / `audit-detail.vue`. Dest just landed 外综服 (`userType` from query, `=== 12` validate/submit). Work has enter-form template fetch. Merge `dev` into the feature first? Take the feature file so land is easy?

**A:** **Never** merge `dev`/integration into the work branch. Stay on dest, merge work in. Inventory **both** parents’ unique behaviors and keep both (query `userType` + 外综服 guards **and** template/schema fetch). Taking one parent wholesale (`audit-detail` ≡ feature; leftover `isExternalServiceCustomer` with `ref(1)`) is silent loss — a **failed** self-merge, not “too big so pick a side”. Regression: `40e3f959` / recover `6bd69083`.

### Golden Q&A — G-end-4 (must not regress)

**Q:** Closeout task is fuzzy, you cannot name dest-only vs work-only behaviors, or a hunk’s product requirement is ambiguous. Keep going and pick a side so `$jj-end` finishes?

**A:** No. 🔴 **STOP and ask**. Do not invent the task, the land scope, or the requirement. Do not `--ours/--theirs`. Do not merge dest into work. After a **written** answer, self-merge (keep both) or re-run `$jj-end`. Fear of merge when both sides are already clear is **not** this gate.

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

## Conflict classify (prefer self-merge)

Applies to: step 3 pull work, step 5 pull integration, step 5 merge work→integration.

**Default: resolve yourself and continue closeout.** STOP only when a hunk is **unhandleable** (you cannot produce a correct merge without inventing a product decision). “Looks like logic”, “two strategies differ”, Vue/docs, or unsure at first glance is **not** a stop.

Classify before any resolve. Show the classify table to the user only when any file is `unhandleable` (STOP). All-`self-merge` is **not** a user-visible pause or table.

### 1. Inventory (do not abort yet)

```bash
git diff --name-only --diff-filter=U
```

Read each file’s conflict hunks (`<<<<<<<` / `=======` / `>>>>>>>`) **and both parent blobs** (not only the markers). For each file, name dest-only behaviors and work-only behaviors. If you **cannot name both**, the merge is unclear → G-end-4 (ask; do not invent). Resolution must keep **both** sets unless they literally contradict the same product flag.

After resolve, spot-check those names still fire (a leftover computed with a dead `userType = ref(1)` is loss). Do **not** `checkout --ours/--theirs`.

### 2. Classify each file (internal; user-visible only on STOP)

| file | class | reason | resolution |
|------|-------|--------|------------|
| path | `self-merge` \| `unhandleable` | one line | one sentence, or `hand to user` |

### 3. How to judge

Label **`self-merge`** when you can state a one-sentence resolution that **does not invent a product decision**. Typical (not an exhaustive whitelist):

- both sides identical after stripping markers; import/require-only union; changelog both prepended; comment/whitespace only
- lockfile you will **regenerate with the package manager** (never hand-edit)
- both sides evolved the same area: union complementary policy/docs; keep the more complete guard (`readonly` vs `uploadDisabled` → keep the condition that still enforces both intents); keep a renamed helper and the still-true restore; keep the more specific display condition if it subsumes the other
- same Vue method / template changed differently, but the two edits compose (add both behaviors: dest-side still-true guards **and** work-side new fetch/UI). Composing requires naming both sides first — “take the file I understand” is not self-merge

Label **`unhandleable`** only when:

- the same product flag/decision is true on one side and false on the other, and you cannot tell which product wants
- binary / secrets
- too many files to inspect hunk-by-hunk this turn
- after reading hunks **and** surrounding code you still cannot state a resolution without inventing product behavior

First-glance “this looks complex” is a **misclassify**. Read more. Unsure after reading → `unhandleable`.

### 4. Decision

**Any** `unhandleable`:

```bash
git merge --abort
# if this conflict happened on integration:
git checkout <work_branch>
```

🔴 CHECKPOINT · 🛑 STOP — hand the table to the user. Do **not** resolve a subset. Do **not** continue steps 4–6.

**All** `self-merge`: apply the stated resolutions → `git add -- <files>` → confirm no conflict markers remain → `git diff --check` (fix or treat as `unhandleable` and abort) → finish the in-progress merge (`git commit --no-edit` if a merge commit is required) → **continue** the closeout pipeline.

### 5. Report

Happy path (all `self-merge`, closeout continued): see **Final Response**; do not list auto-resolved files.
Any `unhandleable` abort: hand the classify table, then **Final Response** with `已回退`. Abort is **not** closeout success.

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
| `integration_source` | `user` \| `docs` \| `heuristic` — never inferred from git log / MR titles / `origin/HEAD` / build-script word match |
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
| `integration_source` | `user` \| `docs` \| `heuristic` |
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

**Nothing to close out**: clean + no unpushed commits + already on integration + already synced with remote → **Final Response** (`已合并到` + current branch) and stop.

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

- **pull work conflict**: follow **Conflict classify** (all `self-merge` → finish the pull merge and continue; any `unhandleable` → abort, stay on `work_branch`, STOP)
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

**pull integration conflict**: follow **Conflict classify** (any `unhandleable` → abort → `git checkout <work_branch>` → STOP).

Merge work branch:

```bash
git merge --no-edit <work_branch>
```

- Already ancestor (Already up to date) → note “no new merge needed”; still continue to push integration (may already be synced)
- **merge work→integration conflict**: follow **Conflict classify**. Any `unhandleable` → abort → `git checkout <work_branch>` → STOP with table (user states the product call; re-run `$jj-end` and apply it on dest). **Do not** merge integration into work to pre-resolve. All `self-merge` → finish the merge and continue to push integration.

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

🔴 Rows are **STOP or continue-after-classify**. Happy path (including all-`self-merge` conflicts) does **not** pause for user confirmation before push/merge. Any-`unhandleable` is a STOP. Vue/docs/logic that you can compose is **not** unhandleable.

| Trigger | First fix | Still fails / must stop |
|--------|-----------|-------------------------|
| hard-stop before commit (no git/remote, detached, in-progress merge/rebase, unrelated heavy dirt) | Report condition; do not change branch | Stay stopped; do not merge/push |
| monorepo/package workspace mis-detect | Report `git rev-parse --show-toplevel` + intended root | No commit/merge until user fixes cwd/root |
| pull work conflict | **Conflict classify**; all `self-merge` → finish pull and continue | Any `unhandleable`: abort; stay on work; STOP with table |
| push work failure | Stay on work; surface remote error | STOP; no checkout to integration |
| pull integration conflict | **Conflict classify**; all `self-merge` → finish pull and continue | Any `unhandleable`: abort; `git checkout <work_branch>`; STOP with table |
| merge work→integration conflict | **Conflict classify**; all `self-merge` → finish merge and continue to push | Any `unhandleable`: abort; `git checkout <work_branch>`; STOP with table; user states the call; re-run `$jj-end` — **never** merge dest into work |
| push integration failure | Prefer `git checkout <work_branch>` | Report: local may be merged but unpushed; needs manual push |
| unclear task / merge / requirement (cannot name land scope or both-side intents) | 🔴 ask (G-end-4); abort in-progress merge if any | No invent / no pick-a-side / no dest→work; wait for written answer |
| 🔴 user forbids push/merge or `dry_run=true` | Plan / dry_run table only | No push/merge; STOP (do not run steps 4–6) |
| candidate integration is `staging`/`预发` but source would be git-log / existence / build-script (not `user`/`docs`) | Discard candidate; continue priority (heuristic `dev` if present) | Do not merge 预发; STOP only if heuristic also missing |

## Self-check list (while executing)

- [ ] Already `git fetch`
- [ ] Already commit this task (or confirmed none)
- [ ] Already pull/sync **work**, then push work
- [ ] Already checkout **integration** and pull/sync
- [ ] Already `merge work` (or explained skip when same branch)
- [ ] Already push **integration**
- [ ] Already switched per `return_to`
- [ ] Final reply follows **Final Response** (two status lines; classify / dry_run tables only on STOP / dry_run)

If any item is missing and it is **not** hard-stop / 🔴 CHECKPOINT / **unhandleable** conflict → **finish it**; do not reply with only a plan.
If hard-stop or 🔴 CHECKPOINT hit → **stay stopped**; do not “finish it”.
All-`self-merge` conflicts are **not** a stop; classify → resolve → continue.

## Final Response

Closeout finish (landed, already synced, or aborted after `merge --abort` / return to work): **exactly two Chinese lines**. No hash dump, no pushed-branch list, no extra prose.

```text
合并状态：已合并到：<integration>
当前分支：<HEAD after return>
```

or, when the merge was rolled back (`merge --abort`, unhandleable, or other closeout abort that left dest unlanded):

```text
合并状态：已回退：<one-line reason>
当前分支：<HEAD after return>
```

`当前分支` is `git rev-parse --abbrev-ref HEAD` after step 7 (or after abort return). All-`self-merge` that continued to land uses `已合并到`. Abort is **not** closeout success — use `已回退` plus the classify table when unhandleable.

The pre-execution `work→integration` plan line still prints before steps 4–6.

**dry_run / user forbade push/merge / hard-stop before merge:** keep the field table / blockers. Do not pretend `已合并到`. If HEAD is known, still print `当前分支：<HEAD>`.

## Boundaries

- Commit only / mid-task checkpoint: do not use this skill
- ralph archive/handoff → `$jj-ralph` (this skill does **not** write run / does **not** write `COMPLETED` / does **not** hard-close ralph)
- **end ≠ task warehouse close**: Git land only; post-archive edits, mid-way abandon/resume still go through `$jj-ralph` (same run preferred; see jj-ralph no-terminal-freeze)
- multi-repo migrate/schedule → `$jj-same` / `$jj-dispatch`
- do not write business code or change CI secrets
