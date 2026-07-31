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

## 先对齐名词（项目族里怎么叫）

你们日常说的 **承接 / 兑接 / 承载** 是业务仓（前台、识票等）；**控制项目** 只记多仓调度状态，一般不在控制仓里跑 ralph 改业务代码。

| 你说的 | 是什么 | 例子（真实风格） |
|--------|--------|------------------|
| **承接** / 承接前台 | 业务仓之一（常当源仓领头） | 在承接仓里改「登录密码过期提醒」 |
| **兑接** / 兑接前台 | 同源分叉业务仓 | 从承接迁过去：`交接到 兑接` |
| **承载** / 承载识票 / 承载前台 | 另一同源仓 | `交接到 兑接 承载` |
| **控制项目** | 调度控制面所在仓（不是业务实现仓） | 里面是 delivery / task，不是 `RALPH-*` 业务实现 |
| **ralph 任务 / run_id** | **单仓** 闭环账本 id | `RALPH-login-reminder-20260722` |
| **能力 CAP** | 地图里的能力条目 | `CAP-login-reminder` |
| **REQ / TASK** | 一次 run 里的需求与实施任务 | `REQ-001`、`TASK-1`（提示条与改密入口） |
| **delivery / DEL-** | **多仓** 一次派发身份（dispatch） | `DEL-password`（预览分发到承接、兑接、承载） |
| **task_key / TASK-…**（调度） | 控制面上可恢复的派工任务号 | 与 ralph 里的 `TASK-1` **不是同一套编号** |
| **交接 / handoff** | 单仓做完后给 same 的迁移说明 | 人话说「交接到 兑接 承载」 |

**一句话：**  
- 只改 **当前打开的那个业务仓** → **ralph**（记下 `RALPH-…`）  
- 做好了要迁到兑接/承载 → **same**（读 handoff）  
- 要多个仓一起预览批准派工 → **dispatch**（`DEL-…` + 控制项目）

## 怎么说

**口语（点名业务仓 + 需求）：**

```text
$jj-ralph 先改承接：登录成功后密码过期要提示，只做登录成功那条路
```

```text
$jj-ralph 在兑接前台：活动 tip 再下移 2px（续 RALPH-activity-tip-down-4px-20260731）
```

```text
$jj-ralph 继续 RALPH-login-reminder-20260722
```

**写整齐一点（可选）：**

```text
$jj-ralph
当前项目=承接前台
目标=登录后密码过期提醒
范围=仅登录成功路径
验收=出现提示且可跳转改密
能力=CAP-login-reminder
```

未说项目时，默认就是 **你当前工作区这个仓**（例如已在承接前台目录里打开会话）。

## 大致会经历什么

```text
分析 → 计划 → 改代码 → 验收 → 归档
（例如 RALPH-login-reminder-20260722：TASK-1 识别 password_expired → TASK-2 提示条）
```

验收通过后会默认收尾归档。做完若要迁仓：

```text
交接到 兑接 承载
```

→ 走 [same](command-jj-same.html)，**不要**在控制项目里当业务实现仓硬做。

### 内部机制演示（可交互）

阶段门、强度档、改代码循环、停表、验收双层、相邻回退、归档后续作——用 SVG 点着看：

→ **[ralph 内部机制动画](milestones/ralph-demo.html)**（本地：`site/milestones/ralph-demo.html`）

## 强度档与对话示例（速度 × 质量）

不必手敲 CLI：用口语点名档位，agent 写入 `run.intensity`。未点名 = **standard**。

| 档 | 项目族里什么时候用 | 你会感受到 |
|----|-------------------|------------|
| **tiny** | 承接里单文件/单像素；已有 `RALPH-…` 只改一点 | 分析计划极短，尽快验收 |
| **standard** | 承接领头做完整能力（如登录提醒） | 正常计划 + 验证；无审查也可验收 |
| **strict** | 鉴权/协议；或做完要 **交接到兑接、承载** 怕迁歪 | 预算更紧；验收前多一道判断层（审查/复检） |

改代码时会记「有没有真改进」；连续两轮没改进会 **停表**，避免在承接仓空转。

### tiny — 单点（承接 / 兑接里的小改）

```text
$jj-ralph tiny：承接 order-operation-link 协议 URL 改用 zeroInterestBizAgreementUrl
```

```text
$jj-ralph 单点快做 兑接 @src/…/activity-tip：bottom 从 4px 改成 6px
```

```text
$jj-ralph tiny 继续 RALPH-activity-tip-down-4px-20260731：close 也下移 3px
```

**预期：** 短分析/计划 → 改 1 个文件 → 验证 → 验收。  
对照 agent 样例：`tiny-example.md`。

