---
name: jj-evaluated
description: Experimental offline evaluation skill ($jj-evaluated / skill id jj-evaluated). Evaluate and improve jj-same, jj-ralph, and jj-dispatch with real conversation exports and versioned artifacts. Use for jj-evaluated, $jj-evaluated, 离线评估, 复盘, 项目A/项目B/项目C time-cost analysis, handoff reuse, rework diagnosis, trace-quality checks, and replay-backed generalization. Platforms Codex/Qoder/Grok only — no Claude slash (do not invent one). Minimal runner scripts; full learning loop still expanding.
---

# jj-evaluated

> **Status:** experimental (MVP runner)  
> **Report root (business repos):** `.workflow/evaluated/`  
> **Honesty:** jj-flow is **not** control-plane truth for business evaluations. Chat / thread / memory cannot advance ralph or dispatch checkpoints.  
> **Platforms:** Codex / Qoder / Grok. **No** Claude Code command (do not invent `/jj-evaluated`).

Turn real workflow episodes into an **offline, approval-gated** learning loop for the harness (strategy, skill text, handoff rules, tool orchestration). Do **not** silently change model weights, business code, production rules, or control-plane snapshots.

**Happy path:** scope → ingest → normalize/validate → baseline → split → one candidate → cheap then expensive replay → human review → promote or archive.  
Pause only on 🔴 CHECKPOINT / 🛑 STOP. MVP steps 6–9 are mostly agent+human; steps 3/5 use CLI.

Keep roles distinct: `项目A`, `项目B`, `项目C` (do not translate/rename; do not rename a role to `handoff`; do not infer role from an old path/chat without current repo/branch/commit facts).

## Red-light blacklist (never do)

| # | Forbidden | Why |
|---|-----------|-----|
| 1 | Fabricate trace, duration, score, sample, or episode | Offline learning needs real evidence |
| 2 | Advance ralph/dispatch checkpoints via chat, thread, memory, or unverified artifact | Control plane ≠ evaluation report |
| 3 | Auto-edit production business repos or jj-flow control-plane manifests as eval side-effect | Promote only approved versioned skill/spec/recipe |
| 4 | Promote without human review / approval | Reward hacking & leakage risk |
| 5 | Expose holdout outcomes to the proposer before freeze | Dataset leakage |
| 6 | Treat file mtime or lone `run.json` duration as authoritative time | False precision |
| 7 | Send raw project conversations to an external service without explicit user auth | Privacy / leak |
| 8 | Invent a Claude `/jj-evaluated` slash (or other non-supported host entry) | Intentional platform matrix |
| 9 | Smooth away unresolved data-quality issues in the report | Hides eval rot |
| 10 | Optimize for identical diffs across targets | Prefer target-native adaptation |

## Scripts (minimal runner)

Pure Node ESM under `scripts/`. No external deps.

| Script | Role |
| --- | --- |
| `scripts/episode-validate.mjs` | Validate episode JSON/JSONL vs contract minimums |
| `scripts/evaluated_ops.mjs` | `validate`, `init-report`, `check-split` |

**Resolution:** (1) `skills/jj-evaluated/scripts/…` (2) installed skill `scripts/` (3) explicit `node skills/jj-evaluated/scripts/evaluated_ops.mjs …`

```text
node skills/jj-evaluated/scripts/episode-validate.mjs path/to/episode.json --json
node skills/jj-evaluated/scripts/evaluated_ops.mjs validate --episode path/to/episode.json
node skills/jj-evaluated/scripts/evaluated_ops.mjs init-report --out .workflow/evaluated/EP-demo --episode-id EP-demo
node skills/jj-evaluated/scripts/evaluated_ops.mjs check-split --manifest path/to/split.json
```

Exit codes (`episode-validate` / `validate`): `0` ok (warnings allowed), `1` validation errors, `2` usage/IO/parse.

## Inputs → outputs

