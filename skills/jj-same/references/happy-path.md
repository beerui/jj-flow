# jj-same Happy Path

Main-path index. Details and long flows live in [workflow-core.md](workflow-core.md) and the references below.

## Numbered main path

1. **Ralph-handoff-first**: lead `.workflow/ralph/<run_id>/.state/run.json` (live flat `task-<slug>/`; leftover `tasks/<id>/` or `RALPH-*/run.json` ok) → `run.handoff`; when `ready=true`, do not redo source analysis.
2. Resolve target roles and authorization scope (user natural language; with control, read-only manifest). **Same turn:** pin each target repo’s live Ralph (same session / review-slice first; else dispatch `task-<slug>`; else lead `run_id`). Missing Ralph → init/resume **in that repo**. Do not write ANL body under `~/.jj-flow`. Do not call `ensureDispatchRalphRuns`.
3. **Branch purpose + CREATE base freshness preflight** (hard gate): [branch-purpose-preflight.md](branch-purpose-preflight.md) (purpose 1–5 + base freshness 6–10; CREATE only from freshened **local** `master` — default `create_from=master`; `base_action` = `FF_LOCAL_MASTER` → `CREATE_FROM_LOCAL_MASTER`; forbid `CREATE_FROM_ORIGIN` and silent CREATE from `dev`).
4. Confirm **`EXECUTION_READY`**; if not met, `BLOCKED` / caveat — do not change business code.
5. Narrowest plan + **implement** target business code and focused tests (same turn; not plan-status-only).
6. Layered verification and evidence (static/focused tests; runtime defaults to user confirmation or `N/A`).
7. **Internally** re-check the final diff against the five criteria (do not show to the user).
8. Minimal artifact and family-plan updates; fill canonical handoff artifacts when needed.
9. Output a **short summary** to the user (see below); write `READY_FOR_HANDOFF / COMPLETED` and advance sync checkpoints only after **`HANDOFF_READY`**.
10. Continuous-sync scenarios: restore `sync_key` and checkpoint → [continuous-sync.md](continuous-sync.md).

Default `port_profile.mode=LITE` (near-isomorphic small change); use FULL only for clear ADAPT / multi-file / continuous sync.

## Dual gates (short definitions)

| Gate | Meaning |
| --- | --- |
| **`EXECUTION_READY`** | User authorized implement; source behavior pinned to stable commit/diff; final requirements can converge; target call chain verified; no `MUST`-impacting `UNRESOLVED`. Coding allowed when met. |
| **`HANDOFF_READY`** | Implementation done, focused checks pass, `quality-review` does not block, required runtime acceptance confirmed or `N/A`. Only then claim handoff complete and advance checkpoints. |

Missing latest source review / UAT PENDING / incomplete family plan is a delivery caveat by default, **not** an `EXECUTION_READY` block. User clearly says “start migration / implement / go” → `EXECUTE_NOW`: after fact check, the next action must be business code or focused tests.

## Self-check criteria (agent-internal; do not recite to the user)

While coding and reviewing the final diff, run these mentally. **Do not** print a “five gates” heading or a “robust ✅ / razor ✅ …” checklist in chat:

- **Robust**: cross-check requirement / session / commits / call chain; protect dirty worktrees and existing features.
- **Razor**: do not expand into unrelated files, docs, formatting, or legacy alignment.
- **Precise**: walk the target’s real entrypoints, not name-only file matches.
- **Minimal**: fewer files and control-flow changes.
- **Reuse**: use the target’s existing wrappers / components / stores / constants.

## User-visible closeout (summary only)

After same / port work, give the user **only** compact facts, for example:

```text
## <target project> summary
- Decision: ADAPT / DIRECT / …
- Changes: path + one-line behavior
- Verification: what ran / what skipped / waiting on user test?
- Git: branch @ tip; committed / uncommitted
- Next: (optional one line)
```

**Do not** attach: five-gate conclusions, long artifact-chain dumps (unless the user asks or BLOCKED needs evidence), or ritual recitation of skill slogans.

## Control-plane boundary

| Scenario | Rule |
| --- | --- |
| **With** `$jj-dispatch` control project | **Read-only** manifest: `origin_project`, `requirement_owner`, `lead_project`, `reference_implementation`, `targets`, `task_key`. This skill only ports / adapts / syncs checkpoints; **do not** invent control tasks or change approval snapshots. Implement in each target’s Ralph — not in `~/.jj-flow/.workflow/tasks/TASK-*`. Do **not** call `ensureDispatchRalphRuns` (dispatch owns scaffold). |
| **Without** control project | Compatible with `source=A targets=B,C`; lead project may hold the family coordination plan. **Family plan ≠ dispatch approval** — no authoritative `task_key`; do not fake a scheduled delivery. Still init/reuse a full Ralph in **each** target repo. |

Business-task artifacts go under that repo’s `.workflow/ralph/task-<slug>/`; **forbid** a private `.workflow/jj-same/` tree and **forbid** treating `control_root` TASK files as the implement home. The `jj-flow` repo itself does not treat `.workflow` as a fact source.

## Other references

| File | When to read |
| --- | --- |
| [workflow-core.md](workflow-core.md) | Lifecycle, evidence entry, artifact-routing detail, workflows 1–7, delivery format |
| [project-family.md](project-family.md) | Roles, paths, port directions |
| [branch-purpose-preflight.md](branch-purpose-preflight.md) | Branch-purpose check before coding |
| [artifact-routing.md](artifact-routing.md) | Canonical paths and registration |
| [handoff-snapshot.md](handoff-snapshot.md) | Prepare / consume / update handoff snapshot |
| [continuous-sync.md](continuous-sync.md) | `sync_key`, checkpoints, deferral, post-change discovery |
| [silence-account-case.md](silence-account-case.md) | Silence-account case (re-verify branches before use) |
