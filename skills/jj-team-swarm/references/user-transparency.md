# User notice protocol (jj-team-swarm)

## When to notify (and when not)

| Invocation | User-facing notice |
| --- | --- |
| **Normal / direct** — user ran `/jj-team-swarm` or `$jj-team-swarm` (or explicit 蚁群 / ACO / 对抗搜索) | **No** multi-line banner. Run search; optional short progress if useful. |
| **Nested in jj-flow delivery workflow** — parent is **jj-ralph**, **jj-review**, or **jj-dispatch** | **One sentence** before ACO init / first heavy iteration. |

Do **not** print long `[swarm] 为什么用 / 当前在做 / 预计用时 / 宿主…` blocks in normal use.

Detect nested mode from: parent skill context, `parent_skill=jj-ralph|jj-review|jj-dispatch`, `nested=true`, or clear in-workflow framing (e.g. ralph PLAN multi-hypothesis search).

## Nested notice (one line only)

Before Phase 2 init when nested:

```text
[swarm] 嵌套于 <ralph|review|dispatch>：<一句话搜索目标> · 约 <用时区间> · 不推进 gate
```

Examples:

```text
[swarm] 嵌套于 ralph PLAN：多假设方案搜索 · 约 15–40 分钟 · 不推进 gate
[swarm] 嵌套于 review：对抗评分候选 · 约 10–20 分钟 · 不推进 gate
```

Rules:

- **Exactly one line** (plus optional confirm if high cost).
- No host/mode/session dump unless asked.
- High cost (`n_ants × max_iterations ≥ 9`, `mode: adversarial`, or degraded) → one yes/no confirm only.

## Catalog gate (always, silent unless refusing)

Internal why-swarm code still required (`search-space` | `multi-hypothesis` | `adversarial-score` | `path-optimize` | `resume-swarm`).  
If none fit → do not start swarm (one short refusal).

## Live status

- **Direct use:** no forced multi-line status; normal iteration notes optional.
- **Nested:** at most one line per iteration, e.g. `[swarm] iter 2/3 explore · 约已用 12 分钟`.

## Completion

Point to `artifacts/best-solution.md`. If nested: 可引用进 plan/evidence · gate 未改. No multi-line closeout banner.
