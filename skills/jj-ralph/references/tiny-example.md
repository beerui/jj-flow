# Tiny single-point example

Use when the user already gave `@file:line` or a clear single-field / single-interaction change.  
Intensity: `init --intensity tiny` (or user says “tiny / single-point quick”).

## Scope

- Change exactly 1 business file (plus at most 1 reference implementation file, read-only)
- No long background; no whole-repo search
- After every DELIVER verification, record `deliver-attempt --improved true|false` (prevents empty loops)

## analyze.md (example)

```markdown
# ANALYZE
run_id: RALPH-zero-interest-url-20260723

## MUST
- Agreement link uses backend field zeroInterestBizAgreementUrl  
  evidence_class: behavior-local

## OUT
- Do not change other agreement download logic

## Acceptance
- Rendered agreement URL comes from traderCorpOrderInfo.zeroInterestBizAgreementUrl  
  (class inherits behavior-local; tiny presentational → no write-then-read ceremony)
```

## plan.md (example)

```markdown
# PLAN
## Current
- TASK-1 → REQ-001: update order-operation-link.vue agreement URL binding

## Out of scope
- Backend field definition
```

## progress.md (append)

```markdown
- 2026-07-23T00:00:00Z init … intensity: tiny
- 2026-07-23T00:00:00Z DELIVER: update URL binding
- 2026-07-23T00:01:00Z VERIFY: rg confirms old static address removed
- 2026-07-23T00:01:01Z deliver-attempt improved=true signal=rg_clean
```

## acceptance.md (example)

```markdown
| item | must_id | evidence_class | result | evidence |
| --- | --- | --- | --- | --- |
| Uses zeroInterestBizAgreementUrl | REQ-001 | behavior-local | PASS | order-operation-link.vue + rg |
```

`diff-only` / `behavior-local` only — do **not** add field-lifecycle or dual-path checks for tiny presentational work. Full rules: [must-evidence.md](must-evidence.md).

## Resume / policy change (even tiny)

Same `run_id`. Do not overwrite `plan.md` / `acceptance.md` down to only the new bullets.

```markdown
# PLAN
## Current
- TASK-2 → REQ-001: tip 8px → 6px

## Landed
- TASK-1 → REQ-001: bind zeroInterestBizAgreementUrl  (still true)

## Superseded
- (none)
```

Move the previous `## Current` block to Landed or Superseded **before** writing the new Current. If an older live file still says `## Tasks`, that block is Current — rename it, then move. File shape: [artifact-layout.md](artifact-layout.md).

## Closeout

1. After gates.accept=PASS → `finalize` (map-merge + soft archive snapshot; same run may continue)
2. Merge capability: modules include changed files; keywords include business terms
3. No commit/push unless asked; Git closeout via `$jj-end` (orthogonal to run lifetime)
4. After archive, same requirement changes → `resume` same `run_id`; do not default to new init