| In | Out |
|----|-----|
| exports / git / handoff / verification / `.workflow` evidence | scoped role map + evidence refs |
| raw records | normalized episode (+ `validate` green) |
| validated episodes | baseline table with `clock_quality` / provenance |
| split manifest | `check-split` ok → search / holdout / regression |
| one bounded candidate + replays | report under `.workflow/evaluated/…` |
| human decision | promote (versioned asset) **or** archive + next data action |

Contracts: [episode-contract.md](references/episode-contract.md) · [optimization-loop.md](references/optimization-loop.md) · [source-evidence-map.md](references/source-evidence-map.md).

## 9 steps ↔ CLI

| Step | Agent work | CLI |
| ---: | --- | --- |
| 1 | Scope + authorities (design docs, role map, git facts) | optional `init-report` |
| 2 | Ingest real episodes | optional `init-report` |
| 3 | Normalize + tag | `validate` / `episode-validate.mjs` |
| 4 | Cautious baseline | fields enforced by contract/`validate` |
| 5 | Split before proposing | `check-split --manifest` |
| 6 | Diagnose; **one** bounded candidate | manual |
| 7 | Replay cheap → expensive | manual; notes in report |
| 8 | Review + promote | manual; **human** decision |
| 9 | Archive + next data-collection | report + archive notes |

`init-report` may run at step 1–2 to scaffold `.workflow/evaluated/<episode_id|timestamp>/report.md`.

## Operating procedure

1. **Establish scope and authorities** — **In:** user goal, repos. **Out:** path / role / branch / commit / worktree / export id / evidence source per repo.  
   Read `ARCHITECTURE.md`, `docs/design-docs/index.md`, and relevant `jj-same` / `jj-ralph` / `jj-dispatch` contracts. Read-only unless user explicitly requests a change.

   🔴 CHECKPOINT · 🛑 STOP — **no bindable repo/role/export and user demands a scored baseline**: do not invent facts. Report missing inputs; offer next data-collection only.

2. **Ingest real episodes** — **In:** Codex/Grok exports, user JSON/JSONL, git, handoff, verification/review, business-repo `.workflow` (evidence only, not jj-flow control-plane truth). **Out:** raw refs + hashes.  
   Never fabricate a trace, duration, score, or sample.

3. **Normalize and tag** — **In:** raw records. **Out:** episode events per [episode-contract.md](references/episode-contract.md).  
   Tag e.g. `handoff_reuse`, `redundant_analysis`, `branch_correction`, `stale_snapshot`, `validation_wait`, `user_correction`, `target_native_adaptation`.  
   Run `validate` / `episode-validate` before baseline-ready.

   🔴 CHECKPOINT · 🛑 STOP — **`validate` exit ≠ 0**: do not treat sample as baseline/search-ready. Fix contract fields or drop the sample; record errors in report.

4. **Compute a cautious baseline** — **In:** validated episode(s). **Out:** active work, wall span, idle/wait, human attention, tool/build wait, handoff wait, rework, duplicate analysis, corrections, token/tool volume, correctness evidence.  
   Every duration needs `clock_quality` + `timestamp_provenance`. Never treat file mtime or lone `run.json` duration as authoritative.

5. **Split before proposing** — **In:** case set. **Out:** disjoint `optimization/search`, `holdout`, immutable `regression`; group-split by thread, feature, snapshot, role, time, person/model when available.  
   Do not expose holdout outcomes to the proposer. Run `check-split`. See [optimization-loop.md](references/optimization-loop.md).

   🔴 CHECKPOINT · 🛑 STOP — **`check-split` fails or holdout leakage detected**: freeze proposer work; fix split manifest; do not score candidates on leaked holdout.

6. **Diagnose from raw traces** — **In:** scores + traces. **Out:** one causal hypothesis + confounds + **one** bounded candidate (prefer isolating prompt / routing / handoff / validation).  
   Inspect full relevant trace, tools, state, artifact diffs, user corrections — not scores alone.

