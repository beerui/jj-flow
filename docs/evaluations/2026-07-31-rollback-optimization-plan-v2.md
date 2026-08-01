# Optimization plan v2 — dispatch rollback（控制面 + Git 用户点选）

> Status: **implementing → promoted in tree**（P0–P2 已落地：session share + prepareModeSReopen + G-menu skill；R4 helper 仍后置）
>
> Basis:
> - `docs/evaluations/2026-07-31-readme-pnpm-rollback.md`
> - 用户裁决：分支/提交干净且仅本地时，**reset 往往优于 revert**；**策略必须用户决定**
>
> Parent exec plan: `docs/exec-plans/completed/2026-07-31-dispatch-ralph-rollback.md`
>
> Non-goals: 自动 force-push、自动 unmerge `dev`、自动改线上、Agent 替用户选定 git 手段

---

## 0. 相对 v1 的修订点

| v1 | v2 |
| --- | --- |
| 代码回退默认叙事偏 `git revert` | **无默认 git 动作**；探测后给选项，用户点选 |
| 未区分「仅本地 tip」vs「已 push」 | **前置探测矩阵**决定可选项与推荐项 |
| 优化主刀仅 R-soft-reopen | 主刀仍 **R-soft-reopen**；并行规格化 **Git 决策菜单 G-menu**（skill 文案，可不改 git 执行器） |
| 已发生 path B = revert 当作金样 | 金样保留为 **「用户选了 append 纠正」**；另记 **「更优反事实 = reset」** 作 search 标签 |

---

## 1. 问题陈述（两层）

### 1.1 控制面层

Mode S 软 plane 无法直接走严格 `reopenTarget`（共享 session + 软字段）→ Agent 易 ad-hoc / 手改 JSON。

### 1.2 Git 策略层

| 误区 | 纠正 |
| --- | --- |
| 「回退代码 = revert」 | 仅是 **一种** 追加式手段 |
| 「安全 = 必须留 A+Revert」 | **未 push 的 tip** 上，reset 更干净且同样不影响线上/其他分支 |
| Agent 替定 B | **必须用户点选**；Agent 只探测 + 推荐 + 执行 |

**本 episode 反事实：**  
三仓相对 origin **ahead 1**、tip 即本任务提交、未进 `dev` → **reset HEAD~1 比 revert 更优**（历史无噪音、ahead 回 0）。当时 revert 安全但非最优雅。

---

## 2. 目标与非目标

### 目标

1. 控制面 reopen **可机械、可测**（Mode S 可吃）
2. Git 回退 **决策 UX 标准化**：探测 → 选项表 → 用户确认 → 再执行
3. 在「干净本地 tip」场景 **推荐 reset**，不误导成必须 revert
4. 双层真相：plane 与 git **同向**，但允许「只回 plane、不动 git」

### 非目标

- Agent 默认执行任何 git rewrite / revert
- 自动 push / force-push / 合 dev / 拆 merge
- 把 live `/portfolio` 写进 harness 必跑路径

---

## 3. 数据划分

| Split | 用途 |
| --- | --- |
| **search** | Mode S 软 plane reopen；本地 tip reset 推荐逻辑；菜单文案 |
| **holdout** | 已合 dev；远程 feature 已 push 且多人协作；merge commit |
| **regression** | 禁止无确认 git；Codex thread 不共享；self-check 假 VERIFIED；path B 安全（无 force） |

Leakage：设计菜单时 **不** 用 holdout「已合 dev」样本的事后结果调推荐权重。

---

## 4. 方案总览（两刀，顺序固定）

```text
刀 1（库/skill，优先实现）  R-soft-reopen
  → 解决「控制面 reopen 机械失败」

刀 2（skill/UX，可同 PR 文案） G-menu
  → 解决「git 用 reset 还是 revert 谁说了算」
  → 本迭代可不写执行脚本；先规格 + Agent 话术
  → R4 再把探测/建议包做成可测 helper（仍不默认执行）
```

一次实现 PR 建议：**R-soft-reopen 代码 + G-menu 写入 rollback.md**；R4 helper 可第二 PR。

