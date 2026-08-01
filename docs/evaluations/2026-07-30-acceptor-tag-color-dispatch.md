# Episode evaluation — formal dispatch `DEL-acceptor-tag-color-20260730`

> Status: evaluation closed for protocol candidate C3 (**promoted**); plane remains **integrity FAIL** (historical negative)
>
> Skill: `jj-evaluated`
>
> Scope: first live multi-project dispatch under `/portfolio/dispatch-control`（业务可闭环，证据链不绿）
>
> 2026-07-31：`plane-self-check` 仍 **FAIL 12**（合成 session + VERIFIED 无 produced_commit）。  
> **成功对照样本**已换成 `docs/evaluations/2026-07-31-readme-pnpm-dispatch.md`（Mode S 真闭环）。  
> 勿回写本 plane 伪装历史；用 reopen/回退规划（exec plan rollback）另线处理。
>
> Non-goals: do not rewrite the control-plane snapshot; do not re-open business commits.

## 1. Scope and authorities

| Field | Value |
| --- | --- |
| episode_id | `EP-20260730-D1-acceptor-tag-color-dispatch` |
| delivery_id | `DEL-acceptor-tag-color-20260730` |
| task_id | `TASK-DEL-acceptor-tag-color-20260730` |
| feature | 承兑人标签：列表模式颜色与本仓卡片列表一致 |
| host | Grok Build (session export) |
| thread_id | `019fb288-5e92-7a73-bb0a-b6d6edfe1420` (cwd=`/portfolio/project-b`) |
| control_root | `/portfolio/dispatch-control` |
| control-plane hash | `854d64eb96d4` (SHA-256 prefix) |
| evaluation_date | 2026-07-30 |
| prior related | `docs/evaluations/2026-07-30-preference-modified-dispatch.md` (no control-plane holdout → this is that holdout sample) |

### Role mapping (facts at evaluation)

| Role | project_id | path | intended_branch | style commit | note |
| --- | --- | --- | --- | --- | --- |
| 项目B (origin / owner / lead) | `project-b` | `/portfolio/project-b` | `feat/pb-0731-dev` | `5af0b1c6b` | ralph `RALPH-acceptor-tag-color-20260730` COMPLETED; later merge to `dev` |
| 项目A (target) | `project-a` | `/portfolio/project-a` | `feat/pa-0731-dev` | `f68b7043f` | ADAPT `#11A560` (bg-green); stylelint/postcss friction on commit |
| 项目D (target) | `project-d` | `/portfolio/project-d` | `feat/pc-0731-dev` | `493db28c5` (+ pick `204595d2b` on dev) | ADAPT g-tag 体系；整支 merge 曾冲掉 aliyun tracker |

Artifact anchors:

- `/portfolio/dispatch-control/.workflow/dispatch/DEL-acceptor-tag-color-20260730/control-plane.json` (`854d64eb96d4`)
- `/portfolio/dispatch-control/.workflow/tasks/TASK-DEL-acceptor-tag-color-20260730/*` (`task.json` `58848e2fc0e7`)
- `/portfolio/project-b/.workflow/ralph/RALPH-acceptor-tag-color-20260730/run.json` (`40d94f585de9`)
- Thread export: `~/.grok/sessions/D%3A%5Ca%5Cproject-b/019fb288-…/`

## 2. Normalized timeline

| event_id | kind | phase | labels | evidence |
| --- | --- | --- | --- | --- |
| evt-ralph-source | artifact_write | analyze→archive | handoff gap | ralph COMPLETED ~10:19–10:22Z; `handoff=null`, `host=null` |
| evt-user-dispatch | user_request | dispatch | role_mapping | `/jj-dispatch 分发当前任务到 项目A和项目D` |
| evt-preview | artifact_write | dispatch | | PREVIEW plane revision 1; intake CONFIRMED; branch uncertainty listed |
| evt-approve | user_correction | dispatch | | `ask_user_question` → 批准全部分发 + project-branch |
| evt-dispatch-edit | agent_turn | dispatch | evidence_gap | plane hand-edited via PowerShell/node write (not `dispatch-tick` CAS) |
| evt-implement-inline | tool_call | deliver | target_native_adaptation, subagent_overhead(neg) | **same session** edits pa + pc `table-list.vue`; no real CREATE_THREAD |
| evt-evidence-ready | artifact_write | accept | | result.md: `EVIDENCE_READY`, uncommitted |
| evt-jj-end | commit | deliver | validation_wait | 三仓 style commit + land; pa postcss; pc cherry-pick then full merge |
| evt-user-merged | user_request | accept | | `已合并` |
| evt-verified-write | artifact_write | accept | evidence_gap | plane → `VERIFIED` rev 4 **without** `produced_commit` / target `commit` |
| evt-tracker-regression | user_correction | — | regression, branch_correction | user: 项目C dev 缺 aliyun-tracker；归因整支 merge 覆盖 |

