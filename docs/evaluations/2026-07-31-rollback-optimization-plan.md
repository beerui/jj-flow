# Optimization plan — dispatch rollback after Mode S live path B

> Status: **proposed** (jj-evaluated; not promoted)
>
> Basis episodes:
> - success: `docs/evaluations/2026-07-31-readme-pnpm-dispatch.md`
> - rollback: `docs/evaluations/2026-07-31-readme-pnpm-rollback.md`
>
> Exec plan parent: `docs/exec-plans/completed/2026-07-31-dispatch-ralph-rollback.md` (R1–R4 done; Ralph R3-3 superseded 2026-08-01 by no-freeze)
>
> Non-goals of this plan: auto git revert/unmerge/force-push; rewrite business README; mutate live control_root as part of harness tests.

## 1. Problem statement (trace-backed)

Live Mode S delivery `DEL-readme-pnpm-install-20260731` was a **control-plane success** then a **path B rollback success**, but the **library path was not mechanical**:

| Observation | Evidence |
| --- | --- |
| Strict `reopenTarget` requires `validateControlPlane` OK | `src/dispatchControlPlane.mjs` input gate |
| Mode S plane fails validation | shared `thread_id` across intents; soft `DONE`/`BOUND`; missing last_result/checkpoint shape |
| Agent used soft reopen script + user-gated git revert | rollback eval wall ~2.3 min; events `TARGET_REOPENED` + `GIT_ROLLBACK_REVERT` |
| Risk if unfixed | next Agent **hand-edits** VERIFIED or invents another ad-hoc script |

**Causal hypothesis (primary):**  
`validateControlPlane` treats every non-null `thread_id` as globally unique **regardless of status/host**, but Mode S **requires** one real session shared by many task_keys. Reopen cannot run until that mismatch is resolved **or** a first-class soft/normalize path exists.

**Falsifier:** A Mode S plane with shared session that validates and `reopenTarget`s without errors would refute the hypothesis.

## 2. Split manifest (no holdout leakage)

| Split | Cases | Use |
| --- | --- | --- |
| **search** | readme-pnpm Mode S soft plane shape; soft reopen event shapes; session-share uniqueness rule | design + unit fixtures |
| **holdout** | delivery already on `dev` rollback; multi-commit merge backout; Codex multi-thread true conflict | freeze after candidate; **do not use to design** |
| **regression** | existing `tests/jj-dispatch-contract.test.mjs` reopen/block; plane-self-check synthetic session; acceptor-tag integrity FAIL (negative); path B safety (no force-push) | must stay green |

Group keys: delivery_id, host_id, handle_kind, feature (readme-pnpm vs acceptor-tag), time window 2026-07-30/31.

## 3. Objective scorecard (optimize in order)

1. **Evidence integrity** — reopen always writes events + revision++; never silent status flip  
2. **Mode S operability** — live soft plane can reopen via **one** library/API path  
3. **Safety** — do not allow two **active** BOUND writes/sessions to collide under Codex thread model  
4. **Replayability** — unit fixture, no live `/portfolio` dependency  
5. **Efficiency** — cut Agent ad-hoc normalize scripts and user “why can’t you reopen” loops  
6. **Time** — secondary; path B wall already ~minutes  

## 4. Candidate portfolio → **one primary knife**

| ID | Name | Layer | Recommendation |
| --- | --- | --- | --- |
| **R-soft-reopen** | Session-aware uniqueness + reopen on Mode S | `dispatchControlPlane` + skill + tests | **THIS ITERATION** |
| R4-prep | `rollback-prep` git suggestion package | optional module | next |
| R-ralph-supersede | COMPLETED run → new run supersedes doc/API | ralph | later |
| R-result-hygiene | task result.md superseded banner | skill only | tiny follow-up |
| R-normalize-soft | full soft→strict normalizer before any mutation | heavier | only if R-soft-reopen insufficient |

### Primary candidate: **R-soft-reopen** (bounded)

#### 4.1 Design choice (pick **A+B**, not C alone)

| Option | Description | Pros | Cons |
| --- | --- | --- | --- |
| **A. Validator session-share rule** | Allow same `thread_id` on multiple intents when `host_id=grok-build` **and** `handle_kind=session` **and** intent status ∈ {`BOUND`,`COMPLETED`,`BLOCKED`} with identical host/handle | Unblocks validate + reopenTarget | Must not apply to Codex `thread` |
| **B. `normalizeModeSPlane` (narrow)** | Map soft `DONE`→responsibility `COMPLETED`; BOUND+result → intent COMPLETED with contract result; materialize checkpoint/last_result for VERIFIED | Makes live goldens API-ready | Scope creep if full schema repair |
| C. Soft-only reopen without validate | Document ad-hoc only | Fast | Never replayable; rejects R2 investment |

**Decision:** Implement **A** (required) + **minimal B** only for fields reopen needs (intent close + responsibility status + checkpoint audit). Do **not** invent full schema migration for reviews/approval in v1 if reopen can run after A+B-min.

#### 4.2 Concrete semantics (A)

```text
thread_id uniqueness:
  default: global unique (today) — keeps Codex / exclusive thread safety

  exception (Mode S share):
    host_id === 'grok-build'
    AND handle_kind === 'session'
    AND existing intent with same thread_id has same host_id + handle_kind
    AND neither side is PENDING_THREAD with a different synthetic placeholder
    → allow share

  still forbidden:
    two PENDING_THREAD/BOUND write intents same worktree (unchanged)
    two active writers same project (unchanged)
    codex-app / handle_kind=thread sharing (unchanged)
```

#### 4.3 Concrete semantics (B-min, inside reopen or preflight helper)

Before attempt++:

