# Episode evaluation — Mode S closed loop `DEL-readme-pnpm-install-20260731`

> Status: **dispatch control-plane closed** (VERIFIED + plane-self-check OK); remote/integration land **optional open**
>
> Skill: `jj-evaluated`
>
> Scope: first live Grok delivery that satisfies beta.38 Mode S + C3 terminal integrity
>
> Non-goals: do not rewrite historical acceptor-tag plane; do not auto-push business repos.

## 1. Scope and authorities

| Field | Value |
| --- | --- |
| episode_id | `EP-20260731-D1-readme-pnpm-install` |
| delivery_id | `DEL-readme-pnpm-install-20260731` |
| task_id | `TASK-DEL-readme-pnpm-install-20260731` |
| feature | README 安装依赖：`npm install` → `pnpm install` |
| host | Grok Build Mode S |
| session_id | `019fb5b3-b1f4-78b3-b79d-ffd601f91e55`（四 intent 共享） |
| control_root | `D:/a/dispatch-control` |
| control-plane hash | `690410c60e45` (SHA-256 prefix @ eval) |
| evaluation_date | 2026-07-31 |
| prior | `2026-07-30-acceptor-tag-color-dispatch.md`（integrity FAIL 负例） |
| harness | Mode S skill on `@shendu-sdt/jj-flow@0.1.1-beta.38` |

### Role mapping

| Role | project_id | path | branch | commit |
| --- | --- | --- | --- | --- |
| 承接 lead/owner/origin | `cj-web` | `D:/a/cj-web` | `feat/cj-0731-lyj` | `1ec732bd6` ralph COMPLETED |
| 兑接 target | `dj-web` | `D:/a/dj-web` | `feat/dj-0731-lyj` | `9093b961d` DIRECT |
| 承载用户端 target | `cz-broker-web` | `D:/a/cz-broker-web` | `feat/cz-0731-lyj` | `f7fbe8818` DIRECT |

## 2. Portfolio inventory (control_root @ 2026-07-31)

| delivery_id | plane status | plane-self-check | task status | note |
| --- | --- | --- | --- | --- |
| `DEL-readme-pnpm-install-20260731` | VERIFIED | **OK** | VERIFIED | **本波闭环** |
| `DEL-acceptor-tag-color-20260730` | VERIFIED (label) | **FAIL 12** | VERIFIED | 业务已合 dev；控制面诚信负例，保留 regression |

仅两波 delivery；无第三未完成波。

### Closeout layers

| Layer | readme-pnpm | acceptor-tag |
| --- | --- | --- |
| Ralph source | COMPLETED | COMPLETED |
| Dispatch plane integrity | **closed** | **open (FAIL)** |
| Feature git commits | yes | yes |
| origin push / integration | **open** (三仓 ahead 1) | 当时已 land（业务） |

## 3. Timeline tags (trace-backed)

| Tag | Evidence |
| --- | --- |
| `handoff_reuse` | request_ref / handoff_ref ralph COMPLETED；source_head commit |
| `branch_correction` | PREVIEW cz NEEDS_CONFIRM → 用户确认 `feat/cz-0731-lyj` |
| PREFLIGHT source commit | 源未 commit → DISPATCH **BLOCKED**；用户提交后再派 |
| Mode S | `execution_mode=S`；真 session；project-branch |
| C3 terminal | dirty → EVIDENCE_READY；commit → review PASS → VERIFIED + produced_commit |
| `validation_wait` | none material（README only） |

## 4. Baseline (cautious)

| Metric | Value | clock_quality |
| --- | --- | --- |
| Business outcome | 三仓 README 安装依赖 pnpm | exact (git) |
| plane-self-check | OK | exact |
| Formal Mode S artifacts | attestations×2 + receipts×4 | exact |
| Remote land | not done | exact (ahead 1) |
| Wall / active | unknown (no thread export in this eval pass) | unknown |

## 5. Split update

| Split | Membership |
| --- | --- |
| **search** | acceptor-tag integrity FAIL；Mode S 设计迭代 |
| **holdout → graduated** | preference-modified「需要真实 plane」→ **readme-pnpm 已毕业为成功样本** |
| **regression** | C1 project-branch；C2 confirm；C3 produced_commit；Mode S 真 session；**PREFLIGHT 源 commit**；readme-pnpm golden path |

Leakage：后续优化勿用 acceptor-tag 假 VERIFIED 当成功训练信号。

## 6. Evolution candidates（本会话）

| ID | Candidate | Status |
| --- | --- | --- |
| C3 | Agent VERIFIED 门禁 + plane-self-check | **promoted** beta.38 |
| Mode S | Grok 默认同会话 + attestation/receipt | **promoted** + **live OK** |
| **C4** | Review intent 也落 attestation **文件** | **promoted**（self-check BOUND + skill + `dispatchAttestation.mjs`） |
| **C5** | `integrity_grade` ok\|degraded\|fail | **promoted**（`gradePlaneTerminalIntegrity` + `setIntegrityGrade` + schema） |
| **C6** | `remote_closeout` 可选 | **promoted**（`setRemoteCloseout`；不挡 VERIFIED） |
| R-rollback | reopen/supersede 误 VERIFIED | R1–R3 已实现；**live 路径 B 见** `2026-07-31-readme-pnpm-rollback.md` |
| **R-soft-reopen** | Mode S 软 plane 无法直接 `reopenTarget` | proposed（rollback eval） |

**一次只推一个：** 回退线优先 **R-soft-reopen**；升级 backlog 仍见 C4（Review attestation 文件化）。

## 7. Harness

| Check | Result |
| --- | --- |
| `npm run harness:check` / GC（本会话先前） | PASS；**无需为闭环强制改 harness-manifest** |
| 是否要把 plane-self-check 编进 harness 扫描 control_root？ | **不建议**（control_root 本机路径非仓内 versioned 资产） |
| 建议 | 保持 self-check 为 skill 工具；regression 用 **仓内** 测试 fixture + 本 evaluation 文档 |

## 8. Promotion / next

| Item | Status |
| --- | --- |
| Mode S Phase 2a live checkbox | **met** by this episode |
| Host Wave 2 / Mode P | still open |
| Remote land for readme-pnpm | user optional `$jj-end` / push |
| Document set | this file + evidence-map + Mode S exec plan |
| **升级 backlog 存档** | `docs/exec-plans/active/2026-07-31-dispatch-upgrade-backlog.md`（**blocked · 留待升级**；U1=C4 优先） |

## 9. Bottom line

**Dispatch 控制面闭环：是（readme-pnpm）。**  
**Portfolio 其它波：acceptor-tag 业务完、证据链不绿，作负例。**  
**Harness：不必为本次闭环改契约；进化点在 skill 证据一致性（C4）与可选远端收口标注（C6），回退能力另 exec plan。**
