# ralph — 只改当前这一个仓库

**它帮你做什么：** 你在自己的业务仓库里用一句话说需求，Agent 把这个需求从 **分析 → 计划 → 改代码 → 验收 → 归档** 做完，并把过程记录留在仓库里，随时能核对、能接着改。

**它不做什么：** 不 commit、不 push、不合分支（收工用 [end](jj-end.md)）；不碰别的仓库（迁到别的仓用 [same](jj-same.md)）。

| 你用的工具 | 写法 |
|------------|--------|
| Codex | `$jj-ralph …` |
| Claude / Grok / Qoder | `/jj-ralph …` |

下面示例统一写 `$jj-ralph`，其他工具把前缀换成 `/` 即可。

## 什么时候用

- 需求只涉及 **当前这一个仓库**
- 你希望做完之后有东西可查：改了什么、为什么、验收怎么过的

**不该用 ralph 的情况：**

| 你想做的 | 去这里 |
|----------|--------|
| 把项目A 做好的能力搬到项目B / 项目C | [same](jj-same.md) |
| 多个项目一起派、一起盯 | [dispatch](jj-dispatch.md) |
| 只想提交代码、合进 dev | [end](jj-end.md) |
| 把当前仓加进全局项目地图 | [init](jj-init.md) |

## 开始前

1. 在 **业务仓库的根目录** 打开对话（不是调度用的控制仓）
2. 切到这个需求该用的分支——ralph 在你当前所在的分支上改，不会替你切
3. 已经[安装](../installation.md)了 skill

安装完成后，Agents 宿主侧的技能文件位于 `~/.agents/skills`；需要刷新旧副本时运行 `jj install-skill --platform agents --force`。

已知当前任务时，Agent 作为 team-lead 读 `index.md` 和 `task_plan.md`，写派单并 spawn 子代理去做。spawn 前先在聊天里说这一步在做什么（例如「派遣前端开发实现任务」「派遣 reviewer 审查改动代码」），不要静默等待。不要打开 skill 手册当作启动清单，也不要执行 `ralph_ops` / `jj ralph`。人读合同仍是 Goal / 验收 / Steps，验证写进 `progress.md`。

## 第一次这样用

**你说：**

```text
$jj-ralph 先改项目A：登录成功后如果密码过期要弹提示，只做登录成功那条路
```

**Agent 会做：**

1. **对齐**——确认目标和“怎样算做完”（验收项），写入短合同。主对话是 team-lead，不在这里改业务代码
2. **计划**——列出要改哪些文件、分几步（给派单用）
3. **派单实施**——每轮写一份 `ASSIGNMENT-TASK`（读这些/交付必须是精确文件），spawn 前先说 **派遣前端开发实现任务**（「按审查改」则写 **派遣按审查改**），再 spawn `jj-implementer` 子代理（缺失则 `general-purpose`；`description` 以 `[implementer]` 开头）去做；同一对话、同一仓库里上一轮实施执行人已结束 → `resume_from` 那个 id，不要冷启动。换审查员或换仓库就新开。prompt 禁止 Start broad / 全仓 grep。子代理先确认再开工，做完带证据回报主进程。这一轮结束后停，等下一轮，不连做 Task n+1
4. **审查（大功能）**——验证通过后写改动摘要，spawn 前先说 **派遣 reviewer 审查改动代码**，再 spawn `jj-reviewer`（缺失则 `general-purpose`；`description` 以 `[reviewer]` 开头）。审查还在跑时不要再派交接执行人。本轮只有文案/样式、以及小改，跳过审查。审查结论写在 `findings.md`，不执行 `review-record`
5. **你验收**——审查 `[OK]`/`[WARN]` 之后等你测过，再对照验收项收口
6. **归档**——记录定稿，任务目录移入 `completed/`

一轮一派单，子代理汇报后停。大功能审完要等你验收，不会直接收工。还会停下来的情况：分析时或 MUST / 范围 / 验收事后仍确认不了（先问，不要凭猜测推进）、你说了“先不写代码”、要做不可逆的事（如推送）。

**你会看到：** 先看到聊天里的派遣进度（「派遣前端开发实现任务」「派遣 reviewer 审查改动代码」），然后仓库里多出一个目录 `.workflow/ralph/task-…/`，里面给人看的文件：

| 文件 | 里面是什么 |
|------|-----------|
| `task_plan.md` | 目标、验收项、步骤（当前版本，不堆历史） |
| `progress.md` | 按日期追加的过程记录：做了什么、卡在哪 |
| `findings.md` | 改动摘要、实际踩过的坑、可复用的结论 |
| `assignments/` | 每轮派单：`ASSIGNMENT-TASK` / `ASSIGNMENT-REVIEW` / `ASSIGNMENT-FIX` |

**怎样算做完：** 大功能过审且你验收通过后归档——目录已在 `.workflow/ralph/completed/` 下，Agent 给你一段短报告（任务名、验收结果、可复用结论）。归档时可复用结论会记到你本机 `~/.jj-flow/memory/`，下次同一项目开任务会自动带上。投喂全局知识库只在你主动提出时进行。

> 聊天里说“做完了”不算数。算数的是任务目录里的记录和 `git diff`。

## 常用说法

**开一个需求**

```text
$jj-ralph 票面预览的关闭按钮点了没反应
$jj-ralph 先改项目A：登录后密码过期要提示
```

没点名项目时，默认就是当前工作区这个仓。

**用截图说需求**——直接贴图，说“这里”。Agent 会先看图，把图里的界面当需求：

```text
$jj-ralph [截图] 这里要改一下：放到列表对应列的下面，标题去掉
```

**先分析，不动代码**——Agent 只写目标和存疑点，等你点头：