---

## 5. 刀 1 — R-soft-reopen（控制面）

与 v1 相同核心，摘要如下。

### 5.1 校验：Mode S session 共享

允许多 intent 同 `thread_id` **仅当**：

- `host_id === 'grok-build'`
- `handle_kind === 'session'`
- 各方 host/handle 一致  

**不**放宽 Codex `thread`。

### 5.2 最小 prepare + `reopenTarget`

- 软 `DONE`/`BOUND` 收口为合约终态  
- 物化 checkpoint 审计  
- 再 `reopenTarget`（event + attempt++ + PREVIEW_ONLY）

### 5.3 验收

- 软共享 session fixture：`validate` OK + `reopenTarget` OK  
- 既有 reopen/block/rework 绿  
- `npm run verify` 绿  

---

## 6. 刀 2 — G-menu（Git 决策菜单）**【v2 重点】**

### 6.1 原则

| # | 原则 |
| --- | --- |
| G1 | **无用户确认，不改 git** |
| G2 | 控制面 reopen 与 git **解耦**：可先只 reopen |
| G3 | Agent **探测 → 填表 → 推荐（标注 Recommended）→ 停等用户** |
| G4 | 推荐不是执行；用户可改判 |
| G5 | 已合 integration：**禁止** reset/force；只给 revert/fix-forward |

### 6.2 执行前探测（每仓）

| 探测项 | 命令/事实 | 用途 |
| --- | --- | --- |
| `branch` | 当前 feature | 展示 |
| `tip_sha` / `task_shas[]` | 本任务 produced_commit 列表 | 范围 |
| `ahead_of_upstream` | 相对 `@{u}` 或 origin/branch | 是否仅本地 |
| `tip_is_task_only` | tip 是否 ∈ task_shas 且无夹带他人提交 | 能否 reset 一刀 |
| `on_integration` | task_sha 是否 ancestor of dev/develop/main | 能否 reset |
| `dirty` | 工作区是否脏 | 先停 |
| `pushed` | ahead==0 且 tip 在 origin **或** tip 已在 origin 历史上 | 是否允许 reset |

**推荐规则（确定性，给用户看）：**

```text
if dirty → 只提示先处理脏区；禁止静默 reset
elif on_integration → 选项：revert | fix-forward | 取消（禁止 reset）
elif pushed && !user_allows_force → 选项：revert | 取消（reset 需显式 force 风险确认）
elif ahead>=1 && tip_is_task_only && !on_integration → 选项：
      reset（Recommended）| revert | 保留代码 | 取消
else → 选项：task-scoped revert | 保留代码 | 取消
```

### 6.3 用户选项表（标准话术）

控制面 reopen **之后**（或同时展示，但 git 仍等确认）：

```text
【Git 怎么处理？】探测摘要：
- project-b  feat/…  tip=…  ahead=1  on_dev=no  tip=本任务  dirty=no
- pc-…    …
- pa-…    …

请选一项（可按仓不同，默认三仓同一策略）：

[1] 仅控制面回退，代码保留
[2] 本地丢弃 tip（reset）— Recommended：未 push 且 tip 即本任务
[3] 追加 revert 提交 — 已 push / 要留审计时用
[4] 取消 git 动作

说明：
- [2][3] 都不影响 dev/main（本探测 on_dev=no）
- [2] 历史最干净，一般无需 push
- [3] 历史留 A+Revert；未 push 时通常不必选 [3]
```

### 6.4 与「路径 A/B/C」旧叙事对照

| 旧 | 新 G-menu |
| --- | --- |
| A 只 plane | **[1]** |
| B 代码也撤（曾默认 revert） | **拆成 [2] reset / [3] revert** |
| C 放弃 delivery | plane 停 PREVIEW + **[1]** 或再加 abandon 文案 |

### 6.5 执行边界（Agent）

