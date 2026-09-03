# Tiny single-point example

Use when the user already gave `@file:line` or a clear single-field / single-interaction change.  
Intensity: `init --intensity tiny` (or user says “tiny / single-point quick”).

`tiny` is the intensity tier only; it does **not** switch the gate path. Add `--lite` explicitly when the user says 「小改 / 顺手修」 (BRIEF→DELIVER→CLOSE, see [phases.md](phases.md) § Gate set); otherwise a tiny run still walks the five gates.

## Scope

- Change exactly 1 business file (plus at most 1 reference implementation file, read-only)
- No long background; no whole-repo search
- **No intent block** unless the user passed `--intent`. `artifact_refs.intent` stays `null`
- After every DELIVER verification, record `deliver-attempt --improved true|false` (prevents empty loops)

## task_plan.md (example)

```markdown
# RALPH-zero-interest-url-20260723

## 目标

## 分析
### 必须项
- Agreement link uses backend field zeroInterestBizAgreementUrl  
  evidence_class: behavior-local
### 范围外
- Do not change other agreement download logic
### 存疑事项
### 未解决

## 计划
### 当前
- TASK-1 → REQ-001: update order-operation-link.vue agreement URL binding
### 已落地
### 已取代

## 验收
### 当前
| 项 | must_id | evidence_class | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| Uses zeroInterestBizAgreementUrl | REQ-001 | behavior-local | PASS | order-operation-link.vue + rg |
### 已落地
```

## progress.md (append)

```markdown
- 2026-07-23T00:00:00Z init … intensity: tiny
- 2026-07-23T00:00:00Z DELIVER: update URL binding
- 2026-07-23T00:01:00Z VERIFY: rg confirms old static address removed
- 2026-07-23T00:01:01Z deliver-attempt improved=true signal=rg_clean
```

`diff-only` / `behavior-local` only — do **not** add field-lifecycle or dual-path checks for tiny presentational work. Full rules: [must-evidence.md](must-evidence.md).

## Resume / policy change (even tiny)

Same `run_id`. Do not overwrite `task_plan.md` down to only the new bullets.

```markdown
## 计划
### 当前
- TASK-2 → REQ-001: tip 8px → 6px
### 已落地
- TASK-1 → REQ-001: bind zeroInterestBizAgreementUrl  (still true)
### 已取代
```

Move the previous `### 当前` block to 已落地 or 已取代 **before** writing the new 当前. Legacy English `## Tasks` without Current is Current — rename it, then move. File shape: [artifact-layout.md](artifact-layout.md).

## Closeout

1. After gates.accept=PASS → `finalize` (map-merge + in-place archive; same run may continue)
2. Merge capability: modules include changed files; keywords include business terms
3. No commit/push unless asked; Git closeout via `$jj-end` (orthogonal to run lifetime)
4. After archive, same requirement changes → `resume` same `run_id`; do not default to new init
