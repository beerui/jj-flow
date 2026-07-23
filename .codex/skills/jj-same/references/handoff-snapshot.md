# 迁移交接快照

Handoff snapshot 用于把一次已经收敛的源需求语义交给多个目标项目。它解决的是“每个目标重新读取完整源会话和需求文档”造成的重复与理解漂移，不替代正式需求，也不缓存目标源码事实。

## 核心边界

- `BLP-* / REQ-*` 始终是正式需求唯一 source of truth。
- Snapshot 是源 `ANL-SOURCE` artifact 内的不可变派生清单，MUST 只保存引用、来源指纹、coverage、纠正顺序、验证状态和待验证目标差异。
- Snapshot MUST NOT 复制 requirement body，不得写入 `.workflow/specs/`、`.workflow/.sessions/*/status.json` 或新建 `.workflow/jj-same/`。
- Source Inventory 实体 MUST 只存在于 snapshot 所属的 `requirement-baseline` bundle；`context-package.json` 只保存 `handoff_ref`、`snapshot_id` 和必要摘要。
- 每个目标 MUST 重新验证当前 Git、源码、调用链和目标专有行为，并独立生成 `ANL-TARGET -> PLN -> EXC/VRF -> REV`。

Canonical 路径：

```text
.workflow/.csv-wave/{日期}-analyze-{主题}/
  context-package.json
  requirement-baseline/
    HOF-{feature}-{sequence}/
      handoff-snapshot.yaml
```

字段契约见 [handoff-snapshot.schema.json](handoff-snapshot.schema.json)。

## 生成时机

源项目进入以下任一状态时生成 snapshot：

- `PARTIAL_HANDOFF`：源 commit 已稳定，但交付证据或需求证据仍不完整。必须同时给出 `execution_readiness`：仅缺源评审、UAT、VRF 或交接记录时可为 `READY`，目标 MAY 带 caveat 实施；源不稳定、最终需求冲突或存在影响 `MUST` 的缺口时为 `BLOCKED`，目标只能做高层差异分析。
- `READY_FOR_HANDOFF`：源 commit 稳定，必要静态检查通过，必要用户运行时测试已确认或有 `N/A` 证据，评审不阻塞，且没有影响 `MUST` 的 `UNRESOLVED`。用户主动触发后，目标 MAY 进入完整 `ANL-TARGET` 和实施链。

`handoff_status` 表示源交接完成度，`execution_readiness` 表示当前目标是否已有足够事实开始编码，两者不得混用。源 `review/user_test` 为 `PENDING` 只能阻止宣称 `READY_FOR_HANDOFF`，不能单独把 `execution_readiness` 降为 `BLOCKED`。

源分析阶段仍应尽早维护家族交付计划；snapshot 不要求等所有目标完成后才生成。正确触发点是“源项目形成可验证交接状态”，不是“聊天窗口自然结束”。

## Freshness 决策

目标消费前必须重新评估 snapshot，不得直接相信旧摘要：

| Freshness | 判定 | 启动动作 |
|---|---|---|
| `FRESH` | source HEAD、会话 cursor、来源指纹、父 snapshot 和 canonical refs 均可验证且未变化 | `REUSE` |
| `PARTIAL` | 引用可验证，但存在缺失来源或 `UNRESOLVED` | `REUSE` 仅限允许的分析范围；影响 `MUST` 时保持 `BLOCKED` |
| `STALE` | source HEAD、会话 cursor、需求文档 hash 或用户明确要求已变化 | `REFRESH_SOURCES`，只读取变化来源并生成 successor |
| `BROKEN` | schema、父链、source repo、canonical refs 或 provenance 不可解析 | `REBASELINE`；无法恢复时 `BLOCKED` |

Snapshot 内的 `seal_freshness` 只记录生成时的 `FRESH` 或 `PARTIAL` 声明，不得被回写。目标会话必须把当前 `FRESH / PARTIAL / STALE / BROKEN` assessment 写入自己的分析或 decision report，并且 MUST 输出且只能输出一个启动动作：`REUSE / REFRESH_SOURCES / REBASELINE / BLOCKED`。

## 准备交接

执行 `$jj-same 准备交接` 时：