| 选项 | 允许命令 | 禁止 |
| --- | --- | --- |
| [1] | 无 git | — |
| [2] | `git reset --hard <pre-task>` 或 `HEAD~n`（n=连续 tip 任务提交数） | force-push；跨仓盲 reset |
| [3] | `git revert <task_sha…> --no-edit` | reset；force-push |
| 已合 dev | 仅 [3] 或 fix-forward | [2] |

执行后：写 plane event（建议）`GIT_ROLLBACK_RESET` / `GIT_ROLLBACK_REVERT` + task progress；**默认不 push**。

### 6.6 R4 关系

| 阶段 | 交付 |
| --- | --- |
| 现在（G-menu skill） | 探测清单 + 选项表 + 推荐规则写进 `rollback.md` |
| R4 | `rollbackPrep(plane|commits)` 输出：可选项、Recommended、建议命令；**仍不执行** |
| R4.1 | 可选 CLI dry-run；执行仍 Agent+用户 |

---

## 7. 端到端回退流程（v2 标准）

```text
1. 用户：「回退 DEL-…」
2. 读 plane + plane-self-check；备份 plane
3. R-soft-reopen：prepare + reopenTarget（双目标…）
   → PREVIEW_ONLY, attempt++, TARGET_REOPENED
4. 每仓 Git 探测表
5. 展示 G-menu；**停**
6. 用户点选 [1]/[2]/[3]
7. 仅执行所选；写 progress + 可选 GIT_* event
8. 报告：plane 状态、各仓 tip、是否需 push（默认否）
9. 不自动 PREVIEW 再派 attempt/2（除非用户要重做）
```

---

## 8. 对本 episode 的复盘与可选补救

| 项 | 状态 |
| --- | --- |
| 已做 | soft reopen + **revert**（用户当时选旧 B） |
| 更优反事实 | 当时 **reset HEAD~1**（ahead 1、未 push） |
| 现在若用户要干净历史 | 在 **仍未 push** 前提下，用户可再选：每仓 `reset --hard HEAD~2` 去掉「原提交+revert」 |
| 是否 Agent 自动做 | **否**，需再确认 |

---

## 9. 实现分期

| Phase | 内容 | 产出 |
| --- | --- | --- |
| **P0** | 校验 session 共享 + 测试 | Mode S plane validate |
| **P1** | prepare + reopenTarget 接入 + 测试 | 软 VERIFIED 可 API reopen |
| **P2** | `rollback.md`：**G-menu** + Mode S reopen 步骤 | Agent 话术 SSOT |
| **P3** | verify + CHANGELOG + eval 链到 v2 | promote 候选 |
| **P4**（可选下 PR） | R4 `rollbackPrep` 探测实现 | 建议命令 JSON，不执行 |

---

## 10. 风险

| 风险 | 缓解 |
| --- | --- |
| 用户误选 reset 且已 push | 探测 `pushed` 时 **不把 reset 标 Recommended**；需二次确认 force |
| 用户误以为 revert 影响线上 | 菜单写明 on_dev / ahead |
| 只 reset 不 reopen | 流程强制先/同会话完成控制面，或明确警告双层分裂 |
| Codex 误用 session 共享 | host/handle 双门禁 |

---

## 11. 晋升门禁

- [ ] Mode S 软 plane 可机械 reopen  
- [ ] skill 含 G-menu 与推荐规则  
- [ ] 文案明确：**未 push + tip 干净 → Recommended = reset**  
- [ ] 无自动 git；无默认 revert  
- [ ] regression 合约绿  

---

## 12. 决策请求（v2）

| 问题 | 建议答案 |
| --- | --- |
| 采用 v2（G-menu 替换默认 revert 叙事）？ | **是** |
| 下一实现 PR 范围？ | **P0–P2**（代码 reopen + skill 菜单） |
| 是否立刻把三仓改成 reset 干净历史？ | **仅当用户再确认**；与方案实现无关 |
| R4 探测代码？ | **第二 PR** |

---

## 13. 一句话

**控制面要能自动 reopen（R-soft-reopen）；代码怎么抹，用探测表 + 用户点选（干净本地 tip 推荐 reset，已推/已合才 revert）——Agent 不替用户决定。**
