---
name: jj-evaluated
description: Evaluate and improve jj-same, jj-ralph, and jj-dispatch workflows with real project conversation exports and versioned artifacts. Use for 承接、兑接、承载 workflow time-cost analysis, handoff reuse, rework diagnosis, trace-quality checks, and replay-backed generalization improvements through /jj-evaluated.
---

# jj-evaluated

## Purpose

Use this skill to turn real workflow episodes into an offline learning loop for the
workflow harness. Learn workflow strategy, skill text, handoff rules, and tool
orchestration; do not silently change model weights, business code, production
rules, or control-plane snapshots.

Keep the three project roles separate: 承接, 兑接, and 承载. Do not rename a role
to `handoff`, and do not infer a role from an old path or chat phrase without a
current repository/branch/commit fact.

## Operating procedure

1. **Establish scope and authorities.** Read `ARCHITECTURE.md`,
   `docs/design-docs/index.md`, and the relevant `jj-same`, `jj-ralph`, and
   `jj-dispatch` contracts. For each business repository, record the absolute
   path, role, branch, commit, worktree state, thread/export id, and evidence
   source. Treat this as a read-only investigation unless the user explicitly
   requests a change.
2. **Ingest real episodes.** Accept local Codex thread exports, user-provided
   JSON/JSONL exports, Git history, handoff snapshots, verification/review
   artifacts, ralph ledgers, and (in a business repository) `.workflow` files.
   The latter are input evidence for the business repository, not jj-flow's own
   control-plane truth. Never fabricate a trace, duration, score, or sample.
3. **Normalize and tag.** Convert raw records to the event contract in
   `references/episode-contract.md`. Preserve raw references and hashes. Tag
   behavior such as `handoff_reuse`, `redundant_analysis`, `branch_correction`,
   `stale_snapshot`, `validation_wait`, `user_correction`, and
   `target_native_adaptation`.
4. **Compute a cautious baseline.** Report active work, wall span, idle/wait,
   human attention, tool/build wait, handoff wait, rework, duplicate analysis,
   correction count, token/tool volume, and correctness evidence. Mark every
   duration with `clock_quality` and timestamp provenance. Never treat file mtime
   or a lone `run.json` duration as authoritative.
5. **Split before proposing.** Create disjoint `optimization/search`, `holdout`,
   and immutable `regression` sets. Group-split by thread, feature, snapshot,
   project role, time window, and (when available) person/model. Do not expose
   holdout outcomes to the proposer. See `references/optimization-loop.md`.
6. **Diagnose from raw traces.** Use scores to locate candidates, then inspect
   the complete relevant trace, tool calls, state updates, artifact diffs, and
   user corrections. State a causal hypothesis and identify confounded edits.
   Prefer one bounded change per iteration; isolate prompt, routing, handoff,
   and validation changes when possible.
7. **Replay cheaply, then expensively.** Run contract/schema checks and a small
   representative search subset first. Only after those pass, run the full
   search set, holdout, and regression suite. Skip build/lint/browser work when
   the acceptance contract does not require it, and record the reason. Preserve
   target-native adaptation rather than optimizing for identical diffs.
8. **Review and promote deliberately.** Require human review of reward hacking,
   leakage, token waste, unsafe autonomy, false time precision, and regressions.
   Promote only an approved candidate into a versioned skill, spec, or workflow
   recipe. Keep the candidate diff, scores, trace references, split manifest,
   reviewer decision, and rollback note. Do not auto-edit production projects.
9. **Archive and maintain.** Keep saturated or obsolete evals out of the active
   search set while retaining their history as regression evidence when useful.
   Record unresolved data-quality issues instead of smoothing them away.

## Time and quality rules

Use these distinct fields: `active_duration`, `wall_span`, `idle_duration`,
`handoff_wait`, `tool_wait`, `human_attention`, and `artifact_write_span`.
Attach `timestamp_provenance` (`thread`, `artifact`, `git`, `filesystem`, or
`user_export`) and `clock_quality` (`exact`, `derived`, `inconsistent`, or
`unknown`). Use intervals only for comparisons supported by their provenance.

Optimize in this order unless evidence says otherwise:

- reuse a fresh, successor-validated handoff instead of repeating source analysis;
- resolve role/path/branch/worktree facts before spending model or tool time;
- bound redundant subagent waves and wait for unavailable endpoints explicitly;
- defer expensive build/lint/browser checks until the acceptance contract needs them;
- reduce user-correction loops and stale-snapshot refreshes;
- make logs machine-readable and grep-friendly so diagnosis is cheaper.

Treat time as one signal in a multi-objective score. Protect requirement
correctness, evidence integrity, target-native adaptation, holdout generalization,
regression safety, and reviewer attention quality even when a faster candidate
has a better scalar score.

## Required report shape

Produce a concise report with:

- episode and role mapping with evidence references;
- baseline table and clock-quality caveats;
- failure/behavior tags and trace-backed causal hypotheses;
- optimization/holdout/regression split and leakage checks;
- one candidate change, its expected mechanism, and bounded diff;
- replay results, regressions, token/time trade-offs, and human decision;
- promotion status, rollback path, and next data-collection action.

Read the detailed contracts only when needed:

- [episode-contract.md](references/episode-contract.md) for normalized events,
  provenance, and time accounting;
- [optimization-loop.md](references/optimization-loop.md) for split, replay,
  review, and promotion rules;
- [source-evidence-map.md](references/source-evidence-map.md) for the currently
  observed 承接/兑接/承载 sample and its limitations.

## Boundaries

Do not use chat text, thread status, memory, or an unverified artifact to advance
jj-flow checkpoints. Do not send raw project conversations to an external service
without explicit authorization. Make redaction/hashing configurable, preserve
enough structure to diagnose failures, and label any inferred value as inferred.
