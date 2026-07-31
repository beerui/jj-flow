# ralph — 只改当前这一个仓库

在 **当前业务仓库** 里：把需求做完 → 验收 → 归档，并留下可查记录。

| 工具 | 怎么喊 |
|------|--------|
| Codex | `$jj-ralph` |
| 其他 | `/jj-ralph` |

请用 **对话** 推进，不要手敲命令行。

## 什么时候用

- 只动 **这一个** 仓库  
- 希望有完整记录：分析、计划、改动、验收  
- 你说「做完这个需求 / 全流程 / 闭环」  

**别用 ralph：** 要搬到别的仓库 → [same](command-jj-same.html)；要多个仓库一起派 → [dispatch](command-jj-dispatch.html)

## 怎么说

**口语：**

```text
$jj-ralph 票面预览关闭按钮点了没反应
```

```text
$jj-ralph 先改承接，登录后密码过期要提示，只做登录成功那条路
```

```text
$jj-ralph 继续
```

**写整齐一点（可选）：**

```text
$jj-ralph
目标=登录后密码过期提醒
范围=仅登录成功路径
验收=提示出现且可跳转改密
```

## 大致会经历什么

```text
分析 → 计划 → 改代码 → 验收 → 归档
```

验收通过后会默认收尾归档。

## 东西写在哪

```text
.workflow/ralph/
  business-map.json          # 能力地图（方便下次找）
  RALPH-…/run.json           # 这一次任务的主记录
  archive/…                  # 归档副本
```

做完后可以说「交接到 兑接 承载」，再交给 [same](command-jj-same.html) 去别的仓实现。

## 想回退时

直接说清楚意图即可，例如：「验收不算，退回改」「先暂停」。

| 你想 | 结果 |
|------|------|
| 退回继续改 | 退到相邻阶段（归档后不能退） |
| 验收不过 | 验收记失败 |
| 暂停 | 任务标记暂停 |
| 已经归档还要再做 | **开一个新任务**，不要改旧归档 |

默认 **不会** 自动 `git revert`。要提交/合分支用 [end](command-jj-end.html)。

「改错 / 加子需求」续作细则见下一节（**含关账前同 run 与关账后新 run 链**）。

## 1. 续作：改错与子需求（关账前 / 关账后）

一次 ralph 可能在**验收归档前**就要改错或加子项，也可能在**已归档后**继续。先分清两层「统一任务」：

| 概念 | 含义 |
|------|------|
| **统一任务（账本）** | 同一个 `run_id` 目录 + 同一套 gates |
| **统一任务（业务）** | 同一需求族（用 progress 链字段串起来） |

**分界：有没有 ARCHIVE / COMPLETED。**

```text
未 COMPLETED  → 可以「同一个 run_id」里继续改 / 加子需求
已 COMPLETED  → 不能 reopen 旧目录；用「新 run + 链回旧 run」保持业务上同一任务
```

协议刻意区分这两种「统一」，避免已经验收通过的证据被改写。

**关联怎么记（写在 `progress.md` 审计行——首条关联行或最近追加行均可；不要 invent 未 schema 的 run.json 字段）：**

| 键 | 何时 |
|------|------|
| `supersedes_run_id: RALPH-…` | 纠正 / fixup，或明确「当前有效实现替代上一版」 |
| `parent_run_id: RALPH-…` | 纯子需求增量；父 run 仍有效 |

```text
                    ┌─ 改错 ──────────► 同 run 按相邻边回退/重做
  IN_PROGRESS ──────┤
                    └─ 加子需求 ──────► 同 run 扩 REQ/TASK
                           │
                      accept + finalize
                           ▼
                      COMPLETED (A)
                           │
          ┌────────────────┼────────────────┐
          │ 改错                           │ 加子需求
          ▼                                ▼
   Run B supersedes_run_id=A       Run B parent_run_id=A
   （纠正型 delta）                  （子级 delta；勿误用 supersedes_run_id）
```

可选：像素/视觉类可先停在「等用户确认」再归档，减少过早 COMPLETED。

不进 ralph、只在会话里改代码 → 代码可能对，但 **账本不会跟上**；要以 `.workflow/ralph` 为事实源时，下面两条都走 ralph。

### 1.1 修改错了，如何在统一任务下继续修改

目标：MUST 没变或只是实现偏了，在同一任务叙事下修。

#### 未关账（还在实施/验收，未 COMPLETED）

**同一 `run_id` 内处理。**

