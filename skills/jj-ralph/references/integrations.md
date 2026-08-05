# Integration with jj-same / jj-dispatch

## Do not mix identities

| Identity | Owner | Example |
| --- | --- | --- |
| `RALPH-*` run_id | **ralph** (business repo `.workflow/ralph/`) | `RALPH-login-reminder-20260722` |
| `CAP-*` | ralph business-map | `CAP-login-reminder` |
| In-run `REQ-*` / `TASK-*` | ralph plan | `TASK-1` detects password_expired |
| `DEL-*` delivery | **dispatch** (control project / control-plane) | `DEL-password` |
| Dispatch `task_key` | dispatch | **Not** the same numbering as ralph `TASK-1` |

Business repos: ProjectA / ProjectB / ProjectC (frontend, ticket-recognition, etc.).  
The **control project** only records schedule state; do not use ralph there as a substitute for business implementation.

## jj-same

1. Ralph maintains a lean handoff in `run.handoff` (accept may write automatically)
2. User only says: 「交接到 项目B」 / 「交接到 项目B 项目C」 / “hand off to ProjectB ProjectC”
3. same reads the current session run/handoff then ports to targets; does not re-do source analysis
4. Target implementation is **not** written under `.workflow/ralph/`
5. If source repo `intensity=strict`, handoff must / do_not_port / targets should be more complete (easier for ProjectB·ProjectC reuse)
6. After archive, same-run edits: should **commit + re-accept/handoff**, refresh `source_head` / must; handoff ready tracks accept + git stability

## jj-dispatch

When a control plane is needed, write a dispatch recommendation. dispatch owns delivery / task_key.  
Example: `$jj-dispatch PREVIEW delivery=DEL-password targets=ProjectA,ProjectB,ProjectC`  
→ Separate line from `RALPH-login-reminder-20260722` in ProjectA; may cross-reference but do not write the wrong directory.

## Optional: jj-team-coordinate (session multi-role engine)

Use when **DELIVER / analysis needs dynamic multi-role parallelism** — not for tiny single-point edits.

| Item | Rule |
| --- | --- |
| Skill | `jj-team-coordinate` (`/jj-team-coordinate` · `$jj-team-coordinate`; legacy speech “Team Coordinate”) |
| Session | `.workflow/.team/TC-<slug>-<date>/` — **≠** `RALPH-*` |
| Facts | Team artifacts may be **cited** in ralph progress / evidence paths |
| Gates | Team completion **does not** set ACCEPT PASS or flip `run.json` gates |
| Dispatch | Never creates `DEL-*` / durable `task_key` |
| Design | `docs/design-docs/jj-team-coordinate.md` |
| User notice | Before team spawn: **为什么用 / 当前在做 / 预计用时**（skill `references/user-transparency.md`） |
| Codex | Degraded path OK (`tasks.json` + file bus); see `references/host-codex.md` |

Typical nesting: ralph PLAN ready → **tell user why/time** → spawn team for multi-module DELIVER → on team Archive, list `artifacts/` paths back into ralph deliver evidence → continue ACCEPT as usual.

## Optional: jj-team-swarm (adversarial ACO search)

Use when **PLAN / design needs multi-hypothesis search or adversarial scoring** — not for ordinary multi-role implement (that is `jj-team-coordinate`).

| Item | Rule |
| --- | --- |
| Skill | `jj-team-swarm` (`/jj-team-swarm` · `$jj-team-swarm`; legacy TAS / 蚁群) |
| Session | `.workflow/.team/TAS-<slug>-<date>/` — **≠** `TC-*` / `RALPH-*` |
| Facts | Cite `artifacts/best-solution.md` into plan/evidence only |
| Gates | Swarm **does not** set ACCEPT PASS |
| User notice | 为什么用 / 当前在做 / 用时 before iterations |
| Hosts | Python `aco.py` everywhere; Claude Workflow full; Codex/Grok agent-module fallback |
| Design | `docs/design-docs/jj-team-swarm.md` |

## Boundaries

| Capability | Owner |
| --- | --- |
| Single-repo loop + run.handoff + intensity | jj-ralph |
| Cross-repo migration | jj-same |
| Schedule identity `DEL-*` / task_key | jj-dispatch |
| Session multi-role execution (`TC-*`) | jj-team-coordinate (optional) |
| Adversarial ACO search (`TAS-*`) | jj-team-swarm (optional) |