1. 验证源仓库、origin、业务角色、分支、HEAD、工作区和验证结果。
2. 从源会话、当前用户要求、需求文档、Git 和现有 artifact 建立 Source Inventory。
3. 将最新明确用户纠正记录为 supersession；不得让旧文档覆盖新口径。
4. 验证 `ANL-SOURCE`、`BLP/REQ` 和家族协调计划引用。
5. 根据缺失来源、`UNRESOLVED`、评审和 UAT 生成 `PARTIAL_HANDOFF` 或 `READY_FOR_HANDOFF`，并独立计算 `execution_readiness`。
6. 写入新的不可变 snapshot；已有 snapshot 发生变化时创建 `parent_snapshot` 指向旧版本的 successor，不原地改写旧文件。
7. 在源 `context-package.json` 和家族协调计划中登记 `snapshot_id`、`handoff_ref`、source HEAD 和状态。

## 消费交接

执行 `$jj-same 交接=@.../handoff-snapshot.yaml` 时：

1. 解析 snapshot schema，并验证 source repo、HEAD、会话 cursor、来源指纹和所有 canonical refs。
2. 输出 freshness、`execution_readiness` 和唯一启动动作。
3. `REUSE` 时直接消费共享 `ANL-SOURCE / BLP/REQ`；MUST NOT 在目标仓库重新生成一套源分析或 blueprint。
4. `REFRESH_SOURCES` 时只读取变化、新增、恢复可用或关联 `UNRESOLVED` 的来源，在源 artifact 归属仓库生成 successor snapshot；目标不得私自改写共享需求。
5. `REBASELINE` 时回到源 artifact 归属仓库重建源分析与 blueprint 引用；目标保持 `BLOCKED`。
6. 目标 `ANL-TARGET` 必须记录消费的 `snapshot_id`、`handoff_ref`、snapshot hash、source HEAD 和 freshness 证据。
7. 当前目标发现仅适用于自身的差异时写入 `TARGET-ONLY / DO-NOT-PORT / N/A`；发现共享产品语义变化时回到源生成 requirement delta 和 successor snapshot。

## 更新交接

源需求、源实现或验证状态变化时，在源 artifact 归属仓库调用：

```text
$jj-same 更新交接 交接=@<旧 handoff-snapshot.yaml 绝对路径> 会话=<源需求会话 ID> 源提交=<新 commit> 变更=<需求纠正或 bug fix>
```

执行规则：

1. 旧 snapshot MUST 只读，并作为 `parent_snapshot`。
2. 只重新读取 fingerprint 变化、新增、恢复可用或关联 `UNRESOLVED` 的来源。
3. 产品行为变化 MUST 先更新 canonical `BLP/REQ`；纯 bug fix MAY 复用原 requirement refs。
4. 输出新的 `snapshot_id`、`handoff_ref`、source HEAD、seal freshness 和变更摘要。
5. 家族计划 MUST 标记哪些目标已消费旧版本、哪些目标需要 delta 对账。
6. Snapshot successor 本身 MUST NOT 推进任何目标的 `last_source_head`。

## Delta 与持续同步

- Source HEAD 未变化、只补充同一需求的验证证据时 MAY 生成 evidence-only successor，不生成新的产品需求。
- 产品行为新增、删除、纠正或恢复时 MUST 先生成继承旧需求的新 `BLP/REQ`，再生成 successor snapshot。
- 不改变产品契约的 bug fix MAY 复用原 `BLP/REQ`，但 snapshot 必须记录新的 source HEAD、根因和验收引用。
- Snapshot 更新不推进 `last_source_head`。交付检查点仍只由目标成功的 `VRF/REV` 或有证据的 `NO_CHANGE_REQUIRED` 推进。

## 最小交接输出

```yaml
schema_version: jj-same/handoff-snapshot/1.0
snapshot_id: HOF-password-reminder-001
parent_snapshot: null
feature: 密码更新提醒
created_at: 2026-07-14T16:00:00+08:00
handoff_status: READY_FOR_HANDOFF
execution_readiness: READY
seal_freshness: FRESH
source:
  repo: D:/codeup/chengjie/cj-frontend-web
  role: 承接前台
  ref: feat/cj-0717-3
  head: c0c360f9d
  thread_id: 019f...
canonical:
  anl_source_ref: ANL-...
  blueprint_ref: BLP-...
  requirement_refs: [REQ-001]
  family_plan_ref: PLN-...
source_inventory:
  - source_id: source-thread
    type: thread
    locator: 019f...
    fingerprint: last-event:U19
    status: AVAILABLE
requirement_ledger:
  must:
    - id: REQ-001
      requirement_ref: BLP-.../requirements/REQ-001.md
      status: CONFIRMED
  do_not_port: []
  unresolved: []
verification:
  commit_stable: true
  static_checks: PASS
  review: PASS
  user_test: PASS
target_candidates: []
```
