# Exec plan — Dispatch / Ralph 任务回退（rollback）

> 状态：active
>
> 负责人：jj-flow dispatch + ralph
>
> 开始日期：2026-07-31
>
> 关联：
> - [jj-dispatch skill](../../commands/jj-dispatch.md) · `requestRework` / `abandonDispatchUnknown`（`src/dispatchControlPlane.mjs`）
> - [jj-ralph 阶段](../../design-docs/jj-ralph.md) · gates / BLOCKED / DELIVER 循环
> - 评估负例：`docs/evaluations/2026-07-30-acceptor-tag-color-dispatch.md`（假 VERIFIED、整支 merge 冲树）
>
> 边界：**先定义诚实的控制面/ledger 回退语义**；默认不自动 `git revert` / 不自动 unmerge；用户不跑 CLI 时 Agent 可落盘等价操作

## 1. 背景与动机

现状（2026-07-31 对话结论）：

| 系统 | 已有 | 缺口 |
| --- | --- | --- |
| Dispatch | rework（attempt++）、RECONCILE/abandon UNKNOWN、单目标 FAILED 隔离 | 无正式「回退」动作；无 skill 可见清单；VERIFIED 误标后无标准收口 |
| Ralph | DELIVER 迭代、gate FAIL/BLOCKED、product-consistency 挡假完成 | 无 phase 回退；无 un-archive；无「撤销最近 gate」合约 |

用户需要：**下一阶段可规划、可验收的回退能力**，而不是再靠手改 JSON / 聊天假装未发生。

## 2. 目标

1. 定义并实现 **Dispatch 回退动作矩阵**（控制面状态 + 可选 git 建议，分离）。
2. 定义并实现 **Ralph 回退动作矩阵**（run/gate/phase 诚实回退，不时光机擦除 archive 事实）。
3. Skill 文案 + 合约测试 +（可选）Agent 自检脚本；**用户自然语言触发，不强制 CLI**。
4. 与 Mode S / C3 一致：回退本身也要写 evidence，禁止只改聊天。

## 3. 非目标

- 一键「整 delivery / 整 run 从未发生」且自动抹 git 历史。
- 默认自动 `git push --force`、自动 unmerge integration。
- Workflow / 聊天 thread 倒放作为控制面权威。
- 在未过合约测试前提升 autonomy。

## 4. 架构裁决（本计划锁定）

| 问题 | 裁决 |
| --- | --- |
| 回退改什么？ | **优先控制面 / ralph ledger**；代码回退用 **git 建议包**（commit list + 建议 message），默认不自动执行 |
| VERIFIED 能否回退？ | 允许 → **`SUPERSEDED` / `REOPENED` 类终端旁路态或新 attempt**，保留旧 revision 审计；禁止静默改历史 revision 字段冒充未 VERIFIED |
| COMPLETED archive？ | 不 un-archive 覆盖；**新 run** 或 `reopen` 元数据指向旧 archive |
| 用户路径 | 自然语言（「回退目标 X」「撤销上次验收」）；Agent 写 plane/run；CLI 可选 |

## 5. 分波交付

### Phase R1 — 规格 + skill 可见（优先）

| ID | 项 | 产出 |
| --- | --- | --- |
| R1-1 | 回退语义表写入 skill references | `jj-dispatch/references/rollback.md`、`jj-ralph/references/rollback.md`（或 phases 专节） |
| R1-2 | SKILL 入口 + References 表 | dispatch / ralph 各一节「回退」 |
| R1-3 | 用户命令页摘要 | `docs/commands/jj-dispatch.md`、`jj-ralph.md` |
| R1-4 | 负例表 | 手改 VERIFIED 无事件、假 session、已 merge 只改 plane |

**验收：** harness 文档策略通过；Agent 能按表回答「能/不能回退什么」。

### Phase R2 — Dispatch 控制面动作

| ID | 项 | 说明 |
| --- | --- | --- |
| R2-1 | `reopenTarget` / `supersedeVerified`（名可改） | 自 `VERIFIED` 或误 `EVIDENCE_READY` 进入可再派发态；写 `events[]` + revision++ |
| R2-2 | 包装现有 `requestRework` / `abandonDispatchUnknown` | skill 路径与错误信息中文化、Grok Mode S 可用 |
| R2-3 | `rollbackIntent`（可选） | `BOUND`/`PENDING_THREAD` → `BLOCKED` + reason；禁止同 key 再 create 除非 attempt++ |
| R2-4 | 合约测试 | 回退后 validateControlPlane ok；VERIFIED 门仍 fail-closed 直至新 commit |
| R2-5 | plane-self-check 扩展 | 检测「VERIFIED 无 commit」建议走 reopen 而非手改 |

