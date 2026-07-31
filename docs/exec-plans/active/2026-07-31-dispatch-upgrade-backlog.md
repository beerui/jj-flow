# Exec plan — Dispatch / Mode S 升级 backlog（存档 · 留待升级）

> 状态：blocked
>
> 阻塞原因：**留待升级窗口**；不阻塞日常 Mode S 分发。恢复时将状态改为 `active` 并勾选本波次。
>
> 负责人：jj-flow dispatch（skill + 可选 schema）
>
> 开始日期：2026-07-31
>
> 归档来源（会话评估，勿当控制面真相）：
> - `docs/evaluations/2026-07-31-readme-pnpm-dispatch.md`（金样闭环）
> - `docs/evaluations/2026-07-30-acceptor-tag-color-dispatch.md`（integrity 负例）
> - `docs/exec-plans/active/2026-07-30-grok-dispatch-execution.md`（Mode S Phase 2a 已 live）
> - `docs/exec-plans/active/2026-07-31-dispatch-ralph-rollback.md`（回退另线，本表只交叉引用）
>
> 边界：
> - **不**改业务仓、不自动 push/merge
> - **不**回写历史 acceptor-tag plane 伪装绿
> - **不**把本机 `D:/a/dispatch-control` 扫进 harness-manifest
> - 用户不跑 CLI；一次升级只推一个候选

---

## 1. 背景（已落地 · 勿重复做）

| ID | 项 | 状态 | 证据 |
| --- | --- | --- | --- |
| C1 | project-branch 默认 | promoted | skill + host-action-contract |
| C2 | 分支/workspace 不确定先问 | promoted | PREVIEW NEEDS_CONFIRM |
| C3 | VERIFIED 需 produced_commit；plane-self-check | promoted | beta.38 + skill |
| Mode S 2a | Grok 单会话 + attestation/receipt 规格 + live | **live OK** | `DEL-readme-pnpm-install-20260731` self-check OK |

**金样（regression 保护）：** readme-pnpm Mode S 路径。  
**负样（integrity）：** acceptor-tag 合成 session / 无 produced_commit。

---

## 2. 升级候选队列（按建议顺序）

恢复本计划后，**默认从上到下只开一条**。

### U1 — C4 Review attestation 文件化（优先 · 小）

| 项 | 内容 |
| --- | --- |
| 问题 | review intent 的 `sandbox_evidence_ref` 常为 `host:grok-build:session:…` 字符串，与 development 的 `attestations/*.json` 不一致 |
| 改动 | skill `grok-dispatch-execution` + Mode S 清单：read 责任也写 `attestations/{task_key_safe}.json`；可选 plane-self-check 对 BOUND review 检查文件存在 |
| 验收 | 新 delivery 四 intent 均有 attestation 文件；合约/自检不回归 readme 金样 |
| 风险 | 低 |
| 依赖 | 无 |

### U2 — C6 `remote_closeout` 可选标注（小）

| 项 | 内容 |
| --- | --- |
| 问题 | VERIFIED 后仍 `ahead 1` 未 push；用户分不清「控制面闭环」与「远端闭环」 |
| 改动 | delivery 可选字段或 task/result 约定：`remote_closeout: { pushed?, merged_to?, at? }`；**不**挡 VERIFIED |
| 验收 | skill 文档 + 一例；schema 若加字段须 harness 对齐 |
| 风险 | 低～中（schema 则合约测试） |
| 依赖 | 无；可与 U1 串行 |

### U3 — C5 integrity_grade（中）

| 项 | 内容 |
| --- | --- |
| 问题 | plane 可标 VERIFIED 但 self-check FAIL（acceptor 假绿） |
| 改动 | 可选 `integrity_grade: ok \| degraded \| fail` 或 events 记 self-check；Agent 写 VERIFIED 前跑 self-check |
| 验收 | fixture：假 VERIFIED → grade fail；readme 路径 → ok |
| 风险 | 中（字段权威、与 runtime validate 关系） |
| 依赖 | 建议 U1 后；与 rollback reopen 协同 |

### U4 — Rollback R1+（另计划主责）

| 项 | 内容 |
| --- | --- |
| 指针 | **主计划** `2026-07-31-dispatch-ralph-rollback.md` |
| 本 backlog 角色 | 勿重复实现；升级窗口若先做 reopen 误 VERIFIED，从 rollback 计划勾选 R1/R2 |
| 依赖 | 独立 |

### U5 — Mode S 残留（原 2b/2c/3）

| 项 | 内容 |
| --- | --- |
| Mode W | isolation exclusive-worktree 完整 bind/cleanup |
| Mode P | 多 session 1:1（后置，无假 session） |
| Host Wave 2 | `real-host-trial-grok.json`；见 `grok-host-adapter` Proposed |
| 指针 | `2026-07-30-grok-dispatch-execution.md` Phase 2b–3 |
| 本 backlog 角色 | 交叉引用；大块升级另开窗口 |

### U6 — 明确不做（存档备忘）

- harness 扫描本机 control_root  
- 回写 acceptor-tag 历史 plane 变绿  
- 默认自动 unmerge / force push  
- 用户 CLI 作为收口必经路径  

---

## 3. 数据集保护（升级时）

| Split | 样本 | 规则 |
| --- | --- | --- |
| regression | readme-pnpm Mode S；C1/C2/C3；源 commit PREFLIGHT | 任何升级不得使 self-check 金样变红 |
| search | acceptor integrity FAIL；C4/C5 设计 | 可改 skill，勿当成功训练 |
| holdout | 下一波 Mode W 或真 Host trial | 未发生前不调参 |

---

## 4. 恢复升级时的检查单

```text
[ ] 将本文件状态 blocked → active
[ ] 选定唯一 U#（默认 U1）
[ ] 读金样 evaluation + 负样 evaluation
[ ] 改 .codex/skills SSOT（勿只改 ~/.grok）
[ ] 合约测试 + plane-self-check + npm run verify
[ ] jj install-skill --platform all --force
[ ] 可选：beta 发版（Actions NPM Publish，run_verify=true）
[ ] 完成后勾选 U#；若队列清空且 2b/3 仍 open，保持 blocked 或并入 Mode S 计划
```

---

## 5. 决策日志

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-07-31 | 会话进化项整包存档为 blocked backlog | 金样已闭环；避免未评审连改 C4–C6 |
| 2026-07-31 | 默认下一刀 U1（C4） | 最小、对齐 development attestation |
| 2026-07-31 | harness-manifest 不因闭环而改 | control_root 非仓内资产；self-check 留 skill |
| 2026-07-31 | rollback / Mode W·P 不并入本文件实现 | 已有独立 active 计划 |

---

## 6. 完成定义（本文件）

当且仅当：

- U1–U3 均 **完成或明确取消**（决策日志记取消理由），且  
- U4/U5 仅保留指针、无未勾选「本文件承诺交付」项  

→ 将状态改为 `completed`，移入 `docs/exec-plans/completed/`，更新索引。

**当前：** 全部 U1–U3 **未开工** → **blocked · 留待升级**。
