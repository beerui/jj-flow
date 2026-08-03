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
