# Branch purpose preflight

Use this **before** creating a target branch, writing business code, or claiming
`EXECUTION_READY` for `$jj-same` / `/jj-same`.

Episode regression: EP-20260730-S1 (tracker port landed on `feat/pc-0731-dev`
instead of `feat/pc-aliyun-tracker-recognize`).

## Hard gate

If **task purpose** and **current branch purpose** disagree, status is
`BLOCKED` for coding. Allowed next actions only:

1. Create/switch to the correct work branch (from a **fresh** integration base — see checks 6–10), or
2. Get an explicit user override that this train branch **is** the intentional landing line, recorded in the family plan / task note.

Do not silently port onto a release-train or unrelated feature branch because it is already checked out.

## Checks 1–5 — branch purpose (answer in the delivery report)

| # | Check | Evidence |
| --- | --- | --- |
| 1 | **Task purpose** | One line: e.g. “aliyun tracker port to Project D” |
| 2 | **Current branch purpose** | `git branch --show-current` + naming tokens / plan / user statement |
| 3 | **Intended work branch** | Match or derive via role-only rewrite of lead branch (see project-family.md) |
| 4 | **Integration *land* target this turn** | `dev` / `develop` / `main` / `staging` / none — **merge/closeout land only; must not silently become CREATE base** |
| 5 | **Ship tip content** | If user asks “will merge to staging carry X?”, inspect **tip tree** (files, package.json, entrypoints), not only git history |

## Checks 6–10 — base freshness (CREATE hard gate, local-master-only)

Episode regression: **EP-20260803** (`DEL-shang-tag-color-cz-20260803`): purpose gate correctly forced CREATE off a tracker train, but the agent branched from **stale local `master`** (64 commits behind `origin/master`). **2026-08-10 policy**: CREATE only from freshened **local** `master`; `CREATE_FROM_ORIGIN` removed as primary path.

When `action` is **CREATE** (or SWITCH that recreates the intended branch from integration base), also answer:

| # | Check | Evidence |
| --- | --- | --- |
| 6 | **Base ref (CREATE base)** | Default **local** `master` (map / written user override only; **not** silent `dev`/`develop`) |
| 7 | **Local base tip** | `git rev-parse --short <base>` |
| 8 | **Remote-tracking tip** | After `git fetch <remote> <base>`: `git rev-parse --short <remote>/<base>` |
| 9 | **behind_count** | `git rev-list --count <base>..<remote>/<base>` |
| 10 | **base_action** | See table below |

| `behind_count` / workspace | `base_action` |
| --- | --- |
| `0` and local base not diverged | `CREATE_FROM_LOCAL_MASTER` — `git checkout -b <feat> master` (local ref only) |
| `>0` and local `<base>` **clean** (no unique commits / dirty that block ff) | `FF_LOCAL_MASTER` then `CREATE_FROM_LOCAL_MASTER` — `git checkout master` + `git merge --ff-only origin/master`, **then** `git checkout -b <feat> master` |
| local base **dirty** or **ahead/diverged** with unrelated commits | `NEEDS_CONFIRM` / `BLOCKED` — do **not** `reset --hard`; do **not** silently branch from stale tip |
| cannot fetch remote | `NEEDS_CONFIRM` — report last known lag; user may override with recorded base SHA (written approval) |
| non-default CREATE base (e.g. `dev`) without written approval | `NEEDS_CONFIRM` / `BLOCKED` — silent CREATE from `dev`/`develop` **forbidden** |

**Hard rule:** never `git checkout -b <feat>` from a local base tip when `behind_count > 0`. Always freshen **local** master first (`FF_LOCAL_MASTER`), then create from **local** master. **`CREATE_FROM_ORIGIN` is removed** as an allowed primary path (do not `checkout -b <feat> origin/master` while leaving local master stale).

**Still forbidden:** `reset --hard` / rewrite of a dirty or divergent local `master` without **written** user approval. Fetch + ff-only on a clean tracking base is **required**, not “auto rewrite”.

**CREATE vs land:** check 4 (integration land, often `dev`) is independent of CREATE base (default local `master`). Do not treat land target as CREATE base.

Print a short table before coding:

```text
task:          <one line>
current:       <branch> @ <short sha> — purpose: <train|feature|unknown>
intended:      <branch or CREATE>
match:         YES | NO
base:          master @ <local short sha>
origin_base:   origin/master @ <short sha>   # after fetch when CREATE
behind_count:  <n>
base_action:   FF_LOCAL_MASTER | CREATE_FROM_LOCAL_MASTER | NEEDS_CONFIRM | BLOCKED
create_from:   master (local)                # never origin/master as primary
action:        CODE | SWITCH | CREATE | BLOCKED
```

## Golden Q&A (must not regress)

### G1 — Wrong train, right task

**Q:** Checkout is `feat/pc-0731-dev`. Task is tracker integration. Start coding?

**A:** No. Branch purpose is the 0731 release train; task needs a tracker-named
feature line (or user-confirmed intentional attach). Report `match=NO`, then
create/switch.

### G2 — “Start migration” on wrong checkout

**Q:** User says “start migration to Project D” (or Chinese: “开始迁移项目D”) while on a non-tracker branch.

**A:** Run preflight table first. `EXECUTION_READY` is false until branch purpose
matches or user overrides in writing.

### G3 — Recovery after wrong-branch land

**Q:** Tracker commits already on the wrong train branch.

**A:**

1. Create correct feature branch from the agreed base.
2. Cherry-pick tracker commits onto it.
3. On the wrong train branch, `git revert` the tracker commit(s) (no force-push of shared history).
4. Re-verify tip trees on both lines.

### G4 — Staging content question

**Q:** “If we merge `feat/pc-0731-dev` to staging, does the release include tracker?”

**A:** Inspect the **current tip tree**. History may contain both
`feat(tracker)` and a later `Revert`. Merge ships the tree, not the intermediate
commits. List presence/absence of tracker entry files and dependency.

### G5 — Role-only branch derivation

**Q:** Lead is `feat/pa-aliyun-tracker`. Target is Project C.

**A:** Derive by replacing role only → `feat/pc-aliyun-tracker` (tokens per
`map.md` / naming rules). Do not attach the port to an unrelated dated train
branch.

### G6 — Stale local master on CREATE

**Q:** Intended feature branch does not exist. Current checkout is an unrelated
train. Local `master` is behind `origin/master` by many commits. Worktree is
clean enough to leave the train branch. CREATE?

**A:** Run purpose table **and** base-freshness checks. `git fetch origin master`.
Do **not** `checkout -b` from the stale local master tip. Do **not** use
`CREATE_FROM_ORIGIN` (`checkout -b <feat> origin/master`). When local master is
clean: `FF_LOCAL_MASTER` — `git checkout master` + `git merge --ff-only origin/master`
— then `CREATE_FROM_LOCAL_MASTER` — `git checkout -b <feat> master`. Dirty or
diverged local master → `NEEDS_CONFIRM` / `BLOCKED` (no silent `reset --hard`).
Default CREATE base is local `master`, not `dev`. Report `behind_count` and
`create_from=master` in the preflight table. Regression:
`EP-20260803-dispatch-stale-master-branch` (path tightened 2026-08-10).

## Non-goals

- Does not replace handoff freshness gates.
- Does not require extra user interrogation when the user already named the
  correct branch and checkout matches **and** base is not stale for CREATE.
- Does not invent branch names that expand `req_suffix` or drop lead tokens.
- Does not force-push or hard-reset a divergent local `master`.
