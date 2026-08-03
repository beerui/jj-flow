# Artifact routing

`jj-same` recovers port requirements and chooses targets; formal documents and state MUST be written and registered on canonical paths. Real business projects allow and require task-generated assets under `.workflow/`, but MUST use public routes split by type and task ID. Do not create a private `.workflow/jj-same/` directory that other tools cannot discover.

Recommended project asset roots:

```text
.workflow/
  tasks/<TASK-ID>/{task.md,plan.md,progress.md,result.md}
  handoffs/<HOF-ID>/{handoff.json,source.md,risks.md,targets/}
  dispatch/<DELIVERY-ID>/{control-plane.json,preview.md,approval.md,recommendations.md}
  reports/<TASK-ID>/{summary.md,comparison.md}
  receipts/<TASK-ID>/{analysis.json,verification.json,review.json,recovery.json}
```

The `jj-flow` repo itself still follows Harness rules and does not treat `.workflow` as this repository’s fact source; the directory constraints above apply to real business projects and acceptance projects.

## Artifact ownership

- Single-target standard discovery without handoff snapshot: the target repo owns the full `ANL -> BLP -> ANL -> PLN -> EXC/VRF -> REV` chain.
- Fast implement: when the user explicitly authorizes implement and stable source commit/diff, final requirement sources, and target call chain are enough for `EXECUTION_READY`, reuse existing canonical refs; if missing, first store a minimal source-cited ledger in `ANL-TARGET`, then generate the narrowest `PLN -> EXC/VRF -> REV`. Do not rebuild full source analysis or blueprint only for formal completeness before coding; fill handoff-required canonical artifacts before `HANDOFF_READY`.
- Prepare-handoff mode: the source artifact owner repo holds shared `ANL-SOURCE`, `BLP/REQ`, and handoff snapshot; one or more targets each own only their `ANL-TARGET -> PLN -> EXC/VRF -> REV`.
- Multi-target port: prepare-handoff mode defaults to one shared source analysis, blueprint, and snapshot in the source artifact owner repo; without prepare-handoff, first designate an authorized owner repo. Each target repo generates only its own target analysis, plan, execution, and review artifacts.
- Family delivery plan: with a `$jj-dispatch` control project, the control manifest holds cross-project tasks, threads, status, decisions, and artifact refs; the lead project holds only its own canonical `PLN`. Without control, the lead project continues to hold one cross-project coordination `PLN`. Neither replaces each target’s own implement `PLN`.
- Migration handoff snapshot: held by the shared source-analysis owner repo at `ANL-SOURCE/requirement-baseline/{snapshot_id}/handoff-snapshot.yaml`; multiple targets reuse via direct path, not by copying into target repos.
- When the current repo is not the target, clarify the shared blueprint owner repo before starting. Other targets consume that blueprint via `@file` or direct path; do not copy an untraceable requirements set.
- Each repo’s artifact IDs resolve only in that repo’s `.workflow/state.json`; across repos, do not assume `blueprint:BLP-*` or `analyze:ANL-*` auto-resolve.

## Canonical routes

| Stage | Action | Canonical artifact | State registration |
|---|---|---|---|
| Init | Initialize workflow directories | `.workflow/project.md`, `.workflow/state.json` | init artifact |
| Continuous-sync contract | Write arch spec | Source outgoing index and target incoming contracts, each in that repo’s `.workflow/specs/architecture-constraints.md` | spec entry |
| Source evidence summary | Source analysis | `.workflow/.csv-wave/{YYYYMMDD}-analyze-{slug}/context.md`, `analysis.md`, `conclusions.json`, `context-package.json` | `ANL-*` |
| Migration handoff snapshot | `jj-same` generates inside source analysis artifact | `ANL-SOURCE/requirement-baseline/{snapshot_id}/handoff-snapshot.yaml`, refs only to `BLP/REQ` and source evidence | with owning `ANL-*`; `context-package.json` only registers `handoff_ref` |
| Formal requirements | Formal requirement generation | On standard discovery or before handoff complete: `.workflow/blueprint/BLP-{slug}-{date}/product-brief.md`, `requirements/REQ-*.md`, `readiness-report.md`, and other needed canonical files | `BLP-*` |
| Family coordination plan | `$jj-dispatch` control manifest; without control, write implement plan | Control project stores only coordination state and artifact refs; without control, lead project `.workflow/scratch/{YYYYMMDD}-plan-P{N}-{slug}/plan.json` | control `delivery_id`; without control, `PLN-*` |
| Target project review | Target analysis (from blueprint path) | Target repo’s own analyze session: `context.md`, `analysis.md`, `conclusions.json`, `context-package.json` | target repo `ANL-*` |
| Implement plan | Implement plan (from analyze) | `.workflow/scratch/{YYYYMMDD}-plan-P{N}-{slug}/plan.json`, `.task/TASK-*.json` | `PLN-*` |
| Implement and verify | Implement execution | execute session; plan dir `.summaries/TASK-*-summary.md` and `verification.json` | `EXC-*`, `VRF-*` |
| Code review | quality-review | that skill’s `context.md` and `review.json` | `REV-*` |