```text
$jj-ralph 先不写代码，先分析怎么做
$jj-ralph 我认可你的方案，开始做吧
```

**小改**——分析和计划写短，仍走五步：

```text
$jj-ralph tip 的 bottom 从 4px 改成 6px
```

**明确验收要求**——直接说清要达到什么结果：

```text
$jj-ralph 刷新鉴权 token 失败要重登，审查过再归档
```

## 做完之后

**还是同一件事，就接着同一条任务改**——归档过也一样，你不需要记任务编号，Agent 会自己找到它；候选太多分不清时才会列几个标题让你选。

| 你想 | 示例说法 | 会怎样 |
|------|--------|--------|
| 再改一点 | 「tip 应是 6px 不是 8px」「刚才那个再改一下」 | 找到同一任务接着改 |
| 加一点 | 「close 按钮也跟着下移」 | 同一任务扩范围，重新验收 |
| 同会话接着做 | 「继续」「修完」 | 接着当前没做完的那一步 |
| 按审查意见改 | 「按审查改」 | 对着最新一条审查结论改，不从头分析；**不**新开「审查修复」任务 |
| 方向错了 | 「改坏了」 | 同一任务换做法，重写步骤 |
| 先不做了 | 「这个先不做了，产品砍了」 | 标成废弃；以后说「还要做」能救回 |
| 完全另一件事 | 「另外做一件…」 | 这时才新开一条任务 |
| 搬到别的仓 | 「交接到 项目B 项目C」 | 交给 [same](jj-same.md)；源仓要先提交 |
| 提交 / 推送 / 合分支 | `$jj-end` 或「收工」 | 交给 [end](jj-end.md)，只动 Git |

## 进阶

### CLI `--lite` 与旧记录

对话路径**不用** `--lite`。机械 CLI 保留该开关兼容旧记录；普通对话沿用同一条流程，仍走五步。

旧任务或维护记录里可能看到 `CAP-login-reminder`、`DEL-password`、`task-login-reminder` 等机器标识；它们只是记录用的名字，不需要你记，也不是新的输入格式。`控制项目`只负责多项目调度，单仓 ralph 仍应在业务仓里运行。

### 卡住时

```text
$jj-ralph 换策略：先只接 password_expired 字段
$jj-ralph 先暂停，等产品给样例
$jj-ralph 验收不算，退回去改
```

回退只能一步一步（验收 → 改代码 → 计划 → 分析）。默认不会 `git revert` 你的代码。

### 写整齐一点（可选）

```text
$jj-ralph
当前项目=项目A
目标=登录后密码过期提醒
范围=仅登录成功路径
验收=出现提示且可跳转改密
```

需要指定已有任务时，也可以写：

```text
$jj-ralph task-login-reminder 继续
```

### 收尾与存量任务

验收通过后 **MUST finalize**：对话路径把任务目录移入 `completed/`，更新 `index.md`，双写 `run.json`。命令行维护仍可用 `jj ralph finalize`。只翻 archive 门或不收尾，任务会留在活跃层；机械 `status` 会提示 `next: finalize`，如果 `phase=ARCHIVE` 仍在活跃目录，就提示“未完成收尾”。

默认验收后直接归档。你要求审查或门禁需要审查证据时，Agent 才跟进 `$jj-review`（派单 + findings，不执行 `review-record`）。提交代码仍需要你的授权。若已有工作区审查需要补提交后的审查，Agent 会再写一份 `review_scope=commit` 的 REV 文档并说明缺少的证据。

对话里 Agent 读 `index.md` 活跃表，不执行 CLI。命令行维护仍可用 `jj ralph locate`；存量任务先用 `jj ralph remediate` 看名单，确认后再加 `--yes`（只处理 finalize 和 migrate，不自动改动 resume 窗口）。要更新宿主旧副本，可用 `jj install-skill --platform agents --force`。

「审查修复 / review-fix」不是新任务：对着原来那条功能任务改，不要另开 `task-*-review-fix`。说「投喂知识库」才写入 `~/.jj-flow/knowledge`（当前项目），须你点头。

`index.md` 管活跃任务：超过 **5 条**还在运行，或任一条 **5 天没动**，会出现「归档提示」。同一会话（含 `review.task_thread_id` 与 CLI `--thread-id` / `host.thread_id`）或一条「审查修复」和另一条运行中的任务并排，会出现「同需求提示」。都只提醒，不会自动归档、合并或废弃。能确定该收的会建议 `finalize`；PAUSED / BLOCKED / 进行到一半、分不清收还是弃 → **先问你**。

## 记录在哪

业务仓：

```text
.workflow/ralph/
  index.md
  business-map.json
  task-…/                  # 活跃：task_plan（Goal/验收/Steps）+ 按日 progress + findings；机器事件在 .state/
    task_plan.md
    progress.md
    findings.md
    .state/
      run.json
      events.jsonl
      reviews/REV-*.json
      handoff.json
  completed/task-…/        # archive / abandon 后迁入（含 ABANDONED）
  migrated/RALPH-*/         # 1.0 RALPH-* 迁移残骸
  archive/YYYY-MM-DD-*/     # 旧版快照只读；migrate --prune-archive [--yes] 可清理
  tasks/                    # 旧版嵌套布局，迁移后提升到根目录
```

日常只需要打开 `task_plan.md` 和 `progress.md`；`.state/` 下是机器状态，不用看。控制项目里是 dispatch 的 `DEL-…`，不要用 ralph 顶替业务实现。

## 相关

[第一次使用](../usage.md)、[same](jj-same.md)、[dispatch](jj-dispatch.md)、[end](jj-end.md)、[review](jj-review.md)、[常见踩坑](../pitfalls.md)、[术语](../glossary.md)、[设计（深）](../design-docs/jj-ralph.md)
