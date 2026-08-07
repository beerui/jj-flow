# 命令总览

日常 **只在对话里** 用下面这些入口。  
不用记命令行。

## 选哪个？

| 入口 | 一句话 | 谁能用 |
|------|--------|--------|
| [ralph](command-jj-ralph.html) | 当前仓库从做到验收 | 全平台 |
| [same](command-jj-same.html) | 迁到别的同源仓库 | 全平台 |
| [dispatch](command-jj-dispatch.html) | 多个项目一起派、一起盯 | Codex / Grok / Qoder（**无 Claude**） |
| [review](command-jj-review.html) | 把审查结论写进任务记录 | 全平台 |
| [end](command-jj-end.html) | 提交并合进 dev/main | 全平台 |
| [evaluated](command-jj-evaluated.html) | 复盘真实交付、改进流程 | skill |
| [team-coordinate](command-jj-team-coordinate.html) | 会话内**动态**多角色（不推进验收门） | 全平台 |
| [team-lifecycle](command-jj-team-lifecycle.html) | 固定 **SDLC** 规格/实现流水线（不推进验收门） | 全平台 |
| [team-swarm](command-jj-team-swarm.html) | 对抗蚁群**搜索**方案（不推进验收门） | 全平台 |
| [jj](command-jj.html) | 说不清时让它帮你选路 | 全平台 |

**拿不准：** 只改一个仓 → ralph；要搬到别的仓 → same；好几个仓一起协调 → dispatch。  
**可选协作（不是交付主路径）：** 动态多角色 → coordinate；固定 PRD/架构链 → lifecycle；多假设搜索 → swarm。三者**都不会**单独算验收通过。

## 可以怎么说

口语（推荐）：

```text
$jj-ralph 票面预览关闭按钮点了没反应
$jj-same 交接到 项目B 项目C
/jj-dispatch 分发当前任务到 项目A和项目D
$jj-end
$jj-dispatch 开始回退 DEL-readme-pnpm-install-20260731
```

写清楚一点（可选）：

```text
$jj-ralph
目标：要完成什么
资料：会话、文档、路径…
范围：做什么 / 不做什么
验收：怎样算完成
```

更多例子：[五分钟上手](usage.html)

## 不同工具的前缀

| 工具 | 前缀 | 备注 |
|------|------|------|
| Codex | `$` | 例如 `$jj-ralph` |
| Claude | `/` | **没有** 多项目调度命令 |
| Grok | `/` | 多项目默认「一个会话做完」 |
| Qoder | `/` | 与 Grok 类似 |

维护人员用的命令行清单在侧栏 **维护者 → CLI 参考**，**不建议**当日常用法。
