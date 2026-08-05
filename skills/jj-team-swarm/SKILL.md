---
name: jj-team-swarm
description: "Adversarial ACO search engine for jj-flow (vendored team-adversarial-swarm). Python aco.py + explore/score/converge/synthesize under .workflow/.team/TAS-*. Nested under ralph/review/dispatch: one-line notice only; direct invoke has no mandatory banner. Codex/Grok agent-module fallback. Does NOT advance ralph/dispatch checkpoints. Triggers: /jj-team-swarm, $jj-team-swarm, team-adversarial-swarm, ACO, 蚁群, 对抗搜索."
---

# jj-team-swarm

> **Layer:** search / optimization execution engine (not a delivery control path)  
> **Upstream:** Claude `team-adversarial-swarm` (ACO + adversarial modules)  
> **Product id:** `jj-team-swarm`  
> **Session prefix:** `TAS` → `.workflow/.team/TAS-<slug>-<date>/`  
> **Sibling:** multi-role pipeline → [`jj-team-coordinate`](../jj-team-coordinate/SKILL.md)  
> **Design:** [docs/design-docs/jj-team-swarm.md](../../docs/design-docs/jj-team-swarm.md)

ACO (ant colony) + modular explore/score/converge/synthesize with adversarial decision patterns.  
Python owns pheromone math; coordinator owns the outer loop and user communication.

## User notice (nested jj-flow only)

- **Direct** `/jj-team-swarm` / `$jj-team-swarm`: **no** mandatory multi-line banner; just run.
- **Nested** under **jj-ralph / jj-review / jj-dispatch**: **one sentence** before heavy work, e.g.  
  `[swarm] 嵌套于 ralph PLAN：多假设搜索 · 约 15–40 分钟 · 不推进 gate`

Full rules: [references/user-transparency.md](references/user-transparency.md).  
High cost when nested (`n_ants×max_iter≥9`, adversarial, or degraded) → optional one-line confirm.  
Default template is conservative (3×3, non-adversarial scoring).

## jj-flow hard boundaries

| MUST | MUST NOT |
| --- | --- |
| Session under `.workflow/.team/TAS-*` | Advance ralph/dispatch checkpoints |
| Cite `best-solution.md` into parent skills only as evidence paths | Pretend swarm done == ACCEPT PASS |
| Degrade when Workflow/Python missing (document mode) | Hard-fail only because Claude Workflow API is absent |
| When nested in ralph/review/dispatch: one-line notice | Spam multi-line [swarm] banners on direct use |

**When to use:** multi-hypothesis search, architecture/path choice, adversarial scoring of candidates.  
**When not to:** tiny single-point edits; pure multi-role implement (use **jj-team-coordinate**); multi-project schedule (**jj-dispatch**).

## Architecture

```text
SKILL.md (Coordinator)
  Phase 0: Resume TAS-* session
  Phase 1: swarm-config.json (+ one-line notice only if nested in ralph/review/dispatch)
  Phase 2: python aco.py --session … init
  Phase 3: for k in 1..K
    aco select → explore module → score module → aco update → converge module
  Phase 4: aco report → synthesize → artifacts/best-solution.md
```

### Module registry

| Module | Script | Returns |
| --- | --- | --- |
| Explore | `workflows/wf-swarm-explore.js` | `{ ant_results[] }` |
| Score | `workflows/wf-swarm-score.js` | `{ scores{}, calibration }` |
| Converge | `workflows/wf-swarm-converge.js` | `{ converged, reason, confidence }` |
| Synthesize | `workflows/wf-swarm-synthesize.js` | `{ report, caveats }` |

**full host (Claude Workflow):** `Workflow({ scriptPath, args })` as in upstream TAS.  
**workflow-degraded (Codex/Grok/…):** implement the same args→files→return contract with host agents — see [references/host-compatibility.md](references/host-compatibility.md). Do not require the JS Workflow runtime.

## Shared constants

| Constant | Value |
| --- | --- |
| Session prefix | `TAS` |
| Session path | `.workflow/.team/TAS-<slug>-<date>/` |
| ACO CLI | `scripts/aco.py` (`init` / `select` / `update` / `converged` / `report`) |
| Python deps | stdlib only (`pheromone.py`, `scoring.py` same dir) |
| Max ants / iters (default template) | see `specs/swarm-config-template.json` |

### skill_root / aco.py resolution

Never hardcode only `.claude/skills/team-adversarial-swarm`. Resolve `aco.py` in order:

1. Directory of this skill package → `scripts/aco.py`
2. Repo: `skills/jj-team-swarm/scripts/aco.py`
3. Host install: `~/.claude|/.codex|/.grok|/.qoder/skills/jj-team-swarm/scripts/aco.py`
4. Legacy: `…/team-adversarial-swarm/scripts/aco.py` (read-only fallback)

