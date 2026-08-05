# User notice protocol (jj-team-swarm)

## When to notify (and when not)

| Invocation | User-facing notice |
| --- | --- |
| **Normal / direct** — user ran `/jj-team-swarm` or `$jj-team-swarm` | **No** mandatory notice. Run search. |
| **Nested in jj-flow delivery workflow** — parent is **jj-ralph**, **jj-review**, or **jj-dispatch** | **One sentence** before heavy work (format below). |

Detect nested mode from: parent skill context, `parent_skill=…`, `nested=true`, or clear in-workflow framing.

## Nested notice (one sentence)

```text
开启 swarm 模式，开始任务<任务简述> 约 <用时区间>
```

Examples:

```text
开启 swarm 模式，开始任务多假设方案搜索 约 15-40分钟
开启 swarm 模式，开始任务路径优选 约 10-20分钟
```

Rules:

- Exactly this shape: `开启 swarm 模式，开始任务… 约 …`
- `<任务简述>` = short search objective
- `<用时区间>` = rough range, e.g. `15-40分钟`
- Optional confirm only if high cost (`n_ants×max_iter≥9`, adversarial, degraded)

## Catalog gate (always, silent unless refusing)

Internal why-swarm code still required. If none fit → do not start swarm (one short refusal).

## Live / completion

No multi-line banners. Point to `best-solution.md` when done. Nested: optional short progress; no forced triple lines.