| 情况 | 动作 |
|------|------|
| 代码写错、验收还没过 | 留在实施阶段，改代码，进度里记一笔，再验 |
| 验收误通过 | 说「验收不算」→ 验收记失败，或退回实施阶段 |
| 分析/计划写错导致做错 | **逐步**退回：只能相邻阶段（验收→实施→计划→分析），不能一次从验收跳到分析；再改文档交付 |
| 要暂停讨论 | 说「先暂停」 |

**怎么说：**

```text
$jj-ralph 上一版写错了，退回 DELIVER 改 …
```

```text
$jj-ralph 继续 RALPH-xxx：纠正 …（验收 FAIL 的点）
```

→ **统一任务 = 同一个 run_id。**

#### 已关账（COMPLETED / 已归档）

**不能**把旧任务改回「进行中」。业务上仍算同一任务时，用 **纠正型新 run**：

```text
旧 Run A  COMPLETED  （错误实现也作为「当时验收过」的事实保留）
新 Run B  COMPLETED  supersedes_run_id → A
  目标: 纠正 A：…
  分析: 只写相对 A 的纠偏差量
```

| 步骤 | 做什么 |
|------|--------|
| 1 | 开新 run（标题带「纠正 / fixup」） |
| 2 | 在 `progress.md` 审计行写 `supersedes_run_id: RALPH-…`（旧 id） |
| 3 | 分析只写差量，不重写整份背景 |
| 4 | 轻量实施 → 验收 → 归档 |
| 5 | 需要收工再用 [end](command-jj-end.html) |

**怎么说：**

```text
$jj-ralph 纠正 RALPH-activity-tip-down-4px-20260731：bottom 应是 6px 不是 8px
```

→ **统一任务 = 需求族 A←B，不是同一目录。**  
若还要撤错误代码：在新 run 的实施里改/revert；默认 **不会** 自动 `git revert`。

### 1.2 新增子级需求，如何在同一个任务下继续新增

目标：父需求已做（或在做），再加 sibling/child（例如标签下移后再加 close 下移）。

#### 未关账（父 run 尚未 COMPLETED）

**同一 `run_id` 扩范围（推荐）。**

| 步骤 | 做什么 |
|------|--------|
| 1 | 分析里加 `REQ-002`（子需求） |
| 2 | 计划里加对应 TASK |
| 3 | 更新范围（多出来的文件） |
| 4 | 接着实施新 TASK |
| 5 | **一次验收**覆盖父项 + 子项 |

若 **验收已通过、但还没归档**：先说「验收不算」或退回实施阶段，改分析/计划/范围后再验（不要在已 PASS 的验收上直接 silently 加项）。

**怎么说：**

```text
$jj-ralph 在当前 run 增加子需求：close 按钮也下移 3px
```

**不要**再另起一个全新无关 run。  
→ **统一任务 = 同一个 run_id，多 REQ/TASK。**

#### 已关账（父 run 已 COMPLETED）

父账本已冻结；子需求是 **新版本工作**，仍挂在同一业务任务下：

```text
Run A  父需求 COMPLETED
Run B  子需求 COMPLETED  parent_run_id → A
  MUST: 仅子需求
  OUT:  不重做父需求已验收项（除非冲突）
```

| 写法 | 含义 |
|------|------|
| `parent_run_id` | **纯子需求**：B 是 A 的增量，A 仍有效（推荐） |
| `supersedes_run_id` | **仅纠正/替代**：B 成为当前有效实现；**不要**给纯子需求随便用 |

**怎么说：**

```text
$jj-ralph 子需求续 RALPH-xxx：close 下移 3px
```

```text
$jj-ralph 子需求（续 RALPH-activity-tip-down-4px-20260731）：close 按钮也下移 3px
```

→ **统一任务 = 父 run + 子 run 链，不是 reopen 父目录。**  
验收只验子项；父项可标 N/A「已由父 run 验收」。

### 对照速查

| | **改错** | **新增子级需求** |
|--|----------|------------------|
| **未 COMPLETED** | 同 run：相邻边回退 / 再实施 | 同 run：加 REQ + TASK |
| **已 COMPLETED** | 新 run + `supersedes_run_id` | 新 run + `parent_run_id` |
| **禁止** | 手改 COMPLETED → 进行中 | 无关联地 init；纯子需求误用 `supersedes_run_id` |
| **话术** | 「纠正 RALPH-xxx：…」 | 「当前任务加…」或「子需求续 RALPH-xxx：…」 |

**一句话：**  
关账前，同一个任务 = **同一个 run_id**；关账后，同一个任务 = **同一需求族上的版本链**，不要把已归档目录重新打开改。

## 相关

[踩坑](pitfalls.html) · [上手](usage.html) · [设计（深）](design-docs/jj-ralph.html)
