# User notice protocol (jj-team-coordinate)

## When to notify (and when not)

| Invocation | User-facing notice |
| --- | --- |
| **Normal / direct** — user ran `/jj-team-coordinate` or `$jj-team-coordinate` | **No** mandatory notice. Work normally. |
| **Nested in jj-flow delivery workflow** — parent is **jj-ralph**, **jj-review**, or **jj-dispatch** | **One sentence** before spawn (format below). |

Detect nested mode from: parent skill context, `parent_skill=jj-ralph|jj-review|jj-dispatch`, `nested=true`, or clear in-workflow framing.

## Nested notice (one sentence)

```text
开启 team 模式，开始任务<任务简述> 约 <用时区间>
```

Examples:

```text
开启 team 模式，开始任务跨模块并行实现 约 10-25分钟
开启 team 模式，开始任务多角色只读分析 约 5-15分钟
```

Rules:

- Exactly this shape: `开启 team 模式，开始任务… 约 …`
- `<任务简述>` = short task title/goal (not a multi-clause essay)
- `<用时区间>` = rough range, e.g. `10-25分钟`
- Optional confirm (yes/no) only if high cost; still no multi-line banner

## Catalog gate (always, silent unless refusing)

Primary why-team code still required internally. If none fit → do not start team (one short refusal is enough).

## Live / completion

No forced multi-line banners. Normal status graph on `check`. If nested and useful, one short progress line is optional.