1. For target responsibilities with status `DONE` → `COMPLETED`  
2. For target’s current-attempt intents in `BOUND` with terminal soft result → `COMPLETED` + contract-shaped `result` (produced_commit / review PASS)  
3. If VERIFIED missing checkpoint/last_result but soft `commit`/`reviewed_commit` present → materialize for audit  
4. Then call existing `reopenTarget` (strict)

Optional export: `prepareModeSReopen(plane, { deliveryId, projectId })` → plane ready for `reopenTarget`.

#### 4.4 Skill / agent surface

Update `.codex/skills/jj-dispatch/references/rollback.md`:

```text
Mode S reopen:
  1) prepareModeSReopen (or reopenTarget which auto-prepares when soft fields detected)
  2) reopenTarget per target
  3) plane-self-check
  4) Git path B only after user confirm — list task-scoped sha; default not execute
```

Agent hard rule: **禁止** 手改 `status: VERIFIED→PENDING` 无 event。

#### 4.5 Events

Keep `TARGET_REOPENED`. Optional extend payload:

```json
{ "prepared_mode_s": true, "shared_session_id": "019f…" }
```

`GIT_ROLLBACK_REVERT` remains **Agent-written evidence** after user-confirmed git (R4 may formalize later).

#### 4.6 Bounded file list (expected PR)

| Path | Change |
| --- | --- |
| `src/dispatchControlPlane.mjs` | session-share uniqueness; optional `prepareModeSReopen`; wire into `reopenTarget` preflight |
| `tests/jj-dispatch-contract.test.mjs` | fixture: shared session COMPLETED intents validate; reopen succeeds |
| `tests/fixtures/…` or inline fixture | soft Mode S mini-plane (anonymized from readme-pnpm) |
| `.codex/skills/jj-dispatch/references/rollback.md` | Mode S reopen steps |
| `.codex/skills/jj-dispatch/SKILL.md` | one-line pointer |
| `docs/evaluations/2026-07-31-readme-pnpm-rollback.md` | candidate status → implementing/promoted |
| `CHANGELOG.md` | Unreleased |

**Out of PR:** live `/portfolio/dispatch-control` mutation; business git; ralph un-archive; R4 CLI.

## 5. Replay protocol (cheap → expensive)

| Step | Command / action | Pass criteria |
| --- | --- | --- |
| 1 | `node --test tests/jj-dispatch-contract.test.mjs tests/plane-self-check.test.mjs` | green |
| 2 | `npm run harness:check` | green |
| 3 | New tests: soft shared session validate + reopen | green |
| 4 | Existing reopen/block/rework tests | no regression |
| 5 | Holdout (manual checklist only this iter) | Codex multi-thread still unique; no two writers same project |
| 6 | Full `npm run verify` before promote | green |

Skip build/browser: not in acceptance of this candidate.

## 6. Risk and confounds

| Risk | Mitigation |
| --- | --- |
| Accidental share of Codex threads | Gate on `grok-build` + `handle_kind=session` only |
| Soft COMPLETED without real commit | reopen still requires prior success statuses; VERIFIED path still has self-check for terminal claims |
| prepare mutates history silently | only normalize current attempt soft terminal; always revision++ only on reopen event path |
| Overfitting to readme-pnpm | fixture uses generic soft fields; acceptor-tag remains negative for false VERIFIED without commit |

## 7. Human review checklist (promotion gate)

- [ ] No auto git  
- [ ] Codex thread uniqueness preserved  
- [ ] Mode S shared session validates  
- [ ] `reopenTarget` works on soft fixture without hand script  
- [ ] plane-self-check still flags synthetic session + VERIFIED without commit  
- [ ] Rollback path B still documented as **user-confirmed** git  

## 8. Implementation phases (if approved)

| Phase | Work | Done when |
| --- | --- | --- |
| **P0** | Validator A + tests | soft shared session plane `validateControlPlane.ok` |
| **P1** | prepare/B-min + reopenTarget integration + tests | soft VERIFIED → PREVIEW_ONLY via API |
| **P2** | skill rollback.md Mode S section | Agent can follow without ad-hoc script |
| **P3** | `npm run verify` + CHANGELOG + eval status promoted | ship |

Estimate: **one focused PR**, ~small–medium; no schema version bump if only validation rule + helper.

## 9. Deferred roadmap (ordered, not this PR)

1. **R4** `rollbackPrep({ commits[] })` → suggested `git revert` list; fixture = readme-pnpm three shas  
2. **R-result-hygiene** skill: on reopen append “SUPERSEDED” banner to task `result.md`  
3. **R-ralph-supersede** when source ledger must track product rollback  
4. **Holdout episode**: feature already merged to `dev`  
5. Optional: `integrity_grade` on delivery (C5 backlog) — separate upgrade window  

## 10. Rollback of the optimization itself

If promoted code misbehaves:

```text
git revert <promo-sha>
npm run verify
jj install-skill --platform all --force   # if skill text shipped
```

Live control planes written with new events remain valid (forward-compatible fields).

## 11. Decision request

| Question | Recommended answer |
| --- | --- |
| Approve **R-soft-reopen** P0–P2 as next implementation? | **Yes** |
| Include auto-normalize inside `reopenTarget` vs separate `prepareModeSReopen`? | **Auto inside reopenTarget** + export prepare for Agent dry-run |
| Touch live `/portfolio` plane? | **No** (tests only) |

---

## Appendix — scorecard expectation after promote

| Dimension | Before | After (target) |
| --- | --- | --- |
| Mode S reopen mechanical | B (ad-hoc) | **A** (API+test) |
| Evidence integrity | A | A |
| Codex safety | A | A (gated) |
| Agent hand-edit risk | high | low |
| Time for rollback control plane | ~minutes + script | seconds API |
