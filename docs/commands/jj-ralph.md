# ralph — 只改当前这一个仓库

在 **当前业务仓库** 里：分析 → 计划 → 改代码 → 验收 → 归档，并留下可查记录。

| 工具 | 怎么喊 |
|------|--------|
| Codex | `$jj-ralph` |
| 其他 | `/jj-ralph` |

请用 **对话** 推进，不要手敲命令行。

## 什么时候用

- 只动 **这一个** 仓库  
- 希望有完整记录：分析、计划、改动、验收  

**别用 ralph：** 迁到别的仓库 → [same](command-jj-same.html)；多仓一起派 → [dispatch](command-jj-dispatch.html)；只提交合分支 → [end](command-jj-end.html)

## 先对齐名词

| 你说的 | 是什么 | 例子 |
|--------|--------|------|
| **承接** / **兑接** / **承载** | 业务仓 | 在承接里改登录提醒 |
| **控制项目** | 调度状态仓（不是业务实现） | 里面是 `DEL-…`，不是 `RALPH-…` |
| **ralph 任务** | 本仓一次需求的账本 id | `RALPH-login-reminder-20260722` |
| **能力 CAP** | 能力地图条目 | `CAP-login-reminder` |
| **交接** | 做完后迁到兑接/承载 | 人话：`交接到 兑接 承载` |

**一句话：** 只改当前业务仓 → **ralph**；迁仓 → **same**；多仓派工 → **dispatch**；Git 收工 → **end**。

## 怎么说

```text
$jj-ralph 先改承接：登录成功后密码过期要提示，只做登录成功那条路
```

```text
$jj-ralph 继续 RALPH-login-reminder-20260722
```

```text
$jj-ralph
当前项目=承接前台
目标=登录后密码过期提醒
范围=仅登录成功路径
验收=出现提示且可跳转改密
```

未说项目时，默认就是 **当前工作区这个仓**。

## 大致流程

```text
分析 → 计划 → 改代码 → 验收 → 归档
```

验收通过后会默认归档（写快照、更新能力地图）。要迁仓时说：

```text
交接到 兑接 承载
```

→ 走 [same](command-jj-same.html)。

可交互演示：[ralph 内部机制动画](milestones/ralph-demo.html)

## 强度档

用口语点名即可，未说 = **standard**。

| 档 | 什么时候 | 你会感到 |
|----|----------|----------|
| **tiny** | 单文件、单像素、已有任务只改一点 | 分析计划极短 |
| **standard** | 正常做完一个能力 | 常规计划与验证 |
| **strict** | 鉴权/协议，或做完要交接怕迁歪 | 验收前多一道审查/复检 |

```text
$jj-ralph tiny：兑接 tip bottom 4px→6px
$jj-ralph strict：承接鉴权刷新失败重登，审查后再归档
```

改代码时若连续两轮没改进，会 **停表**。可说：

```text
$jj-ralph 换策略：先只接 password_expired 字段
$jj-ralph 先暂停 RALPH-xxx，等样例
$jj-ralph 验收不算，退回改：…
```

## 做完了还要改

**同一需求 = 同一个 `RALPH-…` 编号一直接着做。**  
归档只是「留下一版快照 + 写进能力地图」，**不是**任务作废。之后再改、再验、可以再归档。

| 你想 | 怎么说 | 结果 |
|------|--------|------|
| 写错了 / 再改一点 | `继续 RALPH-…：…` / `纠正 RALPH-…：…` | 同一编号接着改 |
| 加一点功能 | `当前任务再加…` / `继续 RALPH-… 再加…` | 同一编号扩范围再验 |
| 先不做了 | `不做了 RALPH-…：原因` | 标成废弃（以后还能「继续」救回） |
| 完全另一件事 | `新开：…`（说明是新需求） | 才新开编号 |
| 提交 / 合分支 | `$jj-end` | **只动 Git**，不关掉 ralph 任务 |

```text
$jj-ralph 继续 RALPH-activity-tip-down-4px-20260731：应是 6px 不是 8px
$jj-ralph 当前任务再加：close 也下移 3px
$jj-ralph 不做了 RALPH-xxx：产品砍了
```

阶段回退只能 **一步一步**（验收 → 改代码 → 计划 → 分析），不能一次从验收跳回分析。  
默认 **不会** 自动 `git revert`。

**不要**因为「已经归档过」就随便新开一个无关的 `RALPH-…`。

## 东西写在哪

业务仓里：

```text
.workflow/ralph/
  business-map.json
  RALPH-…/run.json、progress.md、…
  archive/…          # 历史快照（可有多次）
```

控制项目里是 dispatch 的 `DEL-…`，**不要**在控制仓用 ralph 顶替业务实现。

## 一眼对照

| 你怎么说 | 含义 |
|----------|------|
| 先改承接 / 在兑接… | 点名业务仓 |
| tiny / 单点 | 短路径 |
| strict / 要审查再归档 | 加严验收 |
| 继续 RALPH-… | 同一任务接着做（含归档后） |
| 不做了 RALPH-… | 废弃（可救回） |
| 交接到 兑接 承载 | 进 **same** |
| 分发到… / DEL-… | 进 **dispatch** |
| 提交 / 合分支 | **end**（Git） |

## 相关

[术语](glossary.html) · [same](command-jj-same.html) · [dispatch](command-jj-dispatch.html) · [end](command-jj-end.html) · [踩坑](pitfalls.html) · [上手](usage.html) · [设计（深）](design-docs/jj-ralph.html)
