# 常见踩坑

来自真实交付复盘。每条先写 **会出什么事**，再写 **怎么做才对**。  
派发前可用文末清单快速自检。

## 1. 迁到错误分支

**出什么事：** 说「开始迁移 / 交接到项目C…」，Agent 在当前所在分支直接改，结果改到了发布分支。

**怎么做：**

1. 先看每个目标仓：现在在哪条分支、干不干净、是不是这个任务的分支  
2. 不对就先切到正确功能分支，再改  
3. 禁止「人在哪就改哪」

→ [same](commands/jj-same.md)

---

## 2. 源仓库没提交就多项目派发

**出什么事：** 预览过了，一点真正派发就被拦住。

**怎么做：**

1. 源仓库先 commit  
2. 再预览 → 你批准 → 再派发  
3. 被拦住时先补提交，不要硬派  

→ [dispatch](commands/jj-dispatch.md)

---

## 3. 把「调度通过」当成「已经上线」

**出什么事：** 调度显示验收通过，但代码还没 push，也没合进 dev。

**怎么做：**

| 阶段 | 意思 |
|------|------|
| 调度验收通过 | 证据和记录齐了 |
| 远端落地 | 还要 push，需要时用 [end](commands/jj-end.md) 合分支 |

---

## 4. 把 Grok 和 Codex 的用法抄反

**出什么事：** 以为一定要开很多会话，或把两种工具的做法抄反。

**怎么做：**

| 工具 | 日常习惯 |
|------|----------|
| Grok | 默认 **一个会话** 串完多个任务 |
| Codex | 可以按能力开多个会话 / 线程 |

---

## 5. 回退时自动乱改 Git

**出什么事：** 你说「回退某次交付」，Agent 直接 revert/reset，和你想的干净历史不一致。

**怎么做：**

1. 先处理调度记录（能否重开、能否再做）  
2. Git：先探测「推没推、合没合」→ **列表给你选** → 你点了再执行  
3. 本地干净未推：常适合 reset；已推/已合：常适合 revert（且不要乱 force）  

→ [dispatch](commands/jj-dispatch.md)

---

## 6. 只靠聊天就当「做完了」

**出什么事：** 任务显示归档通过，但审查还开着问题；或任务说明还是旧状态。

**怎么做：**

- 只看：任务记录、Git 提交、审查文件、调度记录  
- 还有未解决的中等问题，不要当验收通过  
- 调度通过后，任务说明要和最新状态一致  

→ [证据](concepts-evidence.md)

---

## 7. team 跑完就当成验收通过

**出什么事：** `/jj-team-coordinate` / lifecycle / swarm 提示 complete，就以为 ralph ACCEPT 或 dispatch VERIFIED 过了。

**怎么做：**

| 引擎 | 会话前缀 | 算不算验收 |
|------|----------|------------|
| team-coordinate | `TC-*` | **不算**；只产出协作产物 |
| team-lifecycle | `TLV4-*` | **不算**；只产出规格/计划等 |
| team-swarm | `TAS-*` | **不算**；只产出候选方案等 |

验收仍只认：ralph 的门禁与证据，或 dispatch 的验收记录。  
team 产物可以**写进证据里引用**，不会自动把验收门打开。

→ [team-coordinate](commands/jj-team-coordinate.md) · [证据](concepts-evidence.md)

---

## 8. 默认以为必须独占目录 / worktree

**出什么事：** 每次都开单独 worktree，或在脏的主分支上直接写。

**怎么做：** 默认在 **功能分支** 上改；只有要隔离时才单独目录。分支不确定就先问。

---

## 9. 把项目族角色名随便改成 source/target

**出什么事：** 叫成 source/target 后对错仓库。

**怎么做：** 会话和调度里用稳定的项目族称呼（文档示例为 **项目A / 项目B / 项目C**）；用项目地图 path 对照，别靠绰号猜。

---

## 10. 收工时把 staging 当成 dev

**出什么事：** `/jj-end` 没写合入分支。仓库里既有 `dev` 又有 `staging`。Agent 看到历史都是 `Merge #N into staging`，就把功能合进预发。

**怎么做：**

1. 没写 `integration=`、文档/`naming.json` 也没点名**合入/收工**分支时：有 `dev` 就只合 **`dev`**
2. git log、MR 标题、`origin/HEAD → master`、功能分支从 staging-merge 拉出、仓库里有 `staging` 分支、AGENTS/`package.json` 里的 `pnpm build:h5:staging` 这类构建脚本名 → **都不算**约定
3. 要合预发必须写 `integration=staging`，或文档明确点名合入分支（不是脚本名里碰巧出现 staging）
4. 执行前那一行 `work→integration` 要看得出是 user / docs / heuristic，方便当场拦住

→ [end](commands/jj-end.md)
复盘（仓库内，站点不收录）：`docs/evaluations/EP-20260828-jj-end-staging-not-dev.md`

---

## 11. 收工遇到冲突就整段放弃，或只解一半

**出什么事：** `$jj-end` 一有冲突就停；或者只把 import 冲突解了、业务函数冲突还留着，半成品 merge。

**怎么做：**

1. 先打分类表：每个冲突文件 `simple` 或 `complex`（拿不准 = `complex`）
2. **全部 simple** → 按表解完，继续 push 合入
3. **有一条 complex** → `merge --abort`，回到工作分支，把表给你；不要只解子集
4. 解完不能留下 `<<<<<<<`

→ [end](commands/jj-end.md)

---

## 派发前 10 秒自检

- [ ] 源仓库已经 commit  
- [ ] 每个目标仓的分支对得上这次任务  
- [ ] 分支或目录拿不准时，已经问过人  
- [ ] 说清楚要不要 push、要不要合进 dev  

更细的复盘在仓库 `docs/evaluations/`（偏内部，日常上手不用读）。
