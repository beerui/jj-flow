# 命令总览

日常只在业务项目的对话里说这些入口，不需要先学命令行。

## 第一次用先看哪里

从零开始：先看[安装](installation.md)，再看[第一次使用](usage.md)走完一个 ralph 需求。已经知道自己要做什么，就直接打开对应命令页。

## 主路径（交付）

| 入口 | 它解决什么 | 谁能用 |
|------|------------|--------|
| [init](commands/jj-init.md) | 把项目接入全局地图、梳理项目、补知识库 | 全平台 |
| [ralph](commands/jj-ralph.md) | 在当前仓库从分析做到验收、归档 | 全平台 |
| [same](commands/jj-same.md) | 把一个同源仓做好的能力迁到别的仓 | 全平台 |
| [dispatch](commands/jj-dispatch.md) | 多个项目先预览、批准，再一起派发 | Codex / Grok / Qoder（无 Claude 入口） |
| [review](commands/jj-review.md) | 只读审查并把结论写进 ralph 任务 | 全平台 |
| [end](commands/jj-end.md) | 提交、推送并按规则合进集成分支 | 全平台 |
| [jj](commands/jj.md) | 说不清时帮你选上面哪个入口 | 全平台 |

**快速判断：** 一个仓库 → **ralph**；要搬到别的同源仓 → **same**；好几个仓库一起批准和派发 → **dispatch**；代码已经完成只做 Git 收尾 → **end**。

## 可选协作（不推进验收）

这些入口只帮你安排这一轮怎么分析、写规格或搜索方案，单独跑完不等于交付通过。验收仍看 ralph / dispatch 的记录和证据。

| 入口 | 适合什么 |
|------|----------|
| [team-coordinate](commands/jj-team-coordinate.md) | 按当前问题动态拆多角色 |
| [team-lifecycle](commands/jj-team-lifecycle.md) | 固定角色走规格→计划→实现→测审流水线 |
| [team-swarm](commands/jj-team-swarm.md) | 多假设、对抗评分、方案收敛 |
| [evaluated](commands/jj-evaluated.md) | 用真实交付记录做离线复盘（实验性） |

## 可以怎么说

口语就够用：

```text
$jj-init 当前仓加入全局地图
$jj-ralph 票面预览的关闭按钮点了没反应
$jj-same 交接到 项目B 项目C
$jj-dispatch 先预览，再把这个改动派到项目A和项目C
$jj-review 审一下刚才的改动
$jj-end 收工，合到 dev
```

需要更清楚时，再补四件事：**目标、资料、范围、验收标准**。

```text
$jj-ralph
目标：登录成功后密码过期要提示
资料：登录模块和现有测试
范围：只改登录成功路径
验收：出现提示且可跳转改密
```

## 不同工具的前缀

| 工具 | 前缀 | 例子 |
|------|------|------|
| Codex | `$` | `$jj-ralph` |
| Claude | `/` | `/jj-same`（没有 `/jj-dispatch`） |
| Grok / Qoder | `/` | `/jj-dispatch` |

前缀和可用范围以[宿主说明](concepts-hosts.md)为准；维护用的命令行在侧栏“维护者 → CLI 参考”，不建议拿来代替日常对话入口。

## 相关

[第一次使用](usage.md) · [常见踩坑](pitfalls.md) · [证据怎么算数](concepts-evidence.md)
