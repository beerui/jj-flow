# 第一次使用

这一页带你从零到"第一个需求做完并归档"。只用 **ralph**（只改当前仓库），十分钟内能走完；same / dispatch 在最后只讲入口。

## 0. 确认装好了

在业务仓库根目录打开你用的工具（Codex / Claude / Grok / Qoder）的对话，输入前缀看有没有补全：Codex 是 `$jj-ralph`，其他工具是 `/jj-ralph`。没有就先看[安装](installation.md)。

下面示例统一写 `$jj-ralph`，其他工具把前缀换成 `/`。

## 1. 站对位置

- 对话开在 **业务仓库根目录**（要改哪个仓，就在哪个仓开）
- 先切到这个需求该用的分支——Agent 在你当前所在的分支上改，不会替你切

## 2. 用一句话说需求

```text
$jj-ralph 票面预览的关闭按钮点了没反应
```

不需要格式，不需要编号。可以更具体：

```text
$jj-ralph 先改项目A：登录成功后密码过期要弹提示，只做登录成功那条路
```

## 3. 接下来会发生什么

Agent 按客服闭环走。主对话是 team-lead：对齐需求、写派单、spawn 子代理；子代理做完带证据回报后写入 `progress.md`。spawn 前会先在聊天里说这一步在做什么（例如「派遣前端开发实现任务」「派遣 reviewer 审查改动代码」），不要静默等待。不要在主对话里改业务代码，也不要执行 `ralph_ops` / `jj ralph`。

| 步骤 | Agent 在做什么 | 你会看到 |
|------|---------------|----------|
| 对齐 | 确认目标和"怎样算做完"，写入短合同 | `.workflow/ralph/task-…/task_plan.md` 出现，里面有目标和验收项 |
| 计划 | 列要改的文件和步骤（给派单用） | `task_plan.md` 多出步骤 |
| 派单实施 | 每轮一份 `ASSIGNMENT-TASK`（精确文件），spawn 前先说「派遣前端开发实现任务」，`description` 以 `[implementer]` 开头。同一仓库上一轮实施已结束则续上，不冷启动；换仓交接则新开 | 聊天里那一行进度；`assignments/`；代码 diff；`progress.md` |
| 审查（大功能） | spawn 前先说「派遣 reviewer 审查改动代码」，`description` 以 `[reviewer]` 开头。审查还在跑时不要再派交接。小改跳过 | 聊天里那一行进度；`reviews/…/findings.md`：`[OK]`/`[WARN]`/`[BLOCK]` |
| 你验收 | 审查通过后等你测 | 你点头后才对照验收项收口 |
| 归档 | 记录定稿 | 任务目录移入 `.workflow/ralph/completed/`，收到一段短报告 |

还会停下来等你：分析时或 MUST / 范围 / 验收事后仍确认不了（先问，不要凭猜测推进）、你说了"先不写代码"、要做不可逆的事（推送 / 合分支 / 删数据）。

## 4. 怎么确认真的做完了

不要只看聊天总结，看仓库：

1. `git diff` 或 `git status`——改动在不在、对不对
2. `.workflow/ralph/completed/task-…/task_plan.md`——验收项是不是都勾了
3. `progress.md`——有没有"验收不通过、退回去改"之类的记录

三样都对得上，才算做完。

## 5. 做完之后的三条路

| 你想 | 示例说法 | 去哪一页 |
|------|--------|----------|
| 再改一点 / 加一点 | 「tip 应是 6px 不是 8px」「close 也跟着下移」——直接说，Agent 接着同一条任务改，不用编号 | [ralph](commands/jj-ralph.md) |
| 提交并合进 dev | `$jj-end` 或「收工」——ralph 自己不动 Git | [end](commands/jj-end.md) |
| 把这个能力搬到项目B / 项目C | 「交接到 项目B 项目C」——源仓要先提交 | [same](commands/jj-same.md) |

归档时可复用结论会记到你本机 `~/.jj-flow/memory/`；要不要再投喂全局知识库，Agent 只问一次，你点头才写。

## 另外两个入口，一句话

**same——搬到别的同源项目**

```text
$jj-same 交接到 项目B 项目C
```

Agent 写下本轮交接任务、到每个目标仓调研，再带派单前缀派执行人按目标仓自己的写法改。分支不对会停下来问你。→ [same](commands/jj-same.md)

**dispatch——多个项目一起派**（Codex / Grok / Qoder 有，Claude 没有）

```text
$jj-dispatch 把 README 的装依赖改成 pnpm，预览分发到项目A、项目B、项目C
```

先看到预览表，**你说批准** 才真正派出去。源仓库没提交会被拦住。→ [dispatch](commands/jj-dispatch.md)

## 怎样算做完（四个入口对照）

| 你在用 | 怎样算完 |
|--------|----------|
| ralph | 验收通过，任务目录进了 `completed/` |
| same | 每个目标仓都改对了、验证过了；部分成功不算全部完成 |
| dispatch | 每个项目在调度记录里验收通过——但这 **不等于** 已经 push |
| end | 代码已 push，并按需要合进 dev / main |

## 最容易出错的三件事

1. 源仓库 **还没 commit** 就多项目派发 → 会被拦住
2. **分支不对** 就迁移 → 改到错误分支
3. 调度显示"验收通过"就以为 **已经上线** → 其实还没 push / 合分支

更多：[常见踩坑](pitfalls.md)、全部入口：[命令总览](commands.md)、名词：[术语](glossary.md)
