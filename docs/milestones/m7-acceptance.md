# M7 半真实 Host 闭环验收

> 状态：completed（semi-real）
>
> 验收证据：`docs/milestones/m7-host-trial.json`、`tests/host-trial.test.mjs`、`npm run host:trial`

## 验收范围

M7 用系统临时目录中的独立控制仓、真实 Git repository 和独占 worktree 验证 Host 边界。它覆盖控制平面、CAS、receipt、sandbox attestation 字段、中断恢复和 Reviewer/Developer 返工，但不创建真实 Codex App task，也不把本地记录冒充为宿主 attestation。

## 试跑链路

1. 创建临时控制仓和目标 Git repository，初始控制 manifest 写入磁盘。
2. PREVIEW 后使用第一个批准快照，tick 生成只读 analysis action。
3. 模拟 thread 已创建但绑定写回不确定，将 intent 标记为 `UNKNOWN`。
4. resume 只输出 `RECONCILE_THREAD`，唯一候选携带 host、agent、实际 sandbox 和 environment 字段，恢复绑定且不重复创建。
5. analysis receipt 通过后，Developer 在真实 `codex/h4-host-trial` worktree 提交 attempt 1。
6. Test 消费实际 commit；Reviewer 返回 `NEEDS_CHANGES` 和 `F-H4-001`。
7. `requestRework` 生成 attempt 2，并要求第二个批准快照。
8. Developer 在同一独占 worktree 产生修复 commit；Test 重新验证；Reviewer 将 finding 标记为 `RESOLVED` 并返回 `PASS`。
9. 目标与 delivery 进入 `VERIFIED`，控制 manifest 通过 CAS 持久化；临时目录最终删除。

## 结果

| 信号 | 结果 |
| --- | --- |
| 控制面最终 revision | 26 |
| CAS 写入 | 22 |
| Git commit | 2 个实际 commit |
| 中断恢复 | `RECONCILE_THREAD`，0 次重复创建 |
| Review | `NEEDS_CHANGES` → `PASS` |
| Developer / Reviewer attempts | 2 / 2 |
| attention points | 2 次批准点，0 个未决决策 |
| 清理 | 临时控制仓、repo 和 worktree 全部删除 |

commit hash 和 runner fingerprint 保存在 `docs/milestones/m7-host-trial.json`。`npm run harness:check` 会比较 evidence 中的 `runner_sha256` 与当前 `src/hostTrialRunner.mjs`；runner 改变但 evidence 未重新试跑时，门禁失败。

## 验收结论

- A2：已证明批准后才能在独占真实 worktree 中产生 commit，绑定记录包含 sandbox evidence，控制面通过 CAS 持久化。
- A3：已证明 Reviewer finding 会产生新 attempt 和重批点，旧 finding 必须 `RESOLVED` 后才能 `PASS`。
- 恢复：已证明创建结果不确定时只做 reconcile，不盲目重复创建。
- 隔离：所有文件系统副作用限制在系统临时目录，无网络请求，不触碰业务仓。

## 未证明的边界

本验收没有证明 Codex App 的 `create_thread`、project binding、真实 runtime sandbox attestation 或跨机器恢复。真实 App 联调仍是部署环境验证，不得用 `codex_app_threads: false` 的半真实报告替代。
