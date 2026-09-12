# 交接派单形状（客服）

Conversational `$jj-same` writes these under each **target** Ralph `assignments/`（lead 可留一份本轮索引）。Exclusive spawn input. 工人不读 parent 聊天。

本轮只写**这一刀**（源 commit 的有效增量），不要把整个 DEL 的旧 Goal/五条验收再当工人说明书。`distribution_prompt` 是统筹索引，不是派单，也不是入职。

Spawn 时 prompt = **匹配的入职 prefix**（调研或实施，不要揉在一段）+ 本文件。`description` 以 `[research]` 或 `[implementer]` 开头。不要让工人打开本目录其它手册。`## 读这些` / `## 交付` 必须是精确路径，禁止「以现有代码为准」。活着的 `[reviewer]` 未结束时不要写 RESEARCH spawn。

## ASSIGNMENT-RESEARCH-<target>.md

```markdown
# 调研：<target> — <本轮切片标题>

来自 team-lead。只读。不要改业务代码。不要开始实施。
请先一句话确认目标理解与第一步，再开工。

## 读这些

1. 源仓 commit `<sha>` 的本轮 diff（文件列表 + 行为）
2. 目标仓 listed 对应路径（exact paths；不要全库 grep / list_dir）
3. 目标仓 live `task_plan.md`（对照，**不要改 Goal 条文**；可建议本轮 Steps）

## 交付

写 `assignments/RESEARCH-<target>.md`（或本任务 findings）：

- 源文件 → 目标文件（存在 / 缺失 / ADAPT）
- 必须保留（目标特有 class、API、路由）
- 本轮建议交付文件清单
- 没有对应表面 → BLOCKED 原因

## 不要改

- 业务代码
- 不要 commit

完成后短句回报 team-lead（路径对照 / 保留项 / 清单），等 ASSIGNMENT-HANDOFF。
```

## ASSIGNMENT-HANDOFF-<target>.md

在调研回报之后写。实施 spawn 的 exclusive 输入。

```markdown
# 交接：<target> — <本轮切片标题>

来自 team-lead。调研见 `assignments/RESEARCH-<target>.md`。本 slice **只做**下列交付。
请先一句话确认目标理解与第一步，再开工。

源：`<repo>` @ `<sha>`。决策：DIRECT | ADAPT | EXTEND。

## 读这些

1. `assignments/RESEARCH-<target>.md`
2. 源文件 `path/a.vue`（对照，**不要改源仓**）
3. 目标 `path/a.vue`

## 交付

1. 目标 `path/a.vue` — …
2. 更新本仓 `progress.md` + `findings.md`；勾选本轮 Steps（只勾，不改旧条文）

## 不要改

- 目标特有 `goUserSetting` / 图标 class / 无关页面
- 不要整文件覆盖
- 不要 commit（等 team-lead）

## 验证

- rg / 读回本轮选择器或行为
- 有测试则跑聚焦测试；无浏览器则静态核对并写明

完成后短句汇报（做了什么 / 路径 / 证据），等下一目标或 team-lead。
```
