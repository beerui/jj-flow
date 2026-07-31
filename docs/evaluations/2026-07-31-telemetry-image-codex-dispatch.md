# Episode evaluation — Codex dispatch `DELIVERY-telemetry-image-request-20260731`

> Status: **evaluated** (Codex multi-thread dispatch gold-ish sample with soft schema debt)
>
> Skill: `jj-evaluated`
>
> Export package: `D:\dingding-download\20260731-102519-telemetry-image-dispatch\20260731-102519-telemetry-image-dispatch`
>
> Host: **Codex App** (`host_id=codex-app`, `handle_kind=thread`) — not Grok Mode S
>
> Non-goals: do not re-run business tests; do not mutate the export package; do not upload raw JSONL externally

## 1. Scope and authorities

| Field | Value |
| --- | --- |
| episode_id | `ep-20260731-telemetry-image-request-dispatch` |
| delivery_id | `DELIVERY-telemetry-image-request-20260731` |
| task_id | `TASK-DELIVERY-telemetry-image-request-20260731` |
| feature | 埋点 Image 请求移除 DOM 挂载 + 隔离同步异常 |
| export schema | `jj-evaluated-export/1.0` |
| generated_at | 2026-07-31T10:25:19+08:00 |
| control-plane | `control-plane/control-plane.json` rev **6**, status **VERIFIED** |
| plane SHA-256 prefix | `43E2E1C7E803` |
| coordinator thread | `019fb5c9-10b5-7450-83dd-47b1fb59149c` |

### Role mapping (from export manifest — Mac paths at capture)

| Role | project_id | path (at capture) | branch | head @ export |
| --- | --- | --- | --- | --- |
| 承接 lead/owner/origin | `cj-frontend-web` | `…/chengjie/frontend-web` | `feat/cj-0731-jmb` | `c2fc7d7e` (2 commits) |
| 兑接 target | `duijie-frontend-web` | `…/duijie/frontend-web` | `feat/dj-0731-jmb` | `bbb9c4bc` ADAPT PASS |
| 承载 target | `chengjie-broker-web` | `…/chengjie/broker-web` | `feat/cz-0731-jmb` | `c243db37` ADAPT PASS |

**Do not** rename roles to handoff. Export uses 承接/兑接/承载 correctly.

### Thread map (Codex 1:1)

| kind | project | thread_id | JSONL lines |
| --- | --- | --- | --- |
| coordinator | 承接 cwd | `019fb5c9-…` | 973 |
| development | 兑接 | `019fb5e9-…` | 174 |
| development | 承载 | `019fb5ea-…` | 162 |
| review | 兑接 | `019fb5f5-…` | 121 |
| review | 承载 | `019fb5f6-…` | 95 |

### Entry artifacts

| Ref | Role |
| --- | --- |
| `manifest.json` | episode index |
| `normalized-events.jsonl` | 9 events, contract-shaped |
| `control-plane/control-plane.json` | dispatch SSOT |
| `task/*` | standard task docs (**result.md stale** — see gaps) |
| `ralph/active|archive` | two source runs |
| `threads/raw/*.jsonl` | Codex raw (PII; local only) |
| `repositories/*/patches` | source + target patches |
| `helpers/*.mjs` | mechanical plane scripts |
| `SHA256SUMS` | integrity of package |

## 2. Timeline (normalized + clock)

| event_id | kind | phase | role | clock | labels |
| --- | --- | --- | --- | --- | --- |
| evt-source-image-dom-commit | commit | deliver | 承接 | 09:42:07+08 git exact | — |
| evt-source-error-isolation-commit | commit | deliver | 承接 | 09:53:35+08 git exact | `user_correction` |
| evt-dispatch-approval | user_request | dispatch | 承接 | 10:03:09+08 artifact | `role_mapping` `handoff_reuse` `control_root_fallback` |
| evt-duijie-development | subagent | sync | 兑接 | 10:03:34–10:10:34 thread exact | `handoff_reuse` `target_native_adaptation` `validation_wait` |
| evt-chengzai-development | subagent | sync | 承载 | 10:04:23–10:11:32 thread exact | same (+ subset only) |
| evt-review-approval | user_request | dispatch | 承接 | 10:15:42+08 | `human_approval` `review_gate` |
| evt-duijie-review | review | accept | 兑接 | 10:17:05–10:20:45 | `review_gate` |
| evt-chengzai-review | review | accept | 承载 | 10:17:47–10:20:48 | `review_gate` `evidence_gap` |
| evt-delivery-verified | artifact_write | archive | 承接 | 10:20:48+08 | `evidence_integrity` |

### Time accounting

