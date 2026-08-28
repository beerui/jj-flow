# jj-end 复盘 — EP-20260828-jj-end-staging-not-dev

> Status: 远程预发未污染；已纠正合入 `origin/dev`。规则已写回 `skills/jj-end` SSOT。
>
> Recorded: 2026-08-28
>
> User correction: 「为什么会合并预发？你只应该合并 dev」

## 1. Episode

| Field | Value |
| --- | --- |
| episode_id | `EP-20260828-jj-end-staging-not-dev` |
| skill | `$jj-end` / `/jj-end` |
| host | Grok |
| repo | `D:\2025\trade-exhibition-mobile` (`trade-exhibition-mobile`) |
| work_branch | `feat/custorm-accesses-users` @ `a5c844a8` `feat(message): 站内信去回复跳转客服` |
| user intent | 收工：提交工作分支并合入 **dev** |
| wrong land | 本地 `staging` merge `cdcb950c`（`git push origin staging` 被 hook 拒绝） |
| correct land | `origin/dev` `b6400cf5..3343c0fd`（`3343c0fd Merge branch 'feat/custorm-accesses-users' into dev`） |

短指针：`docs/evaluations/2026-08-28-jj-end-staging-not-dev.md`

## 2. 路线图（当时实际判断链）

```text
/jj-end
  │
  ├─ 1. 任务仓
  │     cwd = seo-daji-web（几乎无待合改动）
  │     实现在 trade-exhibition-mobile
  │     → 对 mobile 做 closeout
  │
  ├─ 2. 技能合入优先级（原文）
  │     ① 用户 integration=            → 没有
  │     ② 文档/配置点名集成分支        → 未找到
  │     ③ 启发式：dev → develop → main
  │        且 origin/dev 已存在
  │     【正确终点：dev】
  │
  ├─ 3. 额外看了 git 历史（不在优先级里）
  │     功能分支底：0aaf7960 Merge #452 into staging
  │     近期合入文案：Merge #N into staging
  │     origin/HEAD → origin/master
  │
  ├─ 4. 错误推断
  │     把「MR 常合 staging」升格成 family/repo convention
  │     压过第 ③ 步的 dev
  │
  ├─ 5. 执行
  │     commit + push work  ✓
  │     本地 merge → staging ✗
  │     push origin/staging  被拒（不允许推送该分支）
  │
  └─ 6. 用户纠正后
        本地 staging 拨回 origin/staging
        merge + push origin/dev  ✓
```

## 3. 事实 vs 误用

| 事实 | 本应 | 实际 |
| --- | --- | --- |
| 无 `integration=` | 不能自造预发 | 选了 staging |
| 文档/`naming.json` 未点名合入分支 | 第 ② 步不成立 → 启发式 | git log 被当成约定 |
| `origin/dev` 存在 | **合 `dev`** | 当成次选 |
| `Merge #N into staging` | 只说明 Codeup MR 常合预发 | 当成 `$jj-end` 合入目标 |
| 功能分支从 staging-merge 提交拉出 | 只说明底是旧点 | 当成「该回 staging」 |
| `origin/HEAD` → `master` | 默认浏览分支，不是启发式合入目标 | 未因此回到 `dev` |

根因一句话：用仓库「MR 合预发」的习惯，覆盖了 `$jj-end` 的 `dev` 启发式。

技能第 ② 步原文是：**文档或用户配置点名集成分支**。git log / MR 标题不是文档，也不是用户配置。

## 4. 结果与恢复

| 项 | 值 |
| --- | --- |
| 远程 `staging` | **未含**本次功能（push 被拒） |
| 本地误合并 | `cdcb950c`，随后 `git branch -f staging origin/staging` 拨回 `91513d23` |
| 远程 `dev` | **已含** `3343c0fd` |
| 工作分支 | 已推 `origin/feat/custorm-accesses-users` @ `a5c844a8` |

伤害停在未推送的本地 `staging` 指针，已收回。

## 5. 规则（已写回 SSOT）

1. 无 `integration=`、文档也没写集成分支、且存在 `dev`/`origin/dev` → **只合 `dev`**。
2. 下列 **不算** family convention：
   - git log / `Merge #N into staging`
   - `origin/HEAD` 指向 `master`
   - 功能分支从 staging-merge 提交拉出
   - 仓库里同时存在 `staging` 分支
3. 要合预发必须用户写 `integration=staging`，或 AGENTS/`naming.json`/文档明确点名。
4. 执行前打印的 `work→integration` 一行必须带解析来源（user / docs / heuristic），不得只写分支名。

## 6. Golden Q&A

**Q:** 近期提交都是 `Merge #N into staging`，`origin/dev` 存在，用户只说 `/jj-end`。合哪？

**A:** `dev`。不要从 git log 推断预发。
