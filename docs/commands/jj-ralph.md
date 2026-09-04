# ralph — 只改当前这一个仓库

在 **当前业务仓库** 里：分析 → 计划 → 改代码 → 验收 → 归档，并留下可查记录。

| 工具 | 怎么喊 |
|------|--------|
| Codex | `$jj-ralph` |
| 其他 | `/jj-ralph` |

请用 **日常说话** 推进；**不必**记任务编号。

## 什么时候用

- 只动 **这一个** 仓库  
- 希望有完整记录：分析、计划、改动、验收  

**别用 ralph：** 迁到别的仓库 → [same](command-jj-same.html)；多仓一起派 → [dispatch](command-jj-dispatch.html)；只提交合分支 → [end](command-jj-end.html)

## 先对齐名词

| 你说的 | 是什么 | 例子 |
|--------|--------|------|
| **项目A** / **项目B** / **项目C** | 业务仓 | 在项目A里改登录提醒 |
| **控制项目** | 调度状态仓（不是业务实现） | 里面是 `DEL-…` |
| **这次任务** | 本仓这一轮需求（系统内部有编号） | 你只要说「刚才那个 tip」「登录提醒」 |
| **能力** | 能力地图里的能力 | 登录密码过期提醒（系统可记 `CAP-login-reminder`） |
| **交接** | 做完后迁到项目B/项目C | `交接到 项目B 项目C` |

内部任务编号形如 `task-login-reminder`、调度号形如 `DEL-password`——**agent 自己记**；你不用当口令背。

**一句话：** 只改当前业务仓 → **ralph**；迁仓 → **same**；多仓派工 → **dispatch**；Git 收工 → **end**。

## 怎么说（口语优先）

```text
$jj-ralph 先改项目A：登录成功后密码过期要提示，只做登录成功那条路
```

```text
$jj-ralph tip 再往下挪一点，应是 6px
```

```text
$jj-ralph 刚才那个登录提醒，close 按钮也跟着下移
```

```text
$jj-ralph 这个先不做了，产品砍了
```

未说项目时，默认就是 **当前工作区这个仓**。

可选写整齐（不强制）：

```text
$jj-ralph
当前项目=项目A
目标=登录后密码过期提醒
范围=仅登录成功路径
验收=出现提示且可跳转改密
```

## 大致流程

```text
分析 → 计划 → 改代码 → 验收 → 归档        # 默认（full）
说清 → 改代码 → 收                      # 小改 / 顺手修（lite，见下）
```

验收通过后 **MUST finalize**（地图合并 + 归档进 `completed/`）。只翻 archive 门、或不跑 finalize，任务会留在活跃层；`status` 会写 `next: finalize`，`phase=ARCHIVE` 未进 `completed/` 时提示「未完成收尾」（resume 拉回后、rollback 前也是这句，先跑 `gate`/`status` 核对）。也可用 `jj ralph locate` 找活跃和 `completed/` 里的任务（行内带 `next` / `closeout`）。存量收尾先 `jj ralph remediate` 看名单，确认后再 `--yes`（只处理 finalize 与 migrate，不自动动 resume 窗口）。宿主旧副本：`jj install-skill --platform agents --force` 写入 `~/.agents/skills`。

要迁仓时说：

```text
交接到 项目B 项目C
```

→ [same](command-jj-same.html)。

可交互演示：[ralph 内部机制动画](milestones/ralph-demo.html)

## 强度档（intensity）

口语点名即可，未说 = **standard**。

| 档 | 什么时候 | 你会感到 |
|----|----------|----------|
| **tiny** | 单文件、单像素、只改一点 | 分析计划极短 |
| **standard** | 正常做完一个能力 | 常规计划与验证 |
| **strict** | 鉴权/协议，或做完要交接怕迁歪 | 验收前多一道审查/复检 |

```text
$jj-ralph tiny：tip bottom 4px 改成 6px
$jj-ralph strict：鉴权刷新失败要重登，审查过再归档
```

空转停表时可以说：

```text
$jj-ralph 换策略：先只接 password_expired 字段
$jj-ralph 先暂停，等样例
$jj-ralph 验收不算，退回改
```

## 轻量档（lite）