| Metric | Value | provenance | quality |
| --- | --- | --- | --- |
| wall_span (first source commit → VERIFIED) | ~**38 min** (09:42→10:20 +08) | git + artifact | exact endpoints |
| active_seconds sum (4 target threads) | ~**1251 s** (~20.9 min) | thread JSONL `cost.active_seconds` | exact per thread; **parallel** so not wall |
| dj development active | 420.3 s | thread | exact |
| cz development active | 429.2 s | thread | exact |
| dj review active | 220.2 s | thread | exact |
| cz review active | 181.0 s | thread | exact |
| handoff_wait | not isolated | — | unknown |
| human_attention | ≥2 approvals (dev keys, review keys) + prior ralph correction | artifact | derived |
| tool_wait / tokens | null in export | — | unknown |
| browser / real network | **not run** | README + verification_claims | exact (absence) |
| filesystem mtime | not used | clock_policy | — |

Coordinator JSONL spans ~01:28–02:30 UTC (includes pre-dispatch Ralph/session work); do not treat full coordinator span as dispatch-only wall without filtering.

## 3. Baseline outcomes

| Layer | Result | Evidence |
| --- | --- | --- |
| Business outcome | 三端落地 Image 不上挂 DOM + 同步 try/catch；兑接含 MQTT 适配；承载仅通用 tracking | patches + distribution_prompt |
| Dispatch delivery | **VERIFIED** rev 6 | control-plane |
| Targets | both **VERIFIED** | commit == reviewed_commit |
| Development produced_commit | matches tip | intents COMPLETED |
| Independent Review | both **PASS**, findings=[] | reviews[] + threads |
| Remote push (export claim) | feature heads == remote_head | manifest |
| plane-self-check (C3 soft) | **ok / grade=ok** | no synthetic session; VERIFIED has commits |
| validateControlPlane (strict) | **FAIL 4** | lead_responsibilities empty; checkpoint/last_result recorded_at mismatch |
| C4 file attestation | **N/A as Grok rule** | Codex uses `sandbox_evidence_ref=codex-app:create_thread:…` |
| C5/C6 fields | **absent** | no integrity_grade / remote_closeout |
| task/result.md | **STALE** | still `EVIDENCE_READY` / “尚无 Review” while plane VERIFIED |
| Full Jest (承载) | 1 unrelated suite fail | README / review notes |
| Browser/network | not validated | evidence_gaps |

### Workspace model

Write intents: `environment=project-branch`, `worktree=project.path`, `sandbox_mode=workspace-write`.  
Review intents: `project-read`, `read-only`, `worktree=null`. Aligns with C1 defaults.

### Handoff

Reference uses dual handoff FRESH (image-request + failure-isolation). Targets declare ADAPT with `handoff_refs[]`. Strong `handoff_reuse` + `target_native_adaptation` sample.

## 4. Behavior tags and causal hypotheses

| Tag | Evidence | Hypothesis |
| --- | --- | --- |
| `role_mapping` | origin/owner/lead=承接; targets=兑接+承载 | Correct dynamic roles |
| `handoff_reuse` | FRESH dual handoff; targets did not re-analyze source | Correct same-protocol reuse |
| `user_correction` | second Ralph: try/catch after user ask | Source iteration before dispatch |
| `target_native_adaptation` | 兑接 MQTT+util tests; 承载 no MQTT module | ADAPT not blind DIRECT |
| `human_approval` | two PREVIEW_APPROVED waves (dev then review) | Staged gate; good |
| `review_gate` | independent read threads PASS after commit | Aligns with dispatch review model |
| `control_root_fallback` | explicit writable control under Codex visualizations | Host approval blocked default `~/.jj-flow` write |
| `validation_wait` | focused test/eslint/diff-check in threads | Expected for confidence |
| `evidence_gap` | no browser/real network; async delivery unproven; full Jest 1 fail | Correct honesty in export |
| `stale_snapshot` | task `result.md` not updated after VERIFIED | Task docs lag plane SSOT |
| `schema_debt` | lead_responsibilities=[]; recorded_at mismatch | Soft plane still VERIFIED for self-check |

**Primary causal story:**  
Ralph source (2 commits) → handoff FRESH → user-approved multi-target Codex dispatch with **parallel** target development threads → second approval for **independent** review threads → commit-aligned VERIFIED. Integrity soft-pass; strict validate still fails on lead-outside-targets bookkeeping and checkpoint timestamp consistency.

**Contrast with Grok readme-pnpm Mode S gold:**  
Here Codex uses **true multi-thread** (4 handles), not shared session. Stronger isolation/review story; weaker task-doc hygiene and strict schema completeness.

## 5. Split (search / holdout / regression)