If the target repo has no `.workflow/`, initialize workflow directories first. Do not hand-forge artifact IDs or bypass protocol to register completion in `.workflow/state.json`.

## Content mapping

### Source analysis `ANL-SOURCE`

Record in source analysis:

- Current user requirements, session correction order, branch baseline, commits and diffs.
- Real behavior, reverted behavior, accidental implementation, and unrelated changes.
- Draft `MUST`, `TARGET-ONLY`, `DO-NOT-PORT`, `UNRESOLVED`.
- Session, commit, file, method, API, and verification evidence for each conclusion.

Source analysis is evidence interpretation, not the final product spec.

### Migration handoff snapshot

- After the source has a stable commit, formal `BLP/REQ`, and explicit unresolved items, generate an immutable snapshot inside the owning `ANL-SOURCE`.
- Snapshot stores only canonical refs, Source Inventory, source HEAD, coverage, supersession, verification status, and target differences still to verify — not requirement body text.
- When a target hits a valid `handoff_ref`, consume shared source analysis and blueprint directly; generate only its own `ANL-TARGET` and downstream artifacts.
- On source change, generate a successor snapshot under the same canonical ownership; targets MUST NOT modify or copy the shared snapshot.

### Formal requirements `BLP`

- Write `MUST` and confirmed `TARGET-ONLY` as `REQ-*.md` with RFC 2119 keywords, acceptance criteria, and source traceability.
- Write non-functional constraints as `NFR-*.md`.
- Put `DO-NOT-PORT` in product-brief out-of-scope and readiness traceability.
- Keep `UNRESOLVED`; do not rewrite inference as confirmed requirements.
- If readiness is `Fail` and impacts `MUST`, stop; if `Review`, pass caveats to target analysis and plan. Do not block fast implement solely because review/UAT evidence is still pending.

### Target analysis `ANL-TARGET`

Each target records independently:

- Mapping of `REQ-*` to target entrypoints, APIs, state, permissions, legacy, and tests.
- `DIRECT`, `ADAPT`, `EXTEND`, `BLOCKED`, `N/A` decisions.
- Minimal file scope, razor exclusions, existing-feature protection, and verification strategy.
- `Locked / Free / Deferred` decisions and Go/No-Go.

Do not generate an executable plan when `MUST`-impacting `Deferred`, `BLOCKED`, or unresolved conflicts exist.

## State boundaries

- Session status stores only orchestration steps, goals, and completion evidence — not requirement body text.
- `.workflow/specs/` stores only delivery-validated, reusable stable rules. Continuous-sync `sync_key`, scope, and exclusion policy may enter arch spec; changing commit cursors and one-shot migration requirements/analysis/plans MUST NOT.
- Raw extraction reports should be referenced or absorbed by the source analyze session; do not create a separate long-lived directory.
- `context-package.json` stores only `snapshot_id`, `handoff_ref`, and necessary summaries; Source Inventory entities exist only under `ANL-SOURCE/requirement-baseline/`.
- Standard discovery and snapshot reuse should be traceable before implement as `PLN-* -> ANL-TARGET -> BLP-* -> ANL-SOURCE`. Fast implement should at least trace `PLN-* -> ANL-TARGET -> current requirements/docs/session + stable source diff`, and fill canonical refs before `HANDOFF_READY`; after implement, continue registering `EXC-*`, `VRF-*`, and `REV-*`.

Maintain family coordination `PLN` from the lead project’s analysis phase. Standard discovery registers formal `PLN` after requirement readiness; fast implement only requires target `EXECUTION_READY` — incomplete family plan MUST NOT block the current target’s independent implement `PLN`. Future projects keep high-level placeholders only and MUST NOT be casually modified by the current task.

For continuous sync, read [continuous-sync.md](continuous-sync.md). Subsequent bug fixes that do not change the product contract reuse the original `BLP-*`; product-behavior changes generate a new blueprint delta. Sync checkpoints reverse from the latest successful `VRF-* / REV-*` artifact chain; do not advance early because analysis finished or the source branch moved.