**验收：** `tests/jj-dispatch-contract.test.mjs`（或新文件）覆盖 rework / reopen / abandon；`npm run verify` 绿。

### Phase R3 — Ralph ledger 动作

| ID | 项 | 说明 |
| --- | --- | --- |
| R3-1 | `setGate FAIL` + 允许 phase 回退策略 | 显式 `rollbackPhase`：仅允许向前阶段回退到上一 phase（如 ACCEPT→DELIVER），写 progress 事件 |
| R3-2 | `PAUSED` / `BLOCKED` 正式入口 | skill：「暂停任务」「阻塞原因」 |
| R3-3 | COMPLETED 不 reopen 旧目录 | `ralph reopen-as-new` 建议：复制 goal + 链 `supersedes_run_id` |
| R3-4 | 合约测试 | gate 回退、禁止伪造 COMPLETED→IN_PROGRESS 无事件 |

**验收：** ralph 合约测试绿；phases.md 与 schema 字段对齐。

### Phase R4 — Git 协作包（可选）

| ID | 项 | 说明 |
| --- | --- | --- |
| R4-1 | `rollback-prep` | 输出：建议 `git revert <sha…>` / cherry-pick 逆序；**不执行** |
| R4-2 | 与 `$jj-end` 边界 | land 后回退必须 task-scoped；Revert 树风险提示（沿用 EP-S1 / acceptor-tag） |
| R4-3 | 用户确认后 Agent 才可执行 revert | 不可逆门禁 |

**验收：** 至少一份 fixture 输出与真实负例 commit 列表一致。

## 6. 建议状态语义（草案，实现时再进 schema）

### Dispatch（草案）

```text
正常：… → EVIDENCE_READY → VERIFIED
回退：VERIFIED --(reopen/supersede)--> RUNNING|EVIDENCE_READY + events
      BOUND/PENDING --(block)--> BLOCKED
      UNKNOWN --(abandon)--> BLOCKED → attempt+1 PREVIEW
返工：NEEDS_CHANGES --(requestRework)--> attempt+1 + 清 approval
```

禁止：删除 `events` / 把 revision 调小 / 无 git 证据把 produced_commit 清空却保持 VERIFIED。

### Ralph（草案）

```text
phase 回退：仅相邻或显式允许的回退边（ACCEPT→DELIVER；ARCHIVE 不可回）
status：IN_PROGRESS ↔ PAUSED/BLOCKED；COMPLETED → 仅 superseding 新 run
gate：PASS 可被后续 FAIL 覆盖并记 progress；不得无日志改 gates
```

## 7. 验收总标准

- [ ] R1 规格在 SSOT skill，用户文档有摘要  
- [ ] R2 至少一个 reopen/rework 路径有合约测试  
- [ ] R3 至少一个 phase/gate 回退路径有合约测试  
- [ ] 无「自动 force push / 自动 unmerge」  
- [ ] Grok Mode S：回退不依赖用户 CLI  
- [ ] `npm run verify` PASS  

## 8. 依赖与顺序

1. **先 R1**（低风险、立刻减少 Agent 乱手改 plane）  
2. R2 与 R3 可并行，优先 **Dispatch reopen**（与 C3 假 VERIFIED 负例直接相关）  
3. R4 在 R2/R3 稳定后  

并行注意：schema 改动须 `harness:check` + install-skill。

## 9. 下一步（立即）

1. 实现 R1-1/R1-2：两份 rollback 参考文 + skill 入口（本计划批准后）。  
2. R2-1 草案 API 与 schema 字段 PR。  
3. 实战样本：对 `DEL-acceptor-tag-color` 类假 VERIFIED 走 reopen 演练（不改历史业务 commit）。

## 10. 决策日志

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-07-31 | 回退 = 控制面/ledger 诚实前进，非 git 时光机默认 | 已有 rework/attempt 模型；自动 revert 过险 |
| 2026-07-31 | COMPLETED/VERIFIED 用 supersede/reopen，不擦除审计 | 检查点不可伪造未发生 |
| 2026-07-31 | 用户不跑 CLI | 与 Mode S / C3 一致 |
