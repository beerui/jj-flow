# review — 把只读审查结果记下来

**它帮你做什么：** 对当前改动做一次只读审查，按客服派单写 `ASSIGNMENT-REVIEW` 并 spawn 审查员，**不**调用工具自带的 `/review`。有 ralph 任务就把 `findings.md` 和 `REV-*.json` 双写；没有任务也审当前工作区 / HEAD，不另建任务。它只记录问题，不改业务代码。

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

**不该用 review 的情况：** 不要为了审查去新建 ralph 任务“占个位置”（点名了不存在的 `run_id` 才会 `BLOCKED`）。没有任务就审工作区 / HEAD，只回结论、不落盘。多项目的 `VERIFIED` 仍由 [dispatch](jj-dispatch.md) 负责。

审查通过时回 `[OK]` 加一句总结；有问题则回 `[WARN]`/`[BLOCK]` 并列出 HIGH/MEDIUM/LOW 和修改意见。审查本身不改代码，等你说「按审查改」。

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

1. 找到当前（或最近）的 ralph 任务（`index.md` 活跃唯一行）。主对话是 team-lead，不在主进程里做审查，也不启动时读 skill 手册，**也不执行** `review-record` / `context --review`。
2. 写 `ASSIGNMENT-REVIEW`（本轮派单里的文件：来自 team-lead / 范围只读 / 检查维度 / 产出格式 / 短句回报），spawn 前先说 **派遣审查**（例如「派遣 reviewer 审查改动代码」），再 spawn **一个** `jj-reviewer`（缺失则 `general-purpose`；`description` 以 `[reviewer]` 开头，禁止 `[reviewer] local changes`；Grok/Claude 用 md 人设，Codex 用 toml；审查工人钉 `high`，不用最高档）；**不**调用工具自带的 `/review`。审查还在跑时不要再派 `$jj-same`。同一轮对话里，这个 ralph 任务如果已经有过 `REV-*` / findings，再 `/jj-review` 只审相对上一份的改动（delta），`resume_from` 上一名 `jj-reviewer`，不要再新开一个全量审查子代理。
3. 人读结论是 `[OK]` / `[WARN]` / `[BLOCK]`；先把结论告诉你。门禁映射为 `PASS` / `NEEDS_CHANGES` / `BLOCKED`（`HIGH` 写成 `high`）。
4. 绑定任务时把 `findings.md` 和 `REV-n.json` 当文档写进任务目录；不会直接改业务代码。本轮只有文案/样式会跳过审查。

审查员只读派单列出的文件。通过测试不会自动变成审查通过。

**你会看到：** 先看到聊天里的「派遣 reviewer 审查改动代码」，子代理审完后再看到类似下面的结果：

```text
[OK] <一句总结：审了什么、结论为何通过>
```

或有问题时：

```text
1. src/login.js:42 未处理过期分支
   修改意见：补上过期分支
```

下一步：回到 ralph 说「按审查改」。审查保持只读，同一回合不改业务代码。

**怎样算做完：** 任务里有可追溯的 `findings.md` + `REV-n.json`、`[OK]`/`[WARN]`/`[BLOCK]` 结论和来源；若结果是 `[BLOCK]`（门禁 `NEEDS_CHANGES`）或 `BLOCKED`，就不能把它当作通过。`[WARN]` 可以进入用户验收。

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

审查是只读适配层，走客服派单 spawn，不调用宿主 `/review`；测试或 CI 通过也不能自动当作 code review 通过。已归档的 ralph 任务仍可补写审查记录，但不会因此自动改变业务代码。

## 记录在哪

```text
.workflow/ralph/<任务目录>/.state/reviews/REV-n.json
.workflow/ralph/<任务目录>/.state/run.json
```

没有任务：只回审查结论，不另建 run。

## 相关

[ralph](jj-ralph.md)、[dispatch](jj-dispatch.md)、[证据怎么算数](../concepts-evidence.md)、[第一次使用](../usage.md)