Timestamps (UTC unless noted):

| marker | value | provenance | clock_quality |
| --- | --- | --- | --- |
| thread wall | 10:18:29 → 10:49:48 | `summary.json` | derived |
| intake confirm | 10:30:00 | plane events | derived (rounded) |
| approve | 10:35:14.141 | plane.approval | exact-ish |
| synthetic bind | 10:36:30.188 (all 4 intents) | plane intents | **inconsistent** (batch stamp) |
| user_confirmed_merged | 10:44:41.923 | plane events | exact-ish |
| pb style commit | 2026-07-30 18:38:03 +0800 | git | exact |
| pc style commit | 2026-07-30 18:38:13 +0800 | git | exact |
| pa style commit | 2026-07-30 18:40:29 +0800 | git | exact |

## 3. Baseline (cautious)

| Metric | Value | clock_quality | provenance |
| --- | --- | --- | --- |
| Business outcome | 三仓列表默认色按本仓卡片 ADAPT，且 style 进 feature + `dev` | exact | git |
| Formal control plane | **present** (first live holdout success for “has CAS file”) | exact | filesystem |
| Protocol shape | PREVIEW → approve UI → implement → closeout | exact | thread |
| Runtime CAS / schema gate | **bypassed** (manual JSON rewrite) | exact | thread tool calls |
| `produced_commit` on development intents | **null** | exact | plane |
| Soft validate vs runtime rules | **FAIL** (VERIFIED missing commit/reviewed_commit) | exact | local soft check |
| Real host sessions for 4 task_keys | **no** (synthetic `session-acceptor-tag-*-20260730`) | exact | plane + single thread_id |
| Active work | unknown (no per-turn token accounting) | unknown | — |
| Wall span (thread) | ~31 min | derived | summary |
| Handoff reuse | weak (ralph `handoff=null`; re-diff targets in dispatch) | derived | ralph + thread |
| Browser / UAT | not run | n/a | export |

Do not use file mtime as active duration. Do not treat plane `bound_at` as four real binds.

## 4. Tags and causal hypotheses

| Tag | Evidence | Hypothesis |
| --- | --- | --- |
| `target_native_adaptation` | pa `#11A560`; pc `#22b577` / g-tag 供商供银；未抄项目B `#0076F6` | distribution_prompt risk notes worked |
| `handoff_reuse` (weak) | request_ref ralph; no frozen handoff snapshot | ralph archive without handoff forced re-analysis of targets |
| `branch_correction` | PREVIEW listed wrong checkout; user approved intended feature branches | C2 confirm-before-DISPATCH **helped** |
| `evidence_gap` | VERIFIED without commit fields; synthetic threads; reviews empty + same ts | Agent treated chat/closeout as checkpoint authority |
| `subagent_overhead` (inverted) | Scheduler **did** development in-session | Host Wave / CREATE_THREAD still unavailable or skipped; single-session multi-write |
| `validation_wait` | pa stylelint/postcss@5 vs 8; pc merge conflicts | tooling + dirty feature history, not color logic |
| `regression` | `feat/pc-0731-dev` full merge onto `dev` removed aliyun tracker tree | land strategy used whole branch tip, not task-scoped commit only (echo EP-S1) |
| `user_correction` | 已合并；埋点代码去哪了 | Closeout semantics ambiguous (feature merge vs task commit) |

**Dominant success mode:** product ADAPT + project-branch + user-gated PREVIEW.

**Dominant failure mode:** **checkpoint integrity** — plane looks “complete” (`VERIFIED`, intents `BOUND`, reviews `PASS`) while it would fail `dispatchControlPlane` VERIFIED gates and was never written via CAS.

