# Agent 写 plane 硬门禁（用户不跑 CLI）

**前提：** 用户只说自然语言（分发 / 批准 / 提交 / 已合并）。Agent 自己落盘 `control-plane.json` 与 task 文档；**不得**要求用户执行 `jj dispatch-tick` 或任何 CLI 才能收口。

权威状态机仍以 `src/dispatchControlPlane.mjs` 为准。Agent 手写 plane 时等价于替 runtime 写盘，必须自检下列规则；**违反则禁止写盘，改报告阻塞原因。**

## A. 状态天花板

| 事实 | 允许的最高 status |
| --- | --- |
| 代码已改、未 commit | delivery/target ≤ `EVIDENCE_READY`；development result 可 `DONE` 但 **`produced_commit` 必须 null** 并在 progress 写明 dirty |
| 已有 feature commit，Review 未 PASS 或未对照 commit | ≤ `EVIDENCE_READY` / `RUNNING` |
| development 有 `produced_commit`（≥7 位 sha）且 Review PASS 且 reviewed == produced | target 才可 `VERIFIED` |
| 用户只说「好了 / 已合并 / ok」 | **不是**证据；先 `git` 核对 commit 是否在 intended 分支 / 是否进 integration，再决定是否升 `VERIFIED` |

禁止：

- 聊天收口直接把 delivery/target 写成 `VERIFIED`
- 空 `reviews`、空 findings、与 bind **同一时间戳**的假 Review PASS 充当门禁
- development `outcome=DONE` 且目标已 `VERIFIED` 但 `produced_commit` 仍为 null

## B. `produced_commit` 与 git（Agent 自取，不问用户要 sha）

写 development 完成或升 `VERIFIED` 前，对每个 write 目标：

1. `git -C <path> rev-parse HEAD` 与 `git log -1 --oneline`（intended feature 分支 tip）
2. 确认本任务改动已在 tip（或记录 task-scoped cherry-pick sha）
3. 写入 intent：`result.produced_commit = <full or ≥7 sha>`
4. target / checkpoint / last_result：`commit` 与 `reviewed_commit` **相同且非空**（`VERIFIED` 时）
5. 工作区仍 dirty 且 dirty 属于本任务 → 先 commit 或明确停在 `EVIDENCE_READY`，不得 `VERIFIED`

## C. session / thread 绑定（禁止合成 ID）

| Host | `thread_id` 必须是 |
| --- | --- |
| Grok Build | 真实 session id（形如 `019f…-…` 的宿主 id）；**禁止** `session-<slug>-YYYYMMDD` 等占位符 |
| Codex App | 真实 thread id |

**同会话实施（Grok 常见、合法）：** 宿主无法/未建多 session 时，调度 Agent 可在**当前会话**内改各目标仓，但：

1. 所有本波 intent 的 `thread_id` 填**当前真实 session id**（可相同）
2. `host_id=grok-build`，`handle_kind=session`
3. **C4：** 每个 **BOUND** intent（**含 review/read**）写 attestation **文件**
   `{control_root}/.workflow/dispatch/<DEL>/attestations/<task_key_safe>.json`
   `sandbox_evidence_ref` = 该相对路径。**禁止**仅用 `host:grok-build:session:…` 字符串（development 与 review 一视同仁）
4. progress 注明 `execution=same-session`；仍须按 A/B 填 commit 后才 `VERIFIED`
5. **禁止**为凑 4 个 task_key 伪造 4 个假 session

库辅助（jj-flow）：`writeGrokAttestation` / `attestationRelativePath`（`src/dispatchAttestation.mjs`）。

拿不到真实 handle → intent 保持 `PENDING_THREAD` 或只记 progress，**不要**写 `BOUND` 假绑定。

## D. 落盘前自检清单（每次改 plane 默念）

```text
[ ] intake / approval 与本轮 task_keys 一致
[ ] 写任务 environment=project-branch（或已确认的 exclusive-worktree）+ intended_branch
[ ] 无合成 thread_id
[ ] C4：每个 BOUND intent 的 sandbox_evidence_ref 指向 attestations/*.json（含 review）
[ ] 若 status≥EVIDENCE_READY：changed_files / summary 与 git diff 一致
[ ] 若 status=VERIFIED：produced_commit + commit + reviewed_commit 齐全且一致
[ ] 若 status=VERIFIED：task/result.md 与 progress.md 已同步（非仍写 EVIDENCE_READY）
[ ] lead∉targets 时：lead_responsibilities 有计划，或 reference_implementation 完整（commit+snapshot+verification）
[ ] C5：plane-self-check grade=ok 再宣称 VERIFIED；可 setIntegrityGrade
[ ] C6：push/merge 后 setRemoteCloseout；用户说「已合并」须 git 核对，不单靠聊天
[ ] 承载等多 feature 合 dev：优先 task-scoped cherry-pick（见 EP-S1 / acceptor-tag 负例）
```

可选（Agent 自跑，**不**教用户）：

```bash
node .codex/skills/jj-dispatch/scripts/plane-self-check.mjs --manifest <control-plane.json> [--json]
```

输出含 `integrity_grade`（C5）。非 0 退出则禁止宣称 VERIFIED。

## 结果门禁补充

- `reference_implementation` 初始必须 `null`。仅 lead 或已授权目标 commit 稳定，且有 `PASS` 验证证据、snapshot 引用与 hash 后才可设置。
- 任一目标失败：保留其原同步 checkpoint，不推进整个项目族基线。
- 源项目完成并验证后：默认只生成推荐下一步，不自动扩大目标集合。用户选择后重新 PREVIEW + APPROVE；禁止复用旧 approval 或静默建目标 thread。
- 目标回执：`VERIFIED` 或 `NO_CHANGE_REQUIRED`。
  - `VERIFIED`：terminal writer 当前 Review PASS 的新 commit、source head、验证证据；**intent.`produced_commit` 与 target commit/reviewed_commit 一致**。无 commit → 停在 `EVIDENCE_READY`。
  - `NO_CHANGE_REQUIRED`：planning/analysis 的 `ANL-TARGET`、`difference_ref`、目标 HEAD、`unresolved=[]`；未派发 development/verification/review 标 `SKIPPED`；不伪造 Developer commit / VRF / Review。
- 同步目标两种成功态都须 `FRESH` handoff、snapshot ref/hash、source/target branch 与 HEAD、差异决策引用；缺字段或 `STALE` 不得推进 checkpoint。
- **用户自然语言不能单独推进 checkpoint**（含「已合并」「完成」「ok」）；只作为触发 Agent 去读 git / plane 的信号。
- **T-task-result-sync**：把 delivery/target 标 `VERIFIED` 时，必须同批更新 `.workflow/tasks/<TASK-ID>/result.md` 与 `progress.md`：
  - `result.md`：状态=`VERIFIED`；表列各 target 的 commit / review PASS；不得保留过期的 `EVIDENCE_READY` 段作为当前态
  - `progress.md`：追加 VERIFIED 时间与 revision
  - plane 是 SSOT；task 文档是给人恢复用的镜像，**允许滞后即视为收口未完成**
