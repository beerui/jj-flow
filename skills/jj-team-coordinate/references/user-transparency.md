# User transparency protocol (mandatory)

When this skill runs (or a parent skill chooses team mode), the coordinator **must** tell the user — in plain language — three things **before** spawning workers, and keep them updated.

## 1. Pre-flight notice (required before Phase 4 spawn)

Output a short block to the user (chat), then optionally ask confirm if cost/time is high:

```text
[team] 即将使用多角色 team 模式
[team] 为什么用：<one sentence — e.g. 跨 3 模块并行实现/多角色分析，单 agent 易丢上下文>
[team] 当前在做：<phase + step — e.g. Phase 1 任务分析完成，准备生成 3 个角色并派工>
[team] 预计用时：<range — e.g. 约 10–25 分钟 / N 角色 × 约 M 任务；不确定则写「视 worker 与验证而定，可能较长」>
[team] Session：TC-…（若已创建）· 宿主：<claude|codex|grok|qoder> · 模式：<full|degraded>
[team] 不会：推进 ralph gate / dispatch checkpoint
```

| Field | Rule |
| --- | --- |
| **为什么用** | 必须具体到本任务，禁止空话「更好协作」 |
| **当前在做** | 用 phase + 人类可读步骤；resume/check 时也要写 |
| **预计用时** | 给区间或数量级；可写「较慢 / token 较高」；禁止假装精确到秒 |
| **宿主模式** | Codex 等 degraded 时必须标明「兼容降级」 |

### Confirm threshold

If any of the following hold, **AskUserQuestion** (or plain yes/no) before Phase 4:

- Estimated roles ≥ 3 **or** tasks ≥ 5
- Host is **degraded** (no TeamCreate / no parallel workers / sequential only)
- User did not explicitly ask for team (parent skill auto-selected team)

Options: **继续 team** / **改单 agent** / **缩小范围**.

Tiny explicit user request (`$jj-team-coordinate` with a clear task) may skip confirm but **must still print** the pre-flight block.

## 2. Live status (during pipeline)

On every coordinator wake that advances work (`handleCallback`, Phase 4 stop, `resume`):

```text
[team] 进度 <done>/<total> · 当前：<role> 做 <task-id 或简述>
[team] 已用时：约 <elapsed> · 下一步：<next ready roles/tasks or wait>
```

On `check` / `status`: full graph + same three headings (为什么用 / 当前 / 用时).

Write the same summary into session `wisdom/status.md` (overwrite) so resume stays honest.

## 3. Why-team reasons (allowed catalog)

Pick **one primary** reason; add secondary if needed:

| Code | Use when |
| --- | --- |
| `parallel-modules` | Multiple modules/files with weak coupling |
| `multi-angle-analysis` | Need separate research/design/risk views |
| `role-isolation` | Implement vs review must not share one context |
| `capability-split` | Distinct skills (docs, code, tests) in one ask |
| `resume-team` | Continuing an existing `TC-*` session |

If none apply → **do not start team**; say so and stay single-agent / ralph.

## 4. Time heuristics (order-of-magnitude only)

| Scale | Rough wall time (chat active) |
| --- | --- |
| 1 role · 1–2 tasks | 5–15 min |
| 2–3 roles · few tasks | 10–30 min |
| 4–5 roles · many tasks / degraded sequential | 30–90+ min |

Always label as **estimate**. On degraded hosts, multiply mental budget (sequential subagents).

## 5. Completion reminder

Phase 5 report must include:

- Actual elapsed (if known) vs pre-flight estimate
- Final **当前在做：完成** + artifact paths
- Reminder: cite into ralph if nested; **gates not flipped**
