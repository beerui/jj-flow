---
name: jj-ralph
description: "Single-repo requirement loop ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE; artifacts under .workflow/ralph/{task_key}/ + business-map; handoff in run.handoff. Same requirement → same run_id, including resume after archive. Triggers: $jj-ralph, /jj-ralph, 单仓闭环, resume, 继续, 改坏了, 按审查改, 先不写代码. Cross-repo → jj-same; multi-project → jj-dispatch. Conversational path never uses --lite."
---

# jj-ralph

Complete one requirement in one business repo. Facts live in `.workflow/ralph/`, verification artifacts, and Git; chat and memory cannot advance checkpoints.
Same requirement → same `run_id`, including COMPLETED/ABANDONED. Archive remains resumable. Users describe the work; resolve ids yourself.

## Entry decision

| User intent / evidence | Action |
| --- | --- |
| 「继续 / 修完 / 按审查改 / 改坏了」 | Resume the session-linked run; rewrite the current contract when the approach changes. |
| 「审查修复 / review-fix」 | Resume the live feature task; findings are not a new requirement. |
| Same goal, including archived work | Resume; only a truly new confirmed requirement gets `init`. |
| `## 同需求提示`, including `host.thread_id` / review task binding | Resolve candidates; do not auto-merge or abandon. |
| Review-only request | `$jj-review` stays read-only; wait for the user to say 「按审查改」 before editing. |
| 「先不写代码 / 先理解需求 / 先分析」 | Write Goal + `## 存疑`, then STOP at ANALYZE. |
| Drop this work | `abandon`; later `resume` is allowed. |
| 「交接到…」 | Handoff via `$jj-same` only when ready; see integrations. |
| Multi-project scheduling | `$jj-dispatch` in the control project. |
| Map join / first-time knowledge bootstrap | `$jj-init`; home is `~/.jj-flow`. |
| Git closeout | `$jj-end` is Git-only, separate from Ralph archive. |

Conversational path never uses --lite: no `--lite`, `gate brief`, or `gate close`; all five ledger gates remain.

## Immediate actions

1. Known/session-linked run: `ralph_ops context --run-id <id>` directly (includes `completed/`); use its current Goal/Steps/验收, verification tail and next action. Unknown id: `.workflow/ralph/index.md`, then `jj ralph locate` (8 compact candidates; `--details` shows all). Confirm goal/scope in `task_plan.md`. `## 归档提示` is prompt-only: uncertain → **询问用户**, never auto-archive. Legacy runs and leftover closeouts → phases.
2. **Screenshot / `[Image]` / 「这里」:** read the image before searching; use visible UI and the session-linked run.
3. For confirmed work, use the context packet and edit; only if that phase needs clarification, read [phases.md](references/phases.md) at the relevant DELIVER/ACCEPT section. Do not load all references at startup. Write the short current contract, verify, and record each verification with `deliver-attempt`. Do not Read `business-map.json`; empty CAP hits are valid.
4. Follow the gate chain below. For `next=review` / `commit-scoped-review`, or a gate error requiring a passing review, follow `review-record` guidance in phases. `next` requests evidence; it does not authorize Git operations. Keep the review-only boundary above.
5. `next=finalize` → **MUST finalize**; `next=check` → inspect the resume/blocked state. Report run, acceptance evidence, archive/CAP result and any blocker briefly.

## Happy path

```text
locate → init | resume → short Goal/验收/Steps → edit → verify
→ deliver-attempt → gate deliver PASS (ralph_ops checks and folds analyze + plan)
→ gate accept PASS → MUST finalize
```

Use `ralph_ops` for conversational deliver PASS. Initial `next=gate analyze` / `gate plan` is not a separate happy-path step: the wrapper records both from the checked plan. Follow `next=review` / `commit-scoped-review` / `finalize` / `check` as above; review/commit remain conditional. Do not ask to continue after a successful step.
If the script is unavailable, `jj ralph gate --gate deliver` is **degraded unfold**: it does not fill analyze/plan; do not finalize through that fallback. Restore the wrapper first.

Before scoped review/acceptance, refresh `context --review --output .workflow/ralph/<id>/.state/review-context.json`. It separates task paths from other dirty files and flags stale/missing claims. Never hand-edit its file list. Pass `--context-file` to review-record / gate accept / finalize; stale code or contract requires a new packet and delta review. If the current approach replaced old scope, use explicit `scope --replace-in … --reason …`; history stays in events. `scope.out` never hides dirty files.

## Red checkpoints

- **CHECKPOINT (multiple candidates):** list candidate titles when the intended run is unclear.
- **CHECKPOINT (unconfirmed requirement):** **ask first**, record `## 存疑`, stay in the current phase; see phases before proceeding.
- **CHECKPOINT (analyze-hold):** 「先不写代码」 → Goal + 存疑 only, no gate PASS or implementation until 「开始做吧 / 我认可 / 继续改」.
- **CHECKPOINT (irreversible):** push / merge / release / delete data require existing explicit authorization; prepare the result before asking if authorization is missing.

## Conversational commands

| Command | Purpose |
| --- | --- |
| `init` | Start a new confirmed requirement. |
| `resume` | Continue the same requirement. |
| `locate` | Resolve candidate runs. |
| `status` | Read gates, blockers and next action. |
| `context` | Current contract, verification tail, phase hint and scope preflight; `--review` adds the review handoff. |
| `deliver-attempt` | Record real verification and progress. |
| `gate` | Record analyze / plan / deliver / accept / archive evidence. |
| `finalize` | Map merge, archive and reusable-rule promotion. |
| `abandon` | Stop this requirement without map merge. |
| `finding` | Record a real pitfall with a remedy and applicable scope. |
| `commit-prep` | Prepare the scoped Git change list. |

Resolve `ralph_ops.mjs`: repo skill scripts → current host's installed skill scripts (`$CODEX_HOME/skills/jj-ralph/scripts/` on Codex) → `jj ralph`. Full syntax and conditional operations: [ops.md](references/ops.md).

## Read when needed

- Execution, failures, review follow-ups and closeout: [phases.md](references/phases.md); MUST evidence: [must-evidence.md](references/must-evidence.md).
- Current plan and progress shapes: [artifact-layout.md](references/artifact-layout.md); single-point / 文案两字 example: [tiny-example.md](references/tiny-example.md).
- Handoff, host tools and knowledge: [integrations.md](references/integrations.md). Archive already promotes reusable rules; global knowledge is opt-in, outside this chain.
- Recovery: [rollback.md](references/rollback.md), [post-complete-continue.md](references/post-complete-continue.md).