### standard — 常规（承接领头做完再交接）

```text
$jj-ralph 先改承接，登录后密码过期要提示，只做登录成功那条路
```

```text
$jj-ralph
当前项目=承接前台
目标=登录密码更新提醒
范围=登录成功路径；OUT=注册/找回/后台策略
验收=提示出现且可跳转改密
run 可记=RALPH-login-reminder-20260722
CAP=CAP-login-reminder
```

**预期：** 在 **承接** 闭环；`TASK-1`/`TASK-2` 齐、accept PASS 后 finalize。  
然后再说：

```text
交接到 兑接 承载
```

若要 **多仓一起预览批准**（不是 same 串行迁），换 [dispatch](command-jj-dispatch.html)，例如：

```text
$jj-dispatch 把密码过期提醒预览分发到 承接、兑接、承载
```

或：

```text
$jj-dispatch PREVIEW delivery=DEL-password 目标=承接前台,兑接前台,承载前台
```

注意：`DEL-password` 是 **调度交付号**；承接仓里的 `RALPH-login-reminder-20260722` 是 **单仓账本号**，两套 id 不要混着改文件。

### strict — 更严（怕迁到兑接/承载翻车）

```text
$jj-ralph strict：承接鉴权 token 刷新失败重登链路，验收要证据 + 审查过再归档
```

```text
$jj-ralph 严格模式 承接做 handoff 必带字段（must / do_not_port / targets=兑接,承载），
多方案先比再选，验收前 recheck，再交接到 兑接 承载
```

**预期：** 计划可写 2～3 路线；`accept` 前判断层 PASS（审查或 recheck）。  
中途加严：

```text
$jj-ralph RALPH-login-reminder-20260722 升到 strict，验收前必须 review
```

### 空转停表 / 换策略（仍在当前业务仓）

```text
$jj-ralph RALPH-login-reminder-20260722 换策略：先只接 password_expired 字段，提示条 UI 先 OUT
```

```text
$jj-ralph 退回 PLAN，范围缩成只做承接登录成功路径，兑接/承载先不碰
```

```text
$jj-ralph 先暂停 RALPH-login-reminder-20260722，等后端给 password_expired 样例
```

### 验收、复检、回退（带真实 run_id）

```text
$jj-ralph 按 RALPH-login-reminder-20260722 的 acceptance 清单验收
```

```text
$jj-ralph recheck RALPH-login-reminder-20260722：未过期用户不应出提示条
```

```text
$jj-ralph 验收不算，退回 DELIVER：RALPH-login-reminder-20260722 跳转改密 404
```

**strict 下** 判断层未过不能强行验收。  
已经归档了还要改：见下文——**新开** `RALPH-…`，在进度里写清和旧任务的关系，不要改旧归档目录。

### 一眼对照（项目族话术）

| 你怎么说 | 含义 |
|----------|------|
| 「先改承接 / 在兑接前台…」 | 点名 **业务仓**；ralph 只动当前仓 |
| 「tiny / 单点 / 只改 tip」 | 强度 tiny |
| （不说强度） | standard |
| 「strict / 审查后再归档 / 要交接兑接承载」 | 强度 strict 或加严验收 |
| 「继续 RALPH-login-reminder-20260722」 | 恢复 **单仓 run** |
| 「交接到 兑接 承载」 | 出 ralph，进 **same** |
| 「分发到 承接和承载识票 / DEL-password」 | 进 **dispatch**（控制项目记状态） |
| 「换策略 / 缩小范围」 | 解除停滞 |
| 「纠正 RALPH-… / 子需求续 RALPH-…」 | 已归档后新开任务并写关系（见下文） |

## 东西写在哪

**业务仓（承接 / 兑接 / 承载）里：**

```text
.workflow/ralph/
  business-map.json                              # 如 CAP-login-reminder
  RALPH-login-reminder-20260722/run.json         # 本仓主记录
  RALPH-login-reminder-20260722/progress.md      # 审计与续作链
  archive/…                                      # 归档冻结副本
```

**控制项目** 里一般是 dispatch 的 plane / `DEL-…` / 调度 `task_key`，**不是** 用 ralph 替代业务仓实现。

单仓做完后可以说「交接到 兑接 承载」，再交给 [same](command-jj-same.html)。

## 想回退时

直接说人话即可，例如：「验收不算，退回改」「先暂停」。

| 你想 | 会发生什么 |
| --- | --- |
| 退回继续改 | 退到**上一个相邻阶段**（已经归档的不能退） |
| 验收不过 | 验收记成失败，继续改 |
| 先暂停 | 任务标记暂停 |
| 已经归档了还要再做 | **新开一个任务**，不要改旧归档目录 |

