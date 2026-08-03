# Agent plane-write hard gates (user does not run CLI)

**Premise:** The user speaks only natural language (dispatch / approve / commit / merged). The Agent itself persists `control-plane.json` and task docs; **must not** require the user to run `jj dispatch-tick` or any CLI to close out.

The authoritative state machine remains `src/dispatchControlPlane.mjs`. When the Agent hand-writes the plane it is writing for the runtime and must self-check the rules below; **on violation, forbid plane write and report the blocking reason instead.**

## A. Status ceiling

| Fact | Highest allowed status |
| --- | --- |
| Code changed, not committed | delivery/target ≤ `EVIDENCE_READY`; development result may be `DONE` but **`produced_commit` must be null** and progress must note dirty |
| Feature commit exists, Review not PASS or not matched to commit | ≤ `EVIDENCE_READY` / `RUNNING` |
| development has `produced_commit` (≥7-char sha) and Review PASS and reviewed == produced | target may be `VERIFIED` |
| User only says “done / merged / ok” | **not** evidence; first `git`-check whether the commit is on the intended branch / on integration, then decide whether to raise `VERIFIED` |

Forbidden:

- Chat closeout that writes delivery/target as `VERIFIED`
- Empty `reviews`, empty findings, or a fake Review PASS with the **same timestamp as bind** used as a gate
- development `outcome=DONE` and target already `VERIFIED` while `produced_commit` is still null

## B. `produced_commit` and git (Agent obtains; never ask the user for sha)

Before writing development complete or raising `VERIFIED`, for each write target:

1. `git -C <path> rev-parse HEAD` and `git log -1 --oneline` (intended feature branch tip)
2. Confirm this task’s changes are on tip (or record a task-scoped cherry-pick sha)
3. Write intent: `result.produced_commit = <full or ≥7 sha>`
4. target / checkpoint / last_result: `commit` and `reviewed_commit` **identical and non-empty** (when `VERIFIED`)
5. Worktree still dirty and dirty belongs to this task → commit first or explicitly stop at `EVIDENCE_READY`; never `VERIFIED`

## C. session / thread bind (no synthetic IDs)

| Host | `thread_id` must be |
| --- | --- |
| Grok Build | a real session id (host id shaped like `019f…-…`); **forbid** placeholders such as `session-<slug>-YYYYMMDD` |
| Codex App | a real thread id |

**Same-session implementation (common and legal on Grok):** when the host cannot / did not create multiple sessions, the dispatch Agent may edit each target repo **inside the current session**, provided:

1. Every intent in this wave sets `thread_id` to the **current real session id** (may be shared)
2. `host_id=grok-build`, `handle_kind=session`
3. **C4:** every **BOUND** intent (**including review/read**) writes an attestation **file**
   `{control_root}/.workflow/dispatch/<DEL>/attestations/<task_key_safe>.json`
   `sandbox_evidence_ref` = that relative path. **Forbid** string-only `host:grok-build:session:…` (development and review treated equally)
4. progress notes `execution=same-session`; still must fill commit per A/B before `VERIFIED`
5. **Forbid** forging four fake sessions just to match four task_keys

Library helpers (jj-flow): `writeGrokAttestation` / `attestationRelativePath` (`src/dispatchAttestation.mjs`).

If a real handle is unavailable → keep intent at `PENDING_THREAD` or only record progress; **do not** write a fake `BOUND` bind.

## D. Pre-persist self-check (recite every plane edit)

```text
[ ] intake / approval match this round’s task_keys
[ ] write tasks: environment=project-branch (or confirmed exclusive-worktree) + intended_branch
[ ] no synthetic thread_id
[ ] C4: every BOUND intent’s sandbox_evidence_ref points to attestations/*.json (incl. review)
[ ] if status≥EVIDENCE_READY: changed_files / summary match git diff
[ ] if status=VERIFIED: produced_commit + commit + reviewed_commit present and consistent
[ ] if status=VERIFIED: task/result.md and progress.md already synced (not still EVIDENCE_READY)
[ ] when lead∉targets: lead_responsibilities planned, or reference_implementation complete (commit+snapshot+verification)
[ ] C5: plane-self-check grade=ok before claiming VERIFIED; may setIntegrityGrade
[ ] C6: after push/merge setRemoteCloseout; user “merged” requires git check, not chat alone
[ ] multi-feature merge to dev (e.g. project C): prefer task-scoped cherry-pick (see EP-S1 / acceptor-tag negative case)
```

Optional (Agent self-runs; **do not** teach the user):

```bash
node skills/jj-dispatch/scripts/plane-self-check.mjs --manifest <control-plane.json> [--json]
```

Output includes `integrity_grade` (C5). Non-zero exit forbids claiming VERIFIED.

## Result-gate addenda

- `reference_implementation` must start as `null`. Set only after lead or an authorized target has a stable commit, `PASS` verification evidence, snapshot ref, and hash.
- Any target failure: keep that target’s prior sync checkpoint; do not advance the whole project-family baseline.
- After source project is done and verified: by default only propose next steps; do not auto-expand the target set. After user choice, re-PREVIEW + APPROVE; forbid reusing old approval or silently creating target threads.
- Target receipts: `VERIFIED` or `NO_CHANGE_REQUIRED`.
  - `VERIFIED`: terminal writer’s current Review PASS new commit, source head, verification evidence; **intent.`produced_commit` matches target commit/reviewed_commit**. No commit → stay at `EVIDENCE_READY`.
  - `NO_CHANGE_REQUIRED`: planning/analysis `ANL-TARGET`, `difference_ref`, target HEAD, `unresolved=[]`; undispatched development/verification/review marked `SKIPPED`; do not forge Developer commit / VRF / Review.
- Both success states for sync targets require `FRESH` handoff, snapshot ref/hash, source/target branch and HEAD, difference-decision refs; missing fields or `STALE` must not advance checkpoint.
- **User natural language alone must not advance checkpoint** (including “merged”, “done”, “ok”); it only triggers the Agent to read git / plane.
- **T-task-result-sync**: when marking delivery/target `VERIFIED`, must update `.workflow/tasks/<TASK-ID>/result.md` and `progress.md` in the same batch:
  - `result.md`: status=`VERIFIED`; table each target’s commit / review PASS; must not keep stale `EVIDENCE_READY` sections as current state
  - `progress.md`: append VERIFIED time and revision
  - plane is SSOT; task docs are human recovery mirrors — **any lag means closeout is incomplete**
