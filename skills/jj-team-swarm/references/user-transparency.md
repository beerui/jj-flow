# User transparency protocol (jj-team-swarm)

Mandatory user-visible communication for adversarial ACO runs.

## 1. Pre-flight (before Phase 2 init)

```text
[swarm] 即将使用对抗蚁群 (jj-team-swarm)
[swarm] 为什么用：<concrete reason for THIS search>
[swarm] 当前在做：Phase 1 配置完成，准备 aco init · n_ants=N max_iter=K
[swarm] 预计用时：<range>
[swarm] 宿主：<claude|codex|grok|…> · 模式：full|workflow-degraded|python-only-degraded
[swarm] Session：TAS-…（创建后填写）
[swarm] 不会：推进 ralph / dispatch checkpoint
```

### Why-swarm catalog (pick one primary)

| Code | When |
| --- | --- |
| `search-space` | Large option/node space needs iterative exploration |
| `multi-hypothesis` | Several candidate solutions must compete |
| `adversarial-score` | Need prosecutor/defender scoring, not single self_score |
| `path-optimize` | Path/order/sequence optimization over a graph |
| `resume-swarm` | Continuing an existing TAS session |

If none fit → **do not** start swarm.

### Time heuristics (order-of-magnitude)

| Scale | Rough active wall time |
| --- | --- |
| N=3, K=2, full parallel | 15–40 min |
| N=5, K=5, full | 45–120+ min |
| workflow-degraded / serial ants | ×1.5–3 vs full |

Always label as estimate. Confirm when `N*K ≥ 12` or host is degraded.

## 2. Live status (each iteration)

```text
[swarm] 进度 iter k/K · 模块：explore|score|update|converge
[swarm] 当前在做：…
[swarm] 已用时：约 … · best 分：…（若有）· 下一步：…
```

Write the same into `wisdom/status.md` when that file is used.

## 3. Completion

```text
[swarm] 为什么用过：…
[swarm] 当前在做：完成
[swarm] 用时：elapsed（预估 …）
[swarm] 产物：…/artifacts/best-solution.md
[swarm] gates：未修改 ralph/dispatch
```
