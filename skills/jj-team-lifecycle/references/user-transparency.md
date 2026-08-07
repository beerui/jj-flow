# User notice protocol (jj-team-lifecycle)

## When to notify (and when not)

| Invocation | User-facing notice |
| --- | --- |
| **Normal / direct** — user ran `/jj-team-lifecycle` or `$jj-team-lifecycle` | **No** mandatory notice. Work normally. |
| **Nested in jj-flow delivery workflow** — parent is **jj-ralph**, **jj-review**, or **jj-dispatch** | **One sentence** before spawn (format below). |

Detect nested mode from: parent skill context, `parent_skill=jj-ralph|jj-review|jj-dispatch`, `nested=true`, or clear in-workflow framing.

## Nested notice (one sentence)

```text
开启 lifecycle 模式，开始任务<任务简述> 约 <用时区间>
```

Examples:

```text
开启 lifecycle 模式，开始任务会员积分规格 约 20-40分钟
开启 lifecycle 模式，开始任务按 PRD 实现测审 约 25-45分钟
```

Rules:

- Exactly this shape: `开启 lifecycle 模式，开始任务… 约 …`
- `<任务简述>` = short task title/goal
- `<用时区间>` = rough range, e.g. `20-45分钟` (Codex serial often longer)
- Optional confirm (yes/no) only if high cost; still no multi-line banner

## Catalog gate (always, silent unless refusing)

Need a primary **why-lifecycle** reason internally, e.g.:

| Code | Meaning |
| --- | --- |
| `spec-document-chain` | Need brief/PRD/architecture/epics pipeline |
| `sdlc-gates` | Need CHECKPOINT consistency before next phase |
| `impl-from-spec` | Spec exists; need fixed plan→impl→test→review |

If none fit (tiny edit, pure search, dispatch-only) → **do not** start lifecycle (one short refusal is enough). Prefer **jj-team-coordinate** for dynamic multi-role without fixed docs; **jj-team-swarm** for multi-hypothesis search.

## Live / completion

No forced multi-line banners. Normal status graph on `check`. If nested and useful, one short progress line is optional.