默认 **不会** 自动 `git revert`。要提交、合分支用 [end](command-jj-end.html)。

下面专门讲：**写错了怎么接着改**、**还要加点功能怎么接着做**。

## 做完了还要改 / 还要加东西

### 先搞清：任务「还没归档」还是「已经归档」

| 状态 | 人话 | 怎么办 |
| --- | --- | --- |
| 还在分析 / 计划 / 改代码 / 验收 | **还没归档** | 尽量在**同一个任务**（同一个 `RALPH-…` 目录）里继续 |
| 已经验收通过并归档 | **已经归档** | **不能**把旧任务改回「进行中」；要 **新开** 一个 `RALPH-…`，并在进度里写上和旧任务的关系 |

为什么要分这么清？  
已经归档的验收结果是「当时那一版」的事实，不能偷偷改掉；业务上还算同一件事时，用「新任务 + 写明跟旧任务的关系」接上。

### 关系写在哪

写在该任务目录的 **`progress.md`** 里（随便哪一行审计记录都行，首行或最后追加都行）。

| 你要表达 | 在 progress 里写 | 别写错成 |
| --- | --- | --- |
| 旧的做错了，**这一版纠正它** | `supersedes_run_id: RALPH-旧编号` | 纯加功能时别用这个 |
| 旧的还有效，**只是多做一块** | `parent_run_id: RALPH-旧编号` | 纠正旧实现时别用这个 |

**不要**往 `run.json` 里瞎加这两个字段（schema 不允许）。

### 还没归档：改错了

| 情况 | 你怎么说 / 怎么做 |
| --- | --- |
| 代码写错了，还没验过 | 继续改，进度里记一笔，再验 |
| 验收误通过了 | 「验收不算」或退回改代码阶段 |
| 计划写歪了导致做错 | **一步一步**往回退（验收→改代码→计划→分析），不能一次从验收跳回分析 |
| 要停一下 | 「先暂停」 |

```text
$jj-ralph 上一版写错了，退回改：…
$jj-ralph 继续 RALPH-xxx：纠正验收没过的点
```

### 还没归档：还要加一点功能

在**同一个** `RALPH-…` 里加即可：分析加一条需求、计划加任务、改范围，最后**一次验收**盖住原来的 + 新增的。

若**验收已通过但还没点归档**：先说「验收不算」或退回改代码，改完再验。别在已经通过的验收上偷偷加项。

```text
$jj-ralph 当前任务再加：close 按钮也下移 3px
```

**不要**为这一点小事再随便开一个无关的新 `RALPH-…`。

### 已经归档：改错了

旧目录保持归档不动。新开任务，标题带「纠正」，进度里写：

```text
supersedes_run_id: RALPH-旧编号
```

分析只写「相对旧版差在哪」，轻量改 → 再验收 → 再归档。

```text
$jj-ralph 纠正 RALPH-activity-tip-down-4px-20260731：bottom 应是 6px 不是 8px
```

要改掉错误代码：在**新任务**里改；默认不会自动 `git revert`。

### 已经归档：还要加子功能

旧任务仍算有效。新开任务，进度里写：

```text
parent_run_id: RALPH-旧编号
```

新任务**只验收新增部分**；旧功能可写「已在父任务验收」。

```text
$jj-ralph 子需求续 RALPH-xxx：close 下移 3px
```

**纯加功能不要用** `supersedes_run_id`（那表示「旧版作废、以新版为准」）。

### 一张表看清

| 场景 | 还没归档 | 已经归档 |
| --- | --- | --- |
| **改错了** | 同一 `RALPH-…` 里退回 / 再改 | 新 `RALPH-…` + `supersedes_run_id` |
| **加功能** | 同一 `RALPH-…` 里加需求 / 任务 | 新 `RALPH-…` + `parent_run_id` |
| **禁止** | — | 把已归档改回进行中；加功能却写成 supersedes |
| **怎么说** | 「退回改…」「当前任务再加…」 | 「纠正 RALPH-…」「子需求续 RALPH-…」 |

**一句话：**  
还没归档 = 同一个文件夹接着做；已经归档 = 新文件夹，在 `progress.md` 写清楚跟旧任务是「纠正」还是「儿子」。

## 相关

[术语](glossary.html) · [same（迁到兑接/承载）](command-jj-same.html) · [dispatch（多仓一起派）](command-jj-dispatch.html) · [踩坑](pitfalls.html) · [上手](usage.html) · [设计（深）](design-docs/jj-ralph.html)
