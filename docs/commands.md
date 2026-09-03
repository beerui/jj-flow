# 命令总览

日常 **只在对话里** 用这些入口，不用记命令行。

## 主路径（交付）

| 入口 | 一句话 | 谁能用 |
|------|--------|--------|
| [init](command-jj-init.html) | 接入全局地图、梳理项目、补知识库 | 全平台 |
| [ralph](command-jj-ralph.html) | 当前仓库从做到验收 | 全平台 |
| [same](command-jj-same.html) | 迁到别的同源仓库 | 全平台 |
| [dispatch](command-jj-dispatch.html) | 多个项目一起派、一起盯 | Codex / Grok / Qoder（**无 Claude**） |
| [review](command-jj-review.html) | 把审查结论写进任务记录 | 全平台 |
| [end](command-jj-end.html) | 提交并合进 dev/main | 全平台 |
| [jj](command-jj.html) | 说不清时帮你选路 | 全平台 |

**怎么选：** 接入地图 → init；只改一个仓 → ralph；要搬家 → same；好几个仓一起协调 → dispatch；收工合分支 → end。

## 可选协作（不推进验收）

这些入口只帮你「这轮怎么干」，**单独跑完不算验收通过**。验收仍认 ralph / dispatch 的记录与证据。

| 入口 | 一句话 |
|------|--------|
| [team-coordinate](command-jj-team-coordinate.html) | 会话内动态多角色 |
| [team-lifecycle](command-jj-team-lifecycle.html) | 固定 SDLC 规格→实现流水线 |
| [team-swarm](command-jj-team-swarm.html) | 对抗搜索多方案 |
| [evaluated](command-jj-evaluated.html) | 复盘真实交付、改进流程 |

## 可以怎么说

口语（推荐）：

```text
$jj-init 当前仓加入全局地图
$jj-ralph 票面预览关闭按钮点了没反应
$jj-same 交接到 项目B 项目C
/jj-dispatch 分发当前任务到 项目A和项目D
$jj-end
```

写清楚一点（可选）：

```text
$jj-ralph
目标：要完成什么
资料：会话、文档、路径…
范围：做什么 / 不做什么
验收：怎样算完成
```

更多例子：[五分钟上手](usage.html) · 翻车案例：[常见踩坑](pitfalls.html)

## 不同工具的前缀

| 工具 | 前缀 | 备注 |
|------|------|------|
| Codex | `$` | 例如 `$jj-ralph` |
| Claude | `/` | **没有** 多项目调度 |
| Grok / Qoder | `/` | 多项目常一个会话串完 |

维护用的命令行在侧栏 **维护者 → CLI 参考**，不建议当日常用法。
