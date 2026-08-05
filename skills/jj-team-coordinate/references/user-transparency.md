# User notice protocol (jj-team-coordinate)

## When to notify (and when not)

| Invocation | User-facing notice |
| --- | --- |
| **Normal / direct** — user ran `/jj-team-coordinate` or `$jj-team-coordinate` (or explicit “Team Coordinate”) | **No** multi-line banner. Work normally; optional short progress only if useful. |
| **Nested in jj-flow delivery workflow** — parent is **jj-ralph**, **jj-review**, or **jj-dispatch** (or agent is inside those skills and spawns team) | **One sentence** before spawn (see below). |

Do **not** print long `[team] 为什么用 / 当前在做 / 预计用时 / 宿主…` blocks in normal use.

Detect nested mode from: parent skill context, prompt fields (`parent_skill=jj-ralph|jj-review|jj-dispatch`, `nested=true`), or clear in-workflow framing (e.g. active ralph DELIVER asking for multi-role team).

## Nested notice (one line only)

Before Phase 4 spawn when nested:

```text
[team] 嵌套于 <ralph|review|dispatch>：<一句话原因或阶段> · 约 <用时区间> · 不推进 gate
```

Examples:

```text
[team] 嵌套于 ralph DELIVER：跨模块并行实现 · 约 10–25 分钟 · 不推进 gate
[team] 嵌套于 review：多角度只读分析 · 约 5–15 分钟 · 不推进 gate
```

Rules:

- **Exactly one line** (plus optional confirm question if high cost).
- No host/mode/session dump unless the user asks.
- High cost (roles≥3 or tasks≥5 or degraded host or auto-selected without user naming team) → one yes/no confirm, still no multi-line banner.

## Catalog gate (always, silent unless refusing)

Still require a primary why-team code internally (`parallel-modules` | `multi-angle-analysis` | `role-isolation` | `capability-split` | `resume-team`).  
If none fit → do not start team (one short refusal is enough, e.g. “单点改动建议直接 ralph，不开 team”)。

## Live status

- **Direct use:** normal coordinator status / `check` graph; no forced `[team]` triple lines.
- **Nested:** at most one progress line when advancing, e.g. `[team] 进度 2/5 · implementer · 约已用 8 分钟`.

## Completion

List artifact paths as usual. If nested under ralph, one short note is enough: artifacts 可写入 evidence · gate 未改. No multi-line closeout banner.
