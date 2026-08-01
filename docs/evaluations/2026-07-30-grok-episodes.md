# Grok Episodes — 2026-07-30

> Status: evaluation + promotion record (partial)
>
> Skill: `jj-evaluated`
>
> Scope: ingest today's Grok session exports under `~/.grok/sessions`, business
> artifacts, and jj-flow commits; label episodes; promote one bounded preflight.
>
> Non-goals: do not rewrite historical business run ledgers; do not advance
> control-plane checkpoints from chat text alone.

## 1. Scope and authorities

| Field | Value |
| --- | --- |
| Evaluation date | 2026-07-30 |
| Host | Grok Build (session export evidence present) |
| Session root | `~/.grok\sessions\` |
| Control-plane authority | jj-flow git on `main` |
| Business evidence authority | Per-repo `.workflow/**` + git at evaluation time |

Role / workspace map observed today:

| Role / kind | Path | Session thread(s) |
| --- | --- | --- |
| jj-flow harness | `D:\daji-docs\jj-flow` | `019fb1e2-8301-73a2-b0a8-b9b617dbbbb0` (+ review sub `019fb20b-…`) |
| 项目C | `/portfolio/project-c` | `019fb1a6-…` (sale-draft), `019fb193-…` (card-account) |
| 项目D | `/portfolio/project-d` | `019fad89-2fb5-7cf2-9383-a8410adebd17` |
| SDK | `/portfolio/project-sdk` | `019fb0b6-d824-77a3-8a94-77a142a68d7d` |
| 项目A (apbacent) | `/portfolio/project-a` | `019faca3-…` (cross-day) |
| DX only | project-c | `019fb0bf-…`, `019fb0d7-…` |

Do not rename 项目A/项目B/项目C. SDK is outside the three product roles.

## 2. Episode inventory

Hashes are SHA-256 prefixes of the listed artifact at evaluation time (when local).

### EP-20260730-H1 — jj-flow harness (ralph context / review / end / inventory)

| Field | Value |
| --- | --- |
| episode_id | `EP-20260730-H1` |
| thread_id | `019fb1e2-8301-73a2-b0a8-b9b617dbbbb0` |
| repo | `D:\daji-docs\jj-flow` |
| role | control harness (not 项目A/项目B/项目C) |
| wall_span | ~78 min (summary `created_at`→`updated_at`, UTC) |
| active_duration | unknown |
| clock_quality | derived |
| timestamp_provenance | thread (`summary.json`) |
| outcome | shipped `0.1.1-beta.34` |
| git | `f547935` host-first review; `35a878c` beta.34 release |
| tags | `user_correction`, `tool_unavailable` (no ralph run BLOCKED review), `branch_correction` (jj-end order) |
| key facts | Skill SSOT = `.codex/skills`; host-neutral wording; host-first `/jj-review`; jj-end fetch-before-push; `skill-inventory.json` |

### EP-20260730-B1 — sale-draft pay channel (ralph COMPLETED)

| Field | Value |
| --- | --- |
| episode_id | `EP-20260730-B1` |
| thread_id | `019fb1a6-677d-7850-b8ac-3f674feb6d5d` |
| run_id | `RALPH-sale-draft-pay-channel-20260730` |
| repo / role | `project-c` / 项目C |
| status | COMPLETED / ARCHIVE |
| wall_span | ~86 min (thread summary) |
| artifact_write_span | short (ledger files share minute-level mtimes) |
| clock_quality | derived / inconsistent (thread vs artifact) |
| timestamp_provenance | thread + artifact |
| outcome | gates PASS; `CAP-sale-draft-pay-channel` on business-map |
| review | `REV-1` PASS (`9a44484c97f7`); findings WAIVED info |
| tags | `handoff_reuse` (knowledge_refs), `target_native_adaptation`, `evidence_gap` (REV lacks `source`/`host_review`) |
| key refs | `run.json#64a5eba52b30`, `REV-1.json#9a44484c97f7` |

map-find after archive: 2 capabilities in-repo. Portfolio KB (`/portfolio/knowledge`) ~1135 entries / active 99 — candidate must not act as checkpoint.

### EP-20260730-B2 — card-account button color + tooling

| Field | Value |
| --- | --- |
| episode_id | `EP-20260730-B2` |
| thread_id | `019fb193-bf28-7e70-bc37-4f701429652d` |
| repo / role | `project-c` / 项目C |
| wall_span | ~19 min |
| tags | `validation_wait` (husky: postcss-scss + postcss@5) |
| outcome | UI color change + postcss@8 tooling fix; jj-end closeout |

### EP-20260730-S1 — aliyun tracker same → 项目D (branch mis-attach)

| Field | Value |
| --- | --- |
| episode_id | `EP-20260730-S1` |
| thread_id | `019fad89-2fb5-7cf2-9383-a8410adebd17` |
| repo / role | `project-d` / 项目D |
| handoff | `HOF-aliyun-tracker-20260729-2` (`consume.md#98c329910554`) |
| task | `TASK-aliyun-tracker-port-pc-sp` (`task.md#41d2e5866190`) |
| wall_span | multi-hour / multi-day (created 7/29 → updated 7/30) |
| clock_quality | inconsistent |
| timestamp_provenance | thread |
| tags | `branch_correction`, `user_correction`, `handoff_reuse`, `validation_wait` |
| failure mode | tracker landed on `feat/pc-0731-dev` instead of `feat/pc-aliyun-tracker-recognize`; recovered via cherry-pick + revert on wrong branch |
| staging lesson | merge decision uses **tree tip**, not historical commits; after revert, tip has no tracker files |

### EP-20260730-K1 — SDK postinstall Node 14 host break

| Field | Value |
| --- | --- |
| episode_id | `EP-20260730-K1` |
| thread_id | `019fb0b6-d824-77a3-8a94-77a142a68d7d` |
| repo | `project-sdk` |
| wall_span | ~7 min |
| tags | `regression`, `validation_wait` |
| root cause | `postinstall` used `node:fs` (`node:` needs ≥14.18); consumer CI Node 14.17.6 |
| fix | `0.6.3` uses `require('fs'/'path')`; non-blocking try/catch |

### Apbacent (not primary)

| Id | Note |
| --- | --- |
| DX multi-project | `g` aliases under `~/.grok/shell/projects.*` |
| Workflow vs jj-flow | Grok Rhai workflow ≠ jj-flow durable state machine |
| EP-pa history bug | `019faca3-…` master-based fix + same intent; cross-day |

## 3. Baseline scorecard

| Episode | Outcome | Integrity | Dominant signal |
| --- | --- | --- | --- |
| H1 harness | success release | high | user-driven skill correction loop |
| B1 sale-draft | success archive | medium-high | full ralph + weak review provenance |
| B2 buttons | success | medium | tooling debt on closeout |
| S1 tracker same | recovered | medium | **branch purpose mismatch** |
| K1 SDK | success patch | high after fix | consumer min-runtime gate missing |

## 4. Behavior tags and causal hypotheses

### H-branch — Wrong branch absorbs correct demand

- Evidence: S1 user correction “应该是 feat/pc-aliyun-tracker-recognize”.
- Mechanism: agent treated “current checkout + 开始迁移” as sufficient without matching **task purpose** to **branch purpose**.
- Cost: cherry-pick, dual-end revert narrative, staging anxiety.
- Optimization: hard preflight (see candidate v5).

### H-tooling — Closeout blocked by unrelated stack drift

- Evidence: B2 postcss Class extends undefined.
- Optimization: document / pin pre-commit peer ranges; not a skill logic bug.

### H-runtime — Package scripts must honor oldest consumer Node

- Evidence: K1 Node 14.17.6 vs `node:` prefix.
- Optimization: static smoke forbidding `node:` in install scripts + regression case.

### H-provenance — Business REV still missing host source fields

- Evidence: B1 `REV-1` PASS without `source` / `host_review` (schema optional; adapter not yet used on that run).
- Note: harness already supports fields in beta.34; next business reviews should fill them.

## 5. Dataset split (frozen for this window)

| Split | Episodes | Purpose |
| --- | --- | --- |
| optimization/search | H1 (jj-end history), S1, B2 tooling | branch preflight + closeout friction |
| holdout | B1 sale-draft COMPLETED | protect successful single-repo ralph with knowledge_refs |
| regression | K1 postinstall Node14; H1 “no ralph run → review BLOCKED”; historical EP-05 family LITE from 2026-07-29 | freeze known good / known bad |

Leakage: do not redesign branch preflight by reading holdout B1 review text beyond “do not block clean same-branch UI ralph”.

## 6. Candidate v5 — branch purpose preflight

### Proposal (implemented in skill text)

Before `jj-same` creates branches or writes business code (and before `jj-end` treats closeout as success on a multi-purpose repo), agent must answer five checks:

1. **Task purpose** — one line (e.g. aliyun tracker port).
2. **Current branch purpose** — does name/plan match task? (release train vs feature line).
3. **Intended work branch** — create/switch if mismatch; never silently ride wrong train.
4. **Integration target** — `dev` / `staging` / none this turn.
5. **Staging tip content** — if user asks “will X ship?”, inspect **tip tree**, not history alone.

Golden answers (S1-shaped) live in:

- `.codex/skills/jj-same/references/branch-purpose-preflight.md`
- §7 below

### Expected mechanism

Moves `branch_correction` from mid/late rework to intake (~30s confirmation).

### Bounded surface

- `.codex/skills/jj-same/SKILL.md` + new reference
- light `jj-end` note for work≠task purpose
- this evaluation doc
- optional SDK static test in `project-sdk` (K1 regression)

### Rollback

Revert skill/reference paragraphs; reinstall skills; remove evaluation promotion note.

## 7. Golden regression — branch Q&A (EP-S1)

| # | Question | Expected agent behavior | Pass if |
| --- | --- | --- | --- |
| G1 | 当前分支是 `feat/pc-0731-dev`，任务是「埋点接入」。可否直接开干？ | 否。声明 train 分支与 tracker 线不匹配；询问/创建 `feat/pc-aliyun-tracker-*` | 不写业务代码直到分支用途对齐 |
| G2 | 用户说「开始迁移项目D」且 checkout 在发布需求分支。下一步？ | 打印 branch purpose table；BLOCKED or switch/create correct branch first | 无 silent port onto release train |
| G3 | 埋点误合进 `0731-dev` 后如何挽回？ | cherry-pick 到正确 feat 线；在错误线 `revert`（禁止 force-push 共享历史） | 两线 tip 正确 |
| G4 | 「合 `0731-dev` 到 staging 会带埋点吗？」 | 查 tip 树文件/`package.json`/entry；有 revert 则树无埋点 | 不拿「历史上出现过 commit」当会发布 |
| G5 | 领头分支 `feat/pa-aliyun-tracker` 派生项目C分支？ | 只替换 role → `feat/pc-aliyun-tracker`（或地图 role token）；不挂到无关 `0731-dev` | 派生 diff 仅 role |

## 8. Data-collection actions (status)

| Action | Status |
| --- | --- |
| Export/label E1/E2/E4 (H1/B1/S1) | **done** (this file + session ids) |
| Five golden branch Q&A | **done** (§7 + skill reference) |
| Node 14 postinstall smoke | **done** in `project-sdk` static test (see repo) |
| Business REV fill `source`/`host_review` | **policy**: next `/jj-review` on business repos must set fields (adapter already supports); B1 historical REV not rewritten |
| Branch purpose preflight skill | **promoted** to `.codex/skills` SSOT |

## 9. Promotion status

| Item | Status |
| --- | --- |
| Evaluation report | recorded (this file) |
| Candidate v5 skill | promoted to SSOT `jj-same` + note in `jj-end` |
| Candidate v5 code | none (skill/procedure only) |
| SDK K1 regression test | added in tracker repo |
| Holdout B1 | not mutated |
| Human rollback | git revert skill commits + `jj install-skill --platform all --force` |

## 10. Next action

1. After skill install, dry-run `/jj-same` on a dirty wrong-branch scenario should stop at preflight.
2. Next business `/jj-review` should produce REV with `source=host_builtin` when Grok review runs.
3. Keep B1 in holdout; score new branch preflight only against S1 golden table.
