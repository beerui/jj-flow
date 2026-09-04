# review — 把只读审查结果记下来

**它帮你做什么：** 对当前改动做一次只读审查，优先调用你所在工具自带的 code review。有 ralph 任务就把结论和来源写回 `reviews/REV-*.json`；没有任务也审当前工作区 / HEAD，不另建任务。它只记录问题，不改业务代码。

**它不做什么：** 不创建 ralph 任务、不替你修问题，也不推进 dispatch 的多项目验收。要修问题回 [ralph](jj-ralph.md)，要做跨项目验收去 [dispatch](jj-dispatch.md)。

| 你用的工具 | 怎么喊 |
|------------|--------|
| Codex | `$jj-review …` |
| Claude / Grok / Qoder | `/jj-review …` |

## 什么时候用

- 已经在做 ralph 任务，需要正式审查记录（先看 `.workflow/ralph/index.md` 里正在做的那条）
- 没有 ralph 任务，也要审当前工作区 / 最新 commit（不另建任务）
- 你手上已有宿主审查结果，想归一化保存
- ralph 任务刚归档但仍可继续修改，想补一轮审查
- 只记审查结论，**不改业务代码**

**不该用 review 的情况：** 不要为了审查去新建 ralph 任务“占个位置”（点名了不存在的 `run_id` 才会 `BLOCKED`）。没有任务就审工作区 / HEAD，只回结论、不 persist。多项目的 `VERIFIED` 仍由 [dispatch](jj-dispatch.md) 负责。

审查通过时回 `通过。` 加一句总结；有问题则列出每条问题和修改意见。审查本身不改代码，等你说「按审查改」。

## 开始前

1. 先看 `.workflow/ralph/index.md` 里正在做的那条；不确定时可以说“审查最新任务”。没有 ralph 任务也可以审工作区 / HEAD。
2. 说清要审查的提交、路径或“刚才的改动”；没有可绑定的范围时会停下询问。
3. 如果你已经有审查文件或结论，可以直接给路径或贴出内容，省掉重复调用。

## 第一次这样用

**你说：**

```text
$jj-review 审一下刚才的改动
```

**Agent 会做：**

1. 找到当前（或最近）的 ralph 任务，读取目标、计划和过程记录。
2. 确定审查范围；有可用的宿主 code review 时优先使用它，一次只走一条审查路径。
3. 把结论整理成三种之一：`PASS`（通过）、`NEEDS_CHANGES`（需要修改）或 `BLOCKED`（无法判断）。
4. 将审查来源、文件和发现写进任务，并给你一段短报告；不会直接改业务代码。

**你会看到：** 类似下面的结果：

```text
通过。<一句总结：审了什么、结论为何通过>
```

或有问题时：

```text
1. src/login.js:42 未处理过期分支
   修改意见：补上过期分支
```

下一步：回到 ralph 说「按审查改」。审查保持只读，同一回合不改业务代码。

**怎样算做完：** 任务里有可追溯的 `REV-n.json`、审查结论和来源；若结果是 `NEEDS_CHANGES` 或 `BLOCKED`，就不能把它当成通过。

## 常用说法

有 ralph 任务时：

```text
$jj-review 审一下当前 commit 的登录提醒改动
$jj-review 把刚才宿主审查结论记到最新 ralph 任务
$jj-review run=task-login-reminder
```

也可以把审查结论直接贴出来；Agent 会标明来源是你提供的内容，而不是冒充宿主审查。

## 做完之后

| 结果或目的 | 下一步 |
|------------|--------|
| 需要修改 | 回 [ralph](jj-ralph.md) 说「按审查改」 |
| 审查通过但还没收工 | 继续核对验收项，再按需用 `$jj-end` |
| 审查范围不对 | 说明正确的提交或路径，重新记录一条审查 |
| 想审多个项目的整体结果 | 用 [dispatch](jj-dispatch.md)，不要把 review 当调度门 |

## 进阶

审查是只读适配层，不取代宿主自己的 review 功能；测试或 CI 通过也不能自动当作 code review 通过。已归档的 ralph 任务仍可补写审查记录，但不会因此自动改变业务代码。

## 记录在哪

```text
.workflow/ralph/<任务目录>/.state/reviews/REV-n.json
.workflow/ralph/<任务目录>/.state/run.json
```

没有任务：只回审查结论，不另建 run。

## 相关

[ralph](jj-ralph.md) · [dispatch](jj-dispatch.md) · [证据怎么算数](../concepts-evidence.md) · [第一次使用](../usage.md)