## 5. Dataset split

| Split | Membership | Rationale |
| --- | --- | --- |
| **search** | this episode (protocol + plane integrity) | first formal plane; rich thread |
| **holdout** | next formal dispatch that uses `jj dispatch-tick --write` / runtime apply with real session ids | must not tune on this synthetic bind pattern alone |
| **regression** | C1 project-branch default; C2 confirm-before-DISPATCH; ADAPT no hard-copy hex; EP-S1 branch-purpose preflight; **VERIFIED requires produced_commit** | already in skill/runtime text — episode shows **skill text without enforcement path** |

Leakage check: preference-modified (no plane) remains separate search for workspace UX only; do not merge its scores into this plane-integrity candidate.

## 6. One candidate change (bounded)

### C3 — Agent 写 plane 硬门禁（**用户不跑 CLI**）

**Mechanism（已按真实用法改写）**

用户只说自然语言；Agent 直接改 `control-plane.json`。不把 `jj dispatch-tick` 当用户路径。

1. **Skill 门禁 8 +「Agent 写 plane 硬门禁」**：无 `produced_commit` 最多 `EVIDENCE_READY`；禁止聊天「已合并」升 `VERIFIED`；git 自取 sha。
2. **同会话合法**：Grok 可同 session 实施多目标，但 `thread_id` 必须是**真实** session id（可共享）；禁止 `session-*-YYYYMMDD` 合成 BOUND。
3. **Agent 可选自检脚本**（不教用户）：`node .codex/skills/jj-dispatch/scripts/plane-self-check.mjs --manifest …`

**Expected effect**

- 下一波 Agent 即使手写 plane，也会停在诚实的 `EVIDENCE_READY` 或填齐 commit 再 `VERIFIED`。
- 保留 PREVIEW / project-branch / ADAPT 体验。

**Promoted artifacts**

- `.codex/skills/jj-dispatch/SKILL.md`（门禁 8 + Agent 硬门禁 A–D）
- `.codex/skills/jj-dispatch/references/control-project.md`（EVIDENCE_READY / 手写 plane）
- `.codex/skills/jj-dispatch/scripts/plane-self-check.mjs`
- `tests/plane-self-check.test.mjs`

**Out of scope**

- 回写本 delivery 历史 plane（保留为负例）。
- 要求用户学会任何 CLI。
- Full Grok multi-session CREATE host Wave。

## 7. Replay (cheap)

| Check | Result |
| --- | --- |
| Soft validate plane against runtime VERIFIED rules | **FAIL** (missing commit fields; DONE w/o produced_commit) |
| Git style commits present | **PASS** (pb/pa/pc) |
| ADAPT not copy-source hex | **PASS** |
| Browser | skipped (acceptance did not require) |
| `npm run verify` on jj-flow | not required for this read-only eval |

## 8. Promotion / rollback

| Item | Status |
| --- | --- |
| Evaluation record | this file |
| C1 project-branch | already promoted (prior) — **reconfirmed** used |
| C2 confirm-before-DISPATCH | already promoted (prior) — **reconfirmed** used (`ask_user_question`) |
| C3 Agent terminal integrity | **promoted** (skill + plane-self-check; agent-path, no user CLI) |
| Rollback C3 | revert skill section + remove `scripts/plane-self-check.mjs` / test; dirty-worktree accepts stay at `EVIDENCE_READY` |

## 9. Next data-collection

1. One dispatch wave that **only** mutates plane via runtime CLI and ends with real `produced_commit` hashes.
2. Capture whether Grok can bind a real session id (not synthetic) for at least one development `task_key`.
3. On 项目C multi-feature branches: land policy sample for **task-scoped cherry-pick only** vs full feature merge (tracker wipe case).
4. Ralph on lead: require `run.handoff` before multi-target dispatch recommendation.

## 10. Bottom line

This is the first **formal** live dispatch with `control-plane.json`, `task_key`s, PREVIEW approval, and **project-branch** multi-target ADAPT — product outcome is good.

It is **not** yet a green formal-protocol sample: the plane’s terminal `VERIFIED` / synthetic `BOUND` sessions would fail the runtime gates that already exist in code. The learning priority is **enforce those gates on the write path** (candidate C3), not invent more product color rules.
