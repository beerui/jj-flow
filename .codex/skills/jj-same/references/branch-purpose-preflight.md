# Branch purpose preflight

Use this **before** creating a target branch, writing business code, or claiming
`EXECUTION_READY` for `$jj-same` / `/jj-same`.

Episode regression: EP-20260730-S1 (tracker port landed on `feat/pc-0731-dev`
instead of `feat/pc-aliyun-tracker-recognize`).

## Hard gate

If **task purpose** and **current branch purpose** disagree, status is
`BLOCKED` for coding. Allowed next actions only:

1. Create/switch to the correct work branch (from local `master` when required by family rules), or
2. Get an explicit user override that this train branch **is** the intentional landing line, recorded in the family plan / task note.

Do not silently port onto a release-train or unrelated feature branch because it is already checked out.

## Five checks (answer in the delivery report)

| # | Check | Evidence |
| --- | --- | --- |
| 1 | **Task purpose** | One line: e.g. “aliyun tracker port to 项目D” |
| 2 | **Current branch purpose** | `git branch --show-current` + naming tokens / plan / user statement |
| 3 | **Intended work branch** | Match or derive via role-only rewrite of lead branch (see project-family.md) |
| 4 | **Integration target this turn** | `dev` / `develop` / `main` / `staging` / none |
| 5 | **Ship tip content** | If user asks “will merge to staging carry X?”, inspect **tip tree** (files, package.json, entrypoints), not only git history |

Print a short table before coding:

```text
task:     <one line>
current:  <branch> @ <short sha> — purpose: <train|feature|unknown>
intended: <branch or CREATE>
match:    YES | NO
action:   CODE | SWITCH | CREATE | BLOCKED
```

## Golden Q&A (must not regress)

### G1 — Wrong train, right task

**Q:** Checkout is `feat/pc-0731-dev`. Task is tracker integration. Start coding?

**A:** No. Branch purpose is the 0731 release train; task needs a tracker-named
feature line (or user-confirmed intentional attach). Report `match=NO`, then
create/switch.

### G2 — “开始迁移” on wrong checkout

**Q:** User says “开始迁移项目D” while on a non-tracker branch.

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

**Q:** Lead is `feat/pa-aliyun-tracker`. Target is 项目C.

**A:** Derive by replacing role only → `feat/pc-aliyun-tracker` (tokens per
`map.md` / naming rules). Do not attach the port to an unrelated dated train
branch.

## Non-goals

- Does not replace handoff freshness gates.
- Does not require extra user interrogation when the user already named the
  correct branch and checkout matches.
- Does not invent branch names that expand `req_suffix` or drop lead tokens.
