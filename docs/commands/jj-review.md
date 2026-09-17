# review — 把只读审查结果记下来

对当前改动做一次**只读**审查：按客服派单写 `ASSIGNMENT-REVIEW` 并 spawn 审查员，**不**调用工具自带的 `/review`。有 ralph 任务就把 `findings.md` 和 `REV-*.json` 双写进任务目录；没有任务也审当前工作区 / HEAD，只回结论、不另建任务。它只记录问题，不改业务代码。

## 写法

| 工具 | 写法 |
|------|------|
| Codex | `$jj-review …` |
| Claude / Grok / Qoder | `/jj-review …` |

## 适用与边界

**用得当：**

- ralph 任务做到一半，需要正式审查记录（大功能默认要审）
- 没有 ralph 任务，也要审当前工作区 / 最新 commit
- 你手上已有宿主审查结果，想归一化保存
- 任务刚归档但仍可继续修改，想补一轮审查

**别用在：** 不要为了审查去新建 ralph 任务"占个位置"。修复问题回 [ralph](jj-ralph.md) 说「按审查改」；多项目的 `VERIFIED` 由 [dispatch](jj-dispatch.md) 负责，不要把 review 当调度门。

## 开始前

1. 先看 `.workflow/ralph/index.md` 里正在做的那条；不确定就说"审查最新任务"。没有任务也可以审工作区 / HEAD
2. 说清要审查的提交、路径或"刚才的改动"；没有可绑定的范围时会停下询问
3. 已有审查文件或结论时，直接给路径或贴内容，Agent 会标明来源是你提供的，不冒充宿主审查

## 第一次这样用

**你说：**

```text
$jj-review 审一下刚才的改动
```

**Agent 会做：**

1. 找到当前（或最近）的 ralph 任务。主对话是 team-lead，不在主进程里做审查，**也不执行** `review-record` / `context --review`
2. 写 `ASSIGNMENT-REVIEW`（来自 team-lead / 范围只读 / 检查维度 / 产出格式 / 短句回报），spawn 前先说 **派遣审查**（例如「派遣 reviewer 审查改动代码」），再 spawn **一个** `jj-reviewer`（缺失则 `general-purpose`；`description` 以 `[reviewer]` 开头，禁止 `[reviewer] local changes`；审查执行人推理力度固定 `high`，不用最高档）
3. 同一任务已有 `REV-*` / findings 时，再审只看相对上一份的改动（delta），`resume_from` 上一名 `jj-reviewer`，不新开全量审查
4. 绑定任务时把 `findings.md` 和 `REV-n.json` 当文档写进任务目录；本轮只有文案 / 样式会跳过审查

审查员只读派单列出的文件；通过测试不会自动变成审查通过。

**你会看到：** 通过时——

```text
[OK] <一句总结：审了什么、结论为何通过>
```

有问题时——

```text
1. src/login.js:42 未处理过期分支
   修改意见：补上过期分支
```

人读结论是 `[OK]` / `[WARN]` / `[BLOCK]`，先回复结论；门禁映射为 `PASS` / `NEEDS_CHANGES` / `BLOCKED`。`[WARN]` 可以进入用户验收；`[BLOCK]` 就不能当作通过，等你说「按审查改」。

**怎样算做完：** 任务里有可追溯的 `findings.md` + `REV-n.json`、结论和来源；`[BLOCK]`（`NEEDS_CHANGES`）或 `BLOCKED` 状态不能当作通过。

## 常用说法

```text
$jj-review 审一下当前 commit 的登录提醒改动
$jj-review 把刚才宿主审查结论记到最新任务
$jj-review 审一下最新任务的改动
```

## 做完之后

| 结果或目的 | 下一步 |
|------------|--------|
| 需要修改 | 回 [ralph](jj-ralph.md) 说「按审查改」 |
| 审查通过但还没收工 | 继续核对验收项，再按需用 `$jj-end` |
| 审查范围不对 | 说明正确的提交或路径，重新记录一条审查 |
| 想审多个项目的整体结果 | 用 [dispatch](jj-dispatch.md) |

## 记录在哪

```text
.workflow/ralph/<任务目录>/.state/reviews/REV-n.json
.workflow/ralph/<任务目录>/.state/run.json
```

没有任务：只回审查结论，不另建 run、不落盘。

## 相关

[ralph](jj-ralph.md)、[dispatch](jj-dispatch.md)、[证据怎么算数](../concepts-evidence.md)、[第一次使用](../usage.md)
