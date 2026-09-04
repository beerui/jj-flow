# ralph — 只改当前这一个仓库

**它帮你做什么：** 你在自己的业务仓库里用一句话说需求，Agent 把这个需求从 **分析 → 计划 → 改代码 → 验收 → 归档** 做完，并把过程记录留在仓库里，随时能核对、能接着改。

**它不做什么：** 不 commit、不 push、不合分支（收工用 [end](jj-end.md)）；不碰别的仓库（迁到别的仓用 [same](jj-same.md)）。

| 你用的工具 | 怎么喊 |
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

## 第一次这样用

**你说：**

```text
$jj-ralph 先改项目A：登录成功后如果密码过期要弹提示，只做登录成功那条路
```

**Agent 会做：**

1. **分析**——读相关代码，写下目标和“怎样算做完”（验收项）
2. **计划**——列出要改哪些文件、分几步
3. **改代码**——按步骤改，边改边验证；一种做法连续失败两次会换思路，到了上限会停下来问你
4. **验收**——逐条对照验收项
5. **归档**——记录定稿，任务目录搬进 `completed/`

每一步通过就自动进下一步，不会反复问你“要不要继续”。只有几种情况会停下来等你：需求有歧义、你说了“先不写代码”、要做不可逆的事（如推送）。

**你会看到：** 仓库里多出一个目录 `.workflow/ralph/task-…/`，里面三个给人看的文件：

| 文件 | 里面是什么 |
|------|-----------|
| `task_plan.md` | 目标、验收项、步骤（当前版本，不堆历史） |
| `progress.md` | 按日期追加的过程记录：做了什么、卡在哪 |
| `findings.md` | 改动摘要、真踩过的坑、可复用的结论 |

**怎样算做完：** 验收通过并归档——目录已在 `.workflow/ralph/completed/` 下，Agent 给你一段短报告（任务名、验收结果、可复用结论）。归档时可复用结论会记到你本机 `~/.jj-flow/memory/`，下次同一项目开任务会自动带上；要不要再投喂到全局知识库，Agent 只会问你一次，你点头才写。

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

**小改**——分析和计划写短，五步照走：

```text
$jj-ralph tiny：tip 的 bottom 从 4px 改成 6px
```

**严一点**——鉴权、协议这类改动，验收前多一道审查/复检：

```text
$jj-ralph strict：刷新 token 失败要重登，审查过再归档
```

## 做完之后

**还是同一件事，就接着同一条任务改**——归档过也一样，你不需要记任务编号，Agent 会自己找到它；候选太多分不清时才会列几个标题让你选。

| 你想 | 怎么说 | 会怎样 |
|------|--------|--------|
| 再改一点 | 「tip 应是 6px 不是 8px」「刚才那个再改一下」 | 找到同一任务接着改 |
| 加一点 | 「close 按钮也跟着下移」 | 同一任务扩范围，重新验收 |
| 同会话接着做 | 「继续」「修完」 | 接着当前没做完的那一步 |
| 按审查意见改 | 「按审查改」 | 对着最新一条审查结论改，不从头分析 |
| 方向错了 | 「改坏了」 | 同一任务换做法，重写步骤 |
| 先不做了 | 「这个先不做了，产品砍了」 | 标成废弃；以后说「还要做」能救回 |
| 完全另一件事 | 「另外做一件…」 | 这时才新开一条任务 |
| 搬到别的仓 | 「交接到 项目B 项目C」 | 交给 [same](jj-same.md)；源仓要先提交 |
| 提交 / 推送 / 合分支 | `$jj-end` 或「收工」 | 交给 [end](jj-end.md)，只动 Git |

## 进阶

### 强度档

口语里点名即可，不说就是 standard。

| 档 | 什么时候 | 差别 |
|----|----------|------|
| **tiny** | 单文件、单像素、改个文案 | 分析和计划写得很短 |
| **standard** | 正常做完一个功能 | 默认 |
| **strict** | 鉴权、协议、做完要迁仓怕迁歪 | 验收前多一道审查或复检，没过不归档 |

三档都走完整五步，tiny 不是少走步骤，只是少写字。

### 轻量档（lite）与旧记录

日常说“小改”或“顺手修”仍会先判断范围；需要轻量档时要明确说 `--lite`。它只适合小范围任务，验收和归档仍然完整走一遍；如果范围变大、验收失败或证据不足，会**自动升回 full**，不会静默降低标准。普通 `tiny` 也**不会自作主张切换**到 lite。

旧任务或维护记录里可能看到 `intensity`、`CAP-login-reminder`、`DEL-password`、`task-login-reminder` 等机器标识；它们只是记录用的名字，不需要你记，也不是新的输入格式。`控制项目`只负责多项目调度，单仓 ralph 仍应在业务仓里运行。

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

验收通过后 **MUST finalize**：它会合并地图、提升可复用结论，并把任务目录归档进 `completed/`。只翻 archive 门或不跑 finalize，任务会留在活跃层；`status` 会提示 `next: finalize`，如果 `phase=ARCHIVE` 仍在活跃目录，就提示“未完成收尾”，先跑 `gate` / `status` 核对。

需要查活跃或已归档任务时，可以用 `jj ralph locate`；存量任务先用 `jj ralph remediate` 看名单，确认后再加 `--yes`（只处理 finalize 和 migrate，不自动改动 resume 窗口）。要更新宿主旧副本，可用 `jj install-skill --platform agents --force`。

## 记录在哪

业务仓：

```text
.workflow/ralph/
  index.md
  business-map.json
  task-…/                  # 活跃任务：三个 md + .state/ 机器记录
    task_plan.md
    progress.md
    findings.md
    .state/
      run.json
      events.jsonl
      reviews/REV-*.json
      handoff.json
  completed/task-…/        # 归档或废弃的任务
  migrated/RALPH-*/         # 旧布局迁移残骸
  archive/YYYY-MM-DD-*/     # 旧版快照（只读）
  tasks/                    # 旧版嵌套布局，迁移后提升到根目录
```

日常只需要打开 `task_plan.md` 和 `progress.md`；`.state/` 下是机器状态，不用看。控制项目里的 dispatch 记录与业务仓的 ralph 分开。

## 相关

[第一次使用](../usage.md) · [same](jj-same.md) · [dispatch](jj-dispatch.md) · [end](jj-end.md) · [review](jj-review.md) · [常见踩坑](../pitfalls.md) · [术语](../glossary.md) · [设计（深）](../design-docs/jj-ralph.md)