Same root for `workflows/wf-swarm-*.js`.

```bash
python "<skill_root>/scripts/aco.py" --session "<session_abs>" init
python "<skill_root>/scripts/aco.py" --session "<session_abs>" select --iter k
python "<skill_root>/scripts/aco.py" --session "<session_abs>" update --iter k
python "<skill_root>/scripts/aco.py" --session "<session_abs>" report
```

Prefer `python` then `python3`. Require Python ≥ 3.10 when possible; report clearly if missing.

## Specs

| Spec | Purpose |
| --- | --- |
| [specs/swarm-protocol.md](specs/swarm-protocol.md) | Coordinator ↔ Python ↔ modules |
| [specs/pheromone-schema.md](specs/pheromone-schema.md) | Pheromone matrix |
| [specs/ant-output-schema.md](specs/ant-output-schema.md) | Ant JSON contract |
| [specs/convergence-criteria.md](specs/convergence-criteria.md) | Dual-layer converge |
| [specs/swarm-config-template.json](specs/swarm-config-template.json) | Config template |

## Session directory

```text
.workflow/.team/TAS-<slug>-<date>/
├── swarm-config.json
├── pheromone/
├── trails/
├── scores/
├── artifacts/
│   ├── ant-<k>-<id>.json
│   └── best-solution.md
├── workflows/
│   ├── explore-<k>.json
│   ├── score-<k>.json
│   └── converge-<k>.json
└── best.json
```

Optional coordinator notes: `wisdom/status.md` (why/current/time snapshots).

**jj-flow product repo:** do not commit `.workflow/`.

## Coordinator flow

### Phase 0 — Resume

1. Glob `.workflow/.team/TAS-*/swarm-config.json`
2. Active + incomplete converge → resume at next iter (announce 当前在做 + 已用时)
3. Else Phase 1

### Phase 1 — Config

1. Parse intent; AskUserQuestion if search space / objective / scoring / budget unclear
2. Write `swarm-config.json` (from template + user answers)
3. Detect host mode: `full` | `workflow-degraded` | `python-only-degraded`
4. If **nested** in ralph/review/dispatch: one-line notice (+ confirm if high cost)
5. If user declines confirm → STOP without creating heavy session

### Phase 2 — ACO init

1. Create `TAS-<slug>-<date>` dirs
2. Resolve `aco.py`; run `init`
3. Optional brief: n_nodes/n_edges (no multi-line banner)

### Phase 3 — Iteration loop

For `k = 1..max_iterations`:

1. `aco.py select --iter k` → assignments
2. **Explore** module (Workflow or agent fallback) → write `workflows/explore-k.json` + ant artifacts
3. **Score** module → `scores/iter-k-scores.json`
4. `aco.py update --iter k`
5. **Converge** module → `workflows/converge-k.json`
6. Nested only: optional one progress line; direct use: no forced banner
7. If converged → break

On total ant failure or >50% hallucination demotion → pause + AskUserQuestion.

### Phase 4 — Synthesize

1. `aco.py report`
2. **Synthesize** module → `artifacts/best-solution.md`
3. Closeout: paths to best-solution (if nested: gate 未改)
4. AskUserQuestion: Archive / Keep / Export / Another round

## Module composition patterns

| Pattern | Flow |
| --- | --- |
| Full (default) | explore → score → update → converge → … → synthesize |
| Explore-only | explore → update(self_score) → converge → synthesize |
| Single-iter debug | explore(k=1) → score(k=1) |
| Score-only | score(existing ants) |
| Synthesize-only | synthesize(best, top_k) |

## Error handling

| Scenario | Resolution |
| --- | --- |
| `aco.py` not found | Resolve multi-path; then fail with install hint |
| Python missing / old | Try `python3`; report; do not fake scores |
| Workflow API missing | **workflow-degraded** agent modules (host-compatibility.md) |
| All ants fail | Pause; user retry / stop / retune config |
| Never converges | `max_iterations` hard stop |
| Hallucination cluster | Pause; adjust rubric |

## Host notes

| Host | Mode |
| --- | --- |
| Claude Code | Prefer full Workflow + Bash python |
| Codex | workflow-degraded + python ACO; serial ants OK; longer time in pre-flight |
| Grok / Qoder | Same as Codex unless native workflow maps cleanly |

Details: [references/host-compatibility.md](references/host-compatibility.md).

## Invocation

```text
Skill(skill="jj-team-swarm", args="…")
# Claude: /jj-team-swarm <search objective>
# Codex/Grok: $jj-team-swarm …
# Legacy speech: team-adversarial-swarm / 蚁群 / 对抗搜索
```