| Split | Membership | Leakage rule |
| --- | --- | --- |
| **search** | control_root_fallback UX; task result stale after VERIFIED; lead_responsibilities empty when lead∉targets; checkpoint recorded_at drift | use for bounded skill/validator fixes |
| **holdout** | browser/network acceptance for telemetry; Mode W exclusive worktree | not used to tune this write-up |
| **regression** | Codex multi-thread ADAPT dispatch with dual handoff FRESH + independent Review PASS + produced_commit match; ADAPT subset-only (承载 no MQTT) | protect against “force DIRECT” or “skip review” |

Group keys: `episode_id`, host=codex-app, feature=telemetry-image, time=2026-07-31.

## 6. One candidate change (for jj-flow)

### Candidate **T-lead-outside-schema** (recommended next knife if optimizing for this sample)

| Field | Content |
| --- | --- |
| Problem | Strict `validateControlPlane` fails on this **successful** Codex VERIFIED plane: empty `lead_responsibilities` when lead is not a target + checkpoint/last_result `recorded_at` mismatch |
| Mechanism | (a) When lead∉targets and source work is ralph-only, allow empty lead_responsibilities **or** require a single `NOT_APPLICABLE`/`COMPLETED` lead planning stub; (b) relax or auto-align `recorded_at` equality between checkpoint and last_result when both timestamps are present and commit fields match |
| Bounded | `dispatchControlPlane.mjs` validation only + contract fixture cloned from this export (redact paths) |
| Expected | Real Codex VERIFIED exports pass strict validate without rewrites |
| Not in candidate | Change C4 Grok file rule for Codex; browser telemetry acceptance |

**Falsifier:** A fixture with lead∉targets and empty lead_resp that still violates other VERIFIED gates should still fail.

### Alternate (smaller, docs-only)

| ID | Content |
| --- | --- |
| T-task-result-sync | skill: when delivery → VERIFIED, Agent must refresh task `result.md` (status + review commits) |

## 7. Replay / checks run for this evaluation

| Check | Result |
| --- | --- |
| Export README / manifest consistency | PASS |
| normalized-events.jsonl vs README timeline | PASS (9 events) |
| plane-self-check | **ok / grade=ok** |
| validateControlPlane | **FAIL 4** (schema debt above) |
| produced_commit == reviewed_commit | PASS both targets |
| Distinct Codex threads (no share) | PASS (4 unique) |
| Browser/network | N/A (declared gap) |

## 8. Scorecard

| Objective | Grade | Note |
| --- | --- | --- |
| Requirement correctness (static) | **A-** | patches + ADAPT subset; network unproven |
| Evidence integrity (soft C3) | **A** | self-check ok; commits align |
| Evidence integrity (strict schema) | **B-** | 4 validate errors |
| Target-native adaptation | **A** | MQTT only where exists |
| Review independence | **A** | separate read threads |
| Task-doc hygiene | **C** | result.md stale |
| Host model fidelity | **A** | real Codex threads, not fake multi-session |
| Export quality for jj-evaluated | **A** | manifest + SHA256 + events + raw JSONL |

## 9. Promotion / next

| Item | Status |
| --- | --- |
| Episode archive in jj-flow | **this file** |
| Treat as Codex multi-thread regression sample | **recommended** |
| Promote T-lead-outside-schema | **promoted** — empty lead_resp + durable reference; recorded_at evidence fields only; telemetry plane validate OK |
| Promote T-task-result-sync | **promoted** — skill 硬门禁 + 结果门禁 + 用户文档 |
| Auto-mutate export or business repos | **do not** |

## 10. Next data-collection

1. When optimizing validate: add redacted fixture from this plane (paths → placeholders).  
2. Collect one more Codex episode with **default** `~/.jj-flow` control root success (no fallback).  
3. Optional: telemetry browser/network acceptance holdout episode.  
4. Compare wall/active vs Grok Mode S readme-pnpm (different host, different feature).

## 11. Bottom line

**Codex 实战多端 dispatch：业务与软证据闭环成功（VERIFIED + 独立 Review + ADAPT 原生适配 + 真多 thread）。**

相对 jj-flow 当前 harness：

- **可作 regression 金样（Codex 路径）**  
- **严格 validate 仍有 lead/timestamp 债务**  
- **task 文档滞后于 plane**  
- **无 C5/C6 字段；C4 文件 attestation 不适用于 codex-app thread 字符串证据形态**（Grok 规则勿硬套）

**一句话候选：** 用本样本驱动「lead∉targets 时 lead_responsibilities 与 checkpoint 时间戳」的严格校验放宽/对齐，使真实 Codex VERIFIED 导出不必手修 plane。
