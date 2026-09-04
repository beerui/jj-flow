# Integration with jj-same / jj-dispatch

## Do not mix identities

| Identity | Owner | Example |
| --- | --- | --- |
| `task-*` run_id | **ralph** (business repo `.workflow/ralph/`) | `task-login-reminder` |
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
4. Target implementation **is** a full Ralph run in **that target repo** (`.workflow/ralph/task-<slug>/`). same ports protocol into it; it does not replace Ralph
5. If source repo `intensity=strict`, handoff must / do_not_port / targets should be more complete (easier for ProjectB·ProjectC reuse)
6. After archive, same-run edits: should **commit + re-accept/handoff**, refresh `source_head` / must; handoff ready tracks accept + git stability

## jj-dispatch

When a control plane is needed, write a dispatch recommendation. dispatch owns `DEL-*` / `task_key` in `~/.jj-flow`.
Each lead/target still needs its **own** Ralph `task-<slug>` (same slug derived from the delivery).
Example: `$jj-dispatch PREVIEW delivery=DEL-password targets=ProjectA,ProjectB,ProjectC`
→ control index `TASK-DEL-password` **and** `ProjectB/.workflow/ralph/task-password/` + `ProjectC/.workflow/ralph/task-password/`. Do not implement inside the control TASK dir.

## Optional: jj-team-coordinate (session multi-role engine)

Use when **DELIVER / analysis needs dynamic multi-role parallelism** — not for tiny single-point edits.

| Item | Rule |
| --- | --- |
| Skill | `jj-team-coordinate` (`/jj-team-coordinate` · `$jj-team-coordinate`; legacy speech “Team Coordinate”) |
| Session | `.workflow/.team/TC-<slug>-<date>/` — **≠** `task-*` |
| Facts | Team artifacts may be **cited** in ralph progress / evidence paths |
| Gates | Team completion **does not** set ACCEPT PASS or flip `run.json` gates |
| Dispatch | Never creates `DEL-*` / durable `task_key` |
| Design | `docs/design-docs/jj-team-coordinate.md` |
| User notice | **Only when nested here**: `开启 team 模式，开始任务XXX 约 10-25分钟`；direct invoke needs no notice |
| Codex | Degraded path OK (`tasks.json` + file bus); see `references/host-codex.md` |

Typical nesting: ralph PLAN ready → one-line nested notice → team multi-module DELIVER → cite `artifacts/` into evidence → ACCEPT as usual.

## Optional: jj-team-lifecycle (fixed SDLC session engine)

Use when **ANALYZE / PLAN / DELIVER needs a fixed engineering document chain** (brief → PRD → architecture → epics and/or plan → impl → test → review) with CHECKPOINT consistency — not for dynamic multi-role without fixed docs (that is `jj-team-coordinate`).

| Item | Rule |
| --- | --- |
| Skill | `jj-team-lifecycle` (`/jj-team-lifecycle` · `$jj-team-lifecycle`; legacy `team-lifecycle-v4`) |
| Session | `.workflow/.team/TLV4-<slug>-<date>/` — **≠** `TC-*` / `TAS-*` / `task-*` |
| Pipelines | `spec-only` · `impl-only` · `full-lifecycle` |
| Facts | Cite `spec/` / `plan/` / `artifacts/` into ralph progress / evidence paths |
| Gates | Lifecycle completion **does not** set ACCEPT PASS or flip `run.json` gates |
| Dispatch | Never creates `DEL-*` / durable `task_key` |
| Design | `docs/design-docs/jj-team-lifecycle.md` |
| User notice | **Only when nested here**: `开启 lifecycle 模式，开始任务XXX 约 20-45分钟`；direct invoke needs no notice |
| Codex | Degraded path OK (`tasks.json` + file bus); see skill `references/host-codex.md` |

Typical nesting: ralph PLAN needs formal specs → one-line nested notice → lifecycle `spec-only` → cite `spec/` into plan → DELIVER / ACCEPT as usual.

## Optional: jj-team-swarm (adversarial ACO search)

Use when **PLAN / design needs multi-hypothesis search or adversarial scoring** — not for ordinary multi-role implement (that is `jj-team-coordinate`) or fixed SDLC docs (that is `jj-team-lifecycle`).

| Item | Rule |
| --- | --- |
| Skill | `jj-team-swarm` (`/jj-team-swarm` · `$jj-team-swarm`; legacy TAS / 蚁群) |
| Session | `.workflow/.team/TAS-<slug>-<date>/` — **≠** `TC-*` / `TLV4-*` / `task-*` |
| Facts | Cite `artifacts/best-solution.md` into plan/evidence only |
| Gates | Swarm **does not** set ACCEPT PASS |
| User notice | Nested only: `开启 swarm 模式，开始任务XXX 约 15-40分钟` |
| Hosts | Python `aco.py` everywhere; Claude Workflow full; Codex/Grok agent-module fallback |
| Design | `docs/design-docs/jj-team-swarm.md` |

## Optional: CodeGraph (host code-intelligence MCP)

Orthogonal accelerator for **code location**, not a workflow identity or gate.

| Item | Rule |
| --- | --- |
| Product | [CodeGraph](https://github.com/colbymchenry/codegraph) — host MCP + per-repo `.codegraph/` index |
| When useful | Large-repo ANALYZE, blast radius, call paths (see [phases.md](phases.md) § Code exploration) |
| When skip | `tiny` single-file, known paths, run/git mechanics |
| Gates | Graph output **does not** flip `run.json` gates or replace verify evidence |
| Availability | Prefer if MCP + index present; else Read/Grep; never hard-require install |

## Boundaries

| Capability | Owner |
| --- | --- |
| Single-repo loop + run.handoff + intensity | jj-ralph |
| Cross-repo migration | jj-same |
| Schedule identity `DEL-*` / task_key | jj-dispatch |
| Session multi-role execution (`TC-*`) | jj-team-coordinate (optional) |
| Fixed SDLC session engine (`TLV4-*`) | jj-team-lifecycle (optional) |
| Adversarial ACO search (`TAS-*`) | jj-team-swarm (optional) |
| Semantic code graph (host MCP) | CodeGraph (optional; not shipped by jj-flow) |
