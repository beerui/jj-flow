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

收工成功时 Agent **只回一行**（工作分支 → 合入目标 + hash）；表格只在失败 / dry_run / 合不了时出现。

> 调度里显示「验收通过」**不等于** 已经合进 dev。见 [踩坑](pitfalls.html)。  
> **end 只做 Git**：不写 ralph `run.json`、不把任务「关死」。归档后再改 / 半途废弃 → 仍用 [ralph](command-jj-ralph.html) 同编号 resume（无终态冻结）。

## 顺序（心里有数即可）

```text
拉最新 → 提交本任务 → 推工作分支
  → 切到 dev（或 develop/main）→ 合进来 → 再推
  → 回到工作分支
```

合入目标默认：有 `dev` 用 `dev`，否则 `develop`，再否则 `main`。
git log 里的 `Merge #N into staging`、仓库里同时有 `staging` 分支、AGENTS/`package.json` 里的 `pnpm build:h5:staging` 构建脚本，**都不算**改默认。要合预发必须写 `integration=staging`（或文档点名合入分支）。见 [踩坑 §9](pitfalls.html)。复盘：`docs/evaluations/EP-20260828-jj-end-staging-not-dev.md`。

### 内部机制演示（可交互）

fetch / commit / 同步 work / push / 合进集成分支 / 再推 / 冲突默认自己合——用 SVG 点着看：

→ **[end 收工机制动画](milestones/end-demo.html)**（本地：`site/milestones/end-demo.html`）

## 硬规矩

- 不 force push、不删分支、不改 git 配置
- 冲突默认自己合：两边都在演进、能说清怎么合的（Vue/文档/条件守卫不同）→ 合完继续收工；只有真正合不了（同一产品开关两边相反且无法判断）才整段 abort
- 不能「只推了工作分支」就当收工成功
- 不能只解一部分冲突再停（子集解 + 半成品 merge）
- 不能因为「看起来像逻辑」就整单中止（feat/dynamic-form 误判）

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
