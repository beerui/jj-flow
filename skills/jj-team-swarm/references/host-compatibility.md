# Host compatibility (jj-team-swarm)

Python ACO is host-agnostic. **Claude Workflow JS** is not. Degrade cleanly.

## Modes

| Mode | When | Behavior |
| --- | --- | --- |
| `full` | Claude Workflow + Bash + Python OK | `Workflow(scriptPath=…/wf-swarm-*.js, args)` |
| `workflow-degraded` | No Workflow runtime (typical Codex/Grok) | Agent modules with same I/O contracts |
| `python-only-degraded` | Python OK but LLM explore budget minimal | Prefer fewer ants/iters; still need LLM for ant content |

Store `host_mode` in `swarm-config.json` or session meta.

## skill_root

1. Installed skill package containing this file’s skill root  
2. `skills/jj-team-swarm` in repo  
3. `~/.claude|/.codex|/.grok|/.qoder/skills/jj-team-swarm`  
4. Legacy `team-adversarial-swarm` path (fallback only)

## Agent-module fallback (workflow-degraded)

For each module, read the corresponding `workflows/wf-swarm-*.js` for:

- `args` fields expected  
- return JSON shape  
- ant/score/converge/synthesize prompt intent  

Then:

1. **Explore:** spawn N agents (or serial) with ant prompts; write `artifacts/ant-<k>-<id>.json`; aggregate `workflows/explore-<k>.json`  
2. **Score:** for each ant, run prosecutor/defender/judge style votes (3 agents or one agent with 3 passes); write `scores/iter-<k>-scores.json` in the shape `aco.py` / `load_verified_scores` expects  
3. **Converge:** debate continue vs stop; write `workflows/converge-<k>.json` with `converged` boolean  
4. **Synthesize:** produce markdown → `artifacts/best-solution.md`

**Serial ants:** if parallel agents unavailable, run one ant after another and extend time estimate in user transparency.

## Python

```bash
python scripts/aco.py --session <abs-session> init|select|update|report
```

- Working directory free; pass **absolute** `--session`  
- `sys.path` inserts script dir for `pheromone` / `scoring`  
- Stdout = JSON only; exit 0/1/2 as documented in `specs/swarm-protocol.md`

If Python missing: stop with clear message (cannot invent pheromone math).

## Codex specifics

- Prefer `$jj-team-swarm` skill entry  
- No Team* required (unlike coordinate)  
- Use agent-module fallback; confirm user on long serial runs  
- `resume` language: continue from last incomplete iter by reading session files  

## Grok specifics

- If Grok Workflow (Rhai) is available, optional later mapping — **P0 does not require** it  
- Default: same agent-module fallback as Codex  
- Bash/python via host shell for `aco.py`

## What must still work on all hosts

- `TAS-*` directory layout  
- Valid `swarm-config.json`  
- User transparency protocol  
- Final `best-solution.md` path for parent skills to cite  
- No checkpoint writes
