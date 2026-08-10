# Optimization and generalization loop

Use an offline, approval-gated loop. The proposer may inspect raw historical
source, scores, prompts, tool calls, outputs, state updates, and failure traces
through the filesystem, but it must not see holdout outcomes.

## Dataset roles

1. `optimization/search`: tagged cases used to diagnose and compare candidates.
2. `holdout`: group-disjoint cases with a matching distribution, revealed only
   for validation after a candidate is frozen.
3. `regression`: immutable cases that previously passed or protect a critical
   invariant. A regression is a release concern even if the aggregate score rises.

Group-split by `thread_id`, feature/requirement, handoff snapshot lineage,
project role, time window, and model/person when those fields are available.
Never split turns from one thread across search and holdout. Hash and record the
split manifest so it can be audited.

## One-iteration protocol

1. Capture the current skill/recipe/harness revision and run a baseline.
2. Aggregate scores by behavior category and cost dimension.
3. Inspect raw traces for the highest-value failure cluster.
4. Write one causal hypothesis, including likely confounders and a falsifier.
5. Propose one bounded change. A prompt and tool change may be coupled only when
   the hypothesis requires the composition; explain why.
6. Run cheap contract, schema, and static checks. Stop early on failure.
7. Replay a small stratified search sample, then the full search set.
8. Freeze the candidate and evaluate holdout plus immutable regression.
9. Ask a human to review leakage, reward hacking, token waste, unsafe authority,
   target-native adaptation, and reviewer attention cost.
10. 🔴 CHECKPOINT · Promote only after **explicit human approval**; otherwise archive the candidate and diagnosis (see SKILL.md red-light + failure table).

## Objective

Use a scorecard rather than a time-only objective:

| Dimension | Examples |
| --- | --- |
| Outcome | requirement correctness, acceptance, review outcome |
| Generalization | holdout by role/feature/time/model |
| Safety | regression, boundary, sandbox/worktree, authority checks |
| Efficiency | active tokens, duplicate analysis, wait, rework, tool calls |
| Usability | user corrections, handoff clarity, reviewer attention |

Report Pareto trade-offs when no candidate dominates. A faster candidate that
loses correctness or adaptation is not an improvement.

## Promotion record

Archive the baseline revision, candidate diff, split manifest, raw trace refs,
scores, regressions, clock-quality notes, reviewer identity/decision, and a
rollback target. Write approved changes only to a versioned skill, spec, or
workflow recipe. Do not mutate a business repository or jj-flow control-plane
manifest as a side effect of evaluation.

## Maintenance

Periodically retire saturated or irrelevant search cases, but retain their raw
history and keep critical passed cases in regression. A smaller, behavior-tagged
set is preferable to a large noisy set. Add a new case when a real user
correction, production failure, or previously unseen role/feature exposes a gap.
