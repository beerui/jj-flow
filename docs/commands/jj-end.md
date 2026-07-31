# end — 收工（提交并合分支）

一次做完 Git 收尾：同步 → 提交 → 推工作分支 → 合进目标分支 → 再推目标分支 → 回到工作分支。

| 工具 | 怎么喊 |
|------|--------|
| Codex | `$jj-end` |
| 其他 | `/jj-end` |

也可以说：「收工」「合到 dev」「结束任务提交并合并」。

## 什么时候用

- 功能已经改完，要正式提交并推上去  
- 你明确说收工 / 合到 dev  
- 多项目调度已经「验收通过」，但各仓还 **没 push / 没合**  

**别用 end：** 只是中途存一下、只要审查、不允许 push 时。

> 调度里显示「验收通过」**不等于** 已经合进 dev。见 [踩坑](pitfalls.html)。

## 顺序（心里有数即可）

```text
拉最新 → 提交本任务 → 推工作分支
  → 切到 dev（或 develop/main）→ 合进来 → 再推
  → 回到工作分支
```

合入目标默认：有 `dev` 用 `dev`，否则 `develop`，再否则 `main`。

### 内部机制演示（可交互）

fetch / commit / 同步 work / push / 合进集成分支 / 再推 / 冲突停表——用 SVG 点着看：

→ **[end 收工机制动画](milestones/end-demo.html)**（本地：`site/milestones/end-demo.html`）

## 硬规矩

- 不 force push、不删分支、不改 git 配置  
- 有冲突就停，尽量回到工作分支，说清楚卡在哪  
- 不能「只推了工作分支」就当收工成功  

## 怎么说

```text
$jj-end
```

```text
收工，合到 dev
```

```text
$jj-end dry_run=true
```

（最后一句只预览计划，不真改仓库。）

## 相关

任务归档用 [ralph](command-jj-ralph.html)；**Git 收工** 用本入口。
