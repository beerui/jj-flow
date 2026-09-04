# Tiny single-point example

Use when the user already gave `@file:line` or a clear single-field / single-interaction change.  
Intensity: `init --intensity tiny` (or user says “tiny / single-point quick”).

`tiny` is the intensity tier only; it does **not** drop gates. Conversational path never `--lite`. A tiny run still walks ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE, with the shortest Goal + file list.

## Scope

- Change exactly 1 business file (plus at most 1 reference implementation file, read-only)
- No long background; no whole-repo search
- **No `## 存疑`** unless the user passed `--intent`. `artifact_refs.intent` stays `null`
- After every DELIVER verification, record `deliver-attempt --improved true|false` (events.jsonl; prevents empty loops)

## task_plan.md (example)

```markdown
# task-zero-interest-url

> Status: ACCEPT / IN_PROGRESS

## Goal

Agreement link uses backend field `zeroInterestBizAgreementUrl`.

## 验收

1. [x] Uses `zeroInterestBizAgreementUrl` (`order-operation-link.vue` + rg)

## Steps

1. [x] `order-operation-link.vue` bind the backend URL
```

## progress.md (append)

```markdown
# task-zero-interest-url — progress

## 2026-07-23

- 绑定协议链接到 `zeroInterestBizAgreementUrl`
- VERIFY: rg 确认旧静态地址已去掉
```

`diff-only` / `behavior-local` only — do **not** add field-lifecycle or dual-path checks for tiny presentational work. Full rules: [must-evidence.md](must-evidence.md).

## Resume / policy change (even tiny)

Same `run_id`. Rewrite Steps/验收 to the new contract. Append a new date section. Do not grow 已落地 / REQ history in the live plan.

```markdown
## 2026-07-24 — tip 8px → 6px

- 同一文件再改 2px
```

File shape: [artifact-layout.md](artifact-layout.md).

## Closeout

1. After gates.accept=PASS → `finalize` (map-merge + in-place archive; same run may continue)
2. Merge capability: modules include changed files; keywords = short business terms only (not title/goal sentences)
3. No commit/push unless asked; Git closeout via `$jj-end` (orthogonal to run lifetime)
4. After archive, same requirement changes → `resume` same `run_id`; do not default to new init