小改可以只走三步：**说清 → 改 → 收**（仍是同一条任务、同一个目录）。  
「分析+计划」合成一步，「验收+归档」合成一步；**验收要的证据一点不能少**。

| 你说的 | 走哪档 |
|--------|--------|
| 「小改」「顺手修一下」「改个 typo」「只动一行」 | **lite**（三步） |
| 「完整走一遍」「按流程走」「要完整记录」 | **full**（五步） |
| 没说 | **full**。改动面看着很小时系统会**提一句**「可以走 lite」，但不会自作主张切换 |

lite 和强度档是两回事：tiny 说的是「分析、计划写多短」，lite 说的是「走几道关」；说 tiny **不会**自动变 lite。

判错了不用重来：lite 里任何一关没过、或者范围变大了（多改了别的文件 / 模块），系统自动升回 full，**同一条任务接着走**，已经写的东西都留着。lite 里改代码最多 3 轮，到顶会先停下来告诉你；确认继续就升回 full 接着做，不会悄悄升档。

```text
$jj-ralph 顺手修一下：footer 版权年份改成 2026
$jj-ralph 完整走一遍：登录后密码过期提示
```

## 做完了还要改

**还是同一件事 → 系统接着同一条任务改**（归档过也一样）。你只要说改什么，**不用**以编号开头。

| 你想 | 怎么说（真实说法） | 系统会怎样 |
|------|-------------------|------------|
| 写错了 / 再改一点 | 「tip 应是 6px 不是 8px」「刚才那个再改一下」 | 找到同一任务接着改 |
| 加一点 | 「close 也下移 3px」「当前任务再加…」 | 同一任务扩范围再验 |
| 先不做了 | 「这个先不做了，砍了」 | 标成废弃；以后再说「还要做」可救回 |
| 完全另一件事 | 「另外做一件…」（说清楚是新需求） | 才新开一条任务（才新写「为什么做」） |
| 提交 / 合分支 | `$jj-end` / 收工 | **只动 Git** |
| 补充全局知识库 | 「投喂知识库」「补充全局知识」；归档后 Agent 也会问一句 | 写入 `~/.jj-flow/knowledge`（当前项目）；**须你点头**，不会自动写 |

```text
$jj-ralph tip 应是 6px 不是 8px
$jj-ralph close 按钮也跟着下移 3px
$jj-ralph 这个先不做了，产品砍了
$jj-ralph 登录提醒还要做，文案改一下
```

阶段回退只能一步一步（验收 → 改代码 → 计划 → 分析）。默认不 `git revert`。

agent 会按 **当前会话 / 最近改动 / 标题与目标是否同一需求** 锁定任务；多个候选说不清时再问你一句。编号只在报告里出现，方便你核对。

## 东西写在哪

业务仓：

```text
.workflow/ralph/
  index.md
  business-map.json
  task-…/           # 活跃任务（人可见三个 md；机器面在 .state/，含 events.jsonl）
  completed/task-…/ # archive / abandon 后迁入（含 ABANDONED）
  migrated/         # 1.0 RALPH-* 迁移残骸
  archive/…         # 1.0 快照只读；migrate --prune-archive [--yes] 可清理
```

控制项目里是 dispatch 的 `DEL-…`，不要用 ralph 顶替业务实现。

## 一眼对照

| 你怎么说 | 含义 |
|----------|------|
| 先改项目A / 在项目B… | 点名业务仓 |
| tiny / 单点 | 短路径（分析计划极短，仍走五步） |
| strict / 要审查再归档 | 加严 |
| 小改 / 顺手修 | **lite**（三步：说清 → 改 → 收；判错自动升回 full） |
| 完整走一遍 | **full**（五步；没说也是 full） |
| 再改一下 / 应是… / 也加上… | **同一任务**接着做 |
| 先不做了 / 砍了 | 废弃（可救回） |
| 另外做一件… | 新任务 |
| 交接到 项目B 项目C | **same** |
| 分发到… | **dispatch** |
| 收工 / 合到 dev | **end**（Git） |

## 相关

[术语](glossary.html) · [same](command-jj-same.html) · [dispatch](command-jj-dispatch.html) · [end](command-jj-end.html) · [踩坑](pitfalls.html) · [上手](usage.html) · [设计（深）](design-docs/jj-ralph.html)