7. **Replay cheaply, then expensively** — **In:** candidate. **Out:** suite notes.  
   Contract/schema + small search subset first; only then full search, holdout, regression. Skip build/lint/browser when acceptance does not require it; record why. Prefer target-native adaptation over identical diffs.

   🔴 CHECKPOINT · 🛑 STOP — **cheap replay fails**: do not run expensive suites; revise or archive candidate.

8. **Review and promote deliberately** — **In:** frozen candidate + scores + split + traces. **Out:** human decision + promotion record or reject archive.  
   Human reviews: reward hacking, leakage, token waste, unsafe autonomy, false time precision, regressions.  
   Promote only an **approved** candidate into a **versioned** skill, spec, or workflow recipe. Keep diff, scores, trace refs, split manifest, reviewer decision, rollback note.

   🔴 CHECKPOINT · 🛑 STOP — **before promote**: no explicit human approval → do not write production skill/spec; archive candidate + diagnosis only.  
   🛑 Never auto-edit production business projects or control-plane manifests as an eval side-effect.

9. **Archive and maintain** — retire saturated search cases; keep history for regression when useful; record unresolved data-quality issues (do not smooth away). State next data-collection action.

## Time and quality rules

Fields: `active_duration`, `wall_span`, `idle_duration`, `handoff_wait`, `tool_wait`, `human_attention`, `artifact_write_span`.  
`timestamp_provenance`: `thread` | `artifact` | `git` | `filesystem` | `user_export`.  
`clock_quality`: `exact` | `derived` | `inconsistent` | `unknown`.  
Compare intervals only when provenance supports it.

Optimize in this order unless evidence says otherwise:

- reuse a fresh, successor-validated handoff vs re-analyzing source;
- resolve role/path/branch/worktree before spending model/tool time;
- bound redundant subagent waves; wait for unavailable endpoints explicitly;
- defer expensive build/lint/browser until acceptance requires them;
- reduce user-correction loops and stale-snapshot refreshes;
- machine-readable, grep-friendly logs for cheaper diagnosis.

Time is one multi-objective signal. Protect correctness, evidence integrity, target-native adaptation, holdout generalization, regression safety, and reviewer attention — even if a faster candidate wins a scalar score.

## Failure and recovery

🔴 Rows are **STOP or bounded recover**. Happy path does not pause for confirmation between validate-green steps and report fill.

| Trigger | First fix | Still fails / must stop |
|--------|-----------|-------------------------|
| 🔴 no episode / evidence for scored baseline | List missing inputs; optional `init-report` shell only | STOP; never fabricate |
| 🔴 `validate` exit 1/2 | Fix contract fields or exclude sample | Not baseline-ready |
| clock sources disagree | `clock_quality: inconsistent`; keep both; explain | Do not pick mtime as truth |
| 🔴 split fail / holdout leakage | Repair manifest; re-`check-split` | No candidate scoring on leak |
| cheap replay fails | Revise candidate or archive | No expensive suite |
| 🔴 promote without human OK | Record decision = reject/pending | No production write |
| external send of raw chats | Require explicit user auth + redaction plan | STOP if no auth |
| script path missing | Try installed skill `scripts/` then explicit repo path | Report path; STOP mechanical assist |
| multi-objective conflict | Report Pareto; do not auto-pick time-only winner | Human chooses |

## Required report shape

Under `.workflow/evaluated/…` (or user `--out`), include:

- episode and role mapping with evidence references;
- baseline table and clock-quality caveats;
- failure/behavior tags and trace-backed causal hypotheses;
- optimization/holdout/regression split and leakage checks;
- one candidate, expected mechanism, bounded diff;
- replay results, regressions, token/time trade-offs, human decision;
- promotion status, rollback path, next data-collection action.

```text
node skills/jj-evaluated/scripts/evaluated_ops.mjs init-report --out .workflow/evaluated/<episode_id> --episode-id <episode_id>
```

## Examples

```text
$jj-evaluated
$jj-evaluated 对最近一次 项目A→项目B handoff 做时长与复用诊断
$jj-evaluated validate episode.json then baseline + check-split
$jj-evaluated 离线评估：禁止自动 promote，只出 report
```
