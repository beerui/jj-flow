# Ralph artifact layout

**Location: business repo** (ProjectA / ProjectB / ProjectC, etc.), not the control project.

```text
.workflow/ralph/RALPH-{kebab-slug}-{YYYYMMDD}/
  run.json                 # phase/gates + intensity/budget/stagnation/accept_layers + handoff
  analyze.md               # MUST + evidence_class; field lifecycle for write-then-read (see must-evidence.md)
  plan.md
  progress.md              # deliver-attempt / resume|abandon audit; optional supersedes|parent chain on truly new runs
  acceptance.md            # item + evidence_class + evidence (ban weak-evidence false green)
  reviews/REV-*.json       # optional; often required for strict judgment layer
  handoff/handoff.json     # optional mirror for same to read

.workflow/ralph/
  business-map.json        # CAP-* capability map (ABANDONED runs do not map-merge)
  archive/YYYY-MM-DD-{kebab-slug}/   # soft-archive snapshot (re-archive may use timestamp dirs; not a tombstone)
```

## Rules

1. Handoff source of truth: `run.handoff`
2. Do not write external `.workflow/handoffs/` or csv-wave HOF bulk packages
3. Naming follows naming config (`jj doctor` / `JJ_GLOBAL_CONFIG_DIR`; **never** hard-code host-local paths)
4. Scripts: `scripts/ralph_ops.mjs` (includes `deliver-attempt` / `accept-layer` / `resume` / `abandon`)
5. `RALPH-*` ≠ control-plane `DEL-*` / dispatch `task_key`
6. The active directory is always the authoritative run; under archive are historical snapshots. Continue after archive → **same** `RALPH-*` directory resume; do not open a new run by default

## Current contract vs history

Live `analyze.md` / `plan.md` / `acceptance.md` = **current contract** (what to do now). They are not a changelog.

| Layer | Where | Mutate how |
| --- | --- | --- |
| Current contract | live `analyze.md` / `plan.md` / `acceptance.md` | Update **Current**; do not delete prior rows |
| Audit | live `progress.md` | Append only |
| Finalize snapshot | `.workflow/ralph/archive/*` | Created on `finalize`; never delete old dirs |

`archive/` is only a finalize snapshot. A mid-DELIVER plan that never passed `finalize` is **not** in archive. If you replace live `plan.md` in place, that text is gone.

### File shape (plan / analyze / acceptance)

Keep this section order. `tiny` uses the same shape, shortest bullets.

```markdown
## Current
- only in-force MUST / TASK / acceptance items for this loop

## Landed
- still-true completed items (do not re-implement)
- optional pointer: `last_archive_path`

## Superseded
- previous Current that is no longer the approach
- keep the old TASK/MUST/item text; one line why + timestamp
```

On first write of a new run, `## Landed` / `## Superseded` may be omitted until something lands or is replaced.

### When the task / approach / MUST changes

Includes: resume after archive, user correction, mid-DELIVER policy swap. Same `run_id`.

1. **Before** replacing `## Current`: move that whole block into `## Landed` (still true) or `## Superseded` (approach abandoned). Then write the new `## Current`.
2. This move is mandatory even if the previous Current was never archived. Do not wait for `finalize` to preserve it.
3. `analyze.md`: add or tighten MUST; do not drop still-true REQ; mark abandoned MUST `SUPERSEDED`.
4. `plan.md`: new work only under `## Current`. Old TASKs stay in Landed or Superseded — never a file that contains only this loop’s TASKs after a prior loop existed.
5. `acceptance.md`: still-true rows stay `PASS` (evidence `既有` or archive pointer). Replaced rows `SUPERSEDED` + reason. New rows empty/FAIL until evidence. Do not wipe the table down to only the new round.
6. `progress.md`: append `failed_must` / `failed_evidence_class` / `over_claimed` when a correction retracts a claim.
7. Gate meaning of “rewrite plan/acceptance before accepting”: **Current** must match the code. It does not mean erase Landed/Superseded.
8. “Add REQ / TASK” = append under Current (and analyze MUST). Do not keep superseded TASKs in Current as if they were still to-do.
