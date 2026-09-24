# 移除伞形 skill `jj-team`，保留三个 sibling 引擎

> 状态：completed

开始：2026-09-23。触发：2026-09-22 Grok 实测（业务仓 `daji-customer-service`，会话 `01a0cd2e-996f-7ef0-856d-66177d482248`）暴露伞形守不住自己的账本。

## 目标

把伞形入口 `jj-team` 从仓库 SSOT 移除。"常驻团队"这个概念从 jj-flow 消失，只剩三个按名调用的 sibling 引擎（`jj-team-coordinate` / `jj-team-lifecycle` / `jj-team-swarm`）。

## 为什么移除

2026-09-22 那次 Grok 实测（业务仓 `daji-customer-service`，会话 `01a0cd2e-996f-7ef0-856d-66177d482248`）暴露了伞形守不住自己的账本：

1. **新车道不进 `parallelism.lanes`。** 实测派出去的活比账本登记的道多。
2. **代码已合 `dev`，账本仍 `in_progress`。** `updated_at` / `last_seen_at` 停在 `06:31:30.049Z`，`closed_at: null`，第二批 i18n 改动在账本里根本不存在。账本读起来和一份新建的一模一样——这是它最难被察觉的一种坏法，因为它正是唯一一份在飞记录。
3. **会话 id 读到了，却没有 rebind 命令可落。** `~/.grok/active_sessions.json` 一直在，但技能没有把它落到账本上的动作。

根因不是粗心，是结构性的：`每个步骤边界记得去改一段嵌套 JSON` 本来就没有宿主守得住，而团队模式把整个产品的正确性都押在这句话上。0.2.8 之前的 Unreleased 里有六条都在给这句话打补丁（时间戳改由命令写、判活表补洞、单源纪律从声明变成被守、陈旧判定两个条件一起定义），补丁方向对，但补的是一个不该由散文维系的形状。

## 边界

**删除**：`skills/jj-team/`（10 文件）、`claude-commands/jj-team.md`、`docs/commands/jj-team.md`、`docs/design-docs/jj-team.md`、`src/teamSession.mjs`、`scripts/sync-team-skill-lib.mjs`，以及 5 个只测伞形的测试文件。

**保留且一行未改**：三个 sibling。探查确认它们与伞形零耦合——`jj-team-coordinate` 21 处、`jj-team-lifecycle` 25 处、`jj-team-swarm` 17 处 `jj-team` 命中全部是它们自己的产品 id；两套 `team-session.json` schema 互不相干（sibling 用 `host_mode: full|codex-degraded|generic-degraded`，伞形用 `capabilities: {teammates, task_board}`），伞形 spec 反而追着 sibling 跑。删除伞形不破坏任何 sibling 的状态布局或 schema。

**不做**：不把 `$jj-team` / `/jj-team` 登记进 `harness-manifest.json` 的 `removed_entrypoints`。`scripts/check-harness.mjs` 用 `line.includes(entrypoint)` 做子串匹配，登记后 `/jj-team-coordinate` 等 187 行 sibling 入口会全部命中，且 `docs/changelog.md` 的历史条目没有否定词会一并变红。改匹配器是另一件事，不塞进本次移除。

## 保留 / 放弃的能力

| 保留 | 放弃 |
| --- | --- |
| `jj-team-coordinate`（动态多角色，`TC-*`） | 常驻团队（跨多轮、起完即常驻） |
| `jj-team-lifecycle`（固定 SDLC，`TLV4-*`） | `TEAM-*` 状态与 `.workflow/.team/` 下的团队目录 |
| `jj-team-swarm`（对抗蚁群，`TAS-*`） | 调用即预置 + 会话静默 resume + 每轮分类免前缀 |
| 三个 sibling 经 `/jj-team-*` 斜杠、`skills/jj/SKILL.md` 路由、`jj-ralph/references/integrations.md` 三路可达 | `~/.jj-flow/team/` 兜底目录（移除后没有任何引擎写它） |
| | `RD-1..RD-4` 审查底线 + `PD-<n>` 项目维度两层结构 |

## 验收结果

`npm run verify` 退出 0。逐项：

| 门禁 | 结果 |
| --- | --- |
| `node --test tests` | 534/534 通过。5 个伞形测试文件模块级 import 已删源文件，先以加载失败形式报错，随文件删除归零 |
| `npm run check` | `project check passed`（`requiredFiles` 两条已删） |
| `npm run harness:check` | `passed (79 files, 12 links, 10 commands, 1 protocols, 1 skill-inventory, 4 scenarios, 1 host trials, 1 GC baselines, 162 docs)` |
| `npm run harness:gc` | 无阻断漂移，5 个低优先级维护候选 |
| `npm run docs:check` | `doc-scan-surface` 差集 45 全部有解释；`check-changelog-split: clean (近期 29672, 归档 56245)`；站点构建通过 |
| `npm run ralph:check` / `end:check` | 17 / 3 个镜像文件 `in_sync: true` |
| `npm run lab:check` | PASS |

过程中撞到并修掉的四件事，都不是计划里预见到的：

1. **`HNS-EXEC-PLAN-STATUS-001` 要求状态行是 `> 状态：` 块引用**，不是普通段落。计划文件第一版因此让 `harness:check` 红了一轮。
2. **`end:check` 红**：`src/gitSnapshot.mjs` 改注释后，`skills/jj-end/scripts/lib/gitSnapshot.mjs` 镜像没同步。跑 `npm run end:sync` 修复。计划只预见了 ralph 镜像，漏了 end 也镜像同一个文件。
3. **`docs:surfaces` 红**：`lint-doc-pointers.mjs` 的文件面取自 `git ls-files --cached`，删了但没暂存的文件仍在面上，7 个 `[UNEXPLAINED]`。`git add -A` 那 13 个被跟踪路径后归零——**这是暂存状态造成的假红，不是代码问题**。
4. **`check-changelog-split` 红**：`docs/changelog.md` 是 `CHANGELOG.md` 的投影，改源不重投影就必然红。跑 `node scripts/sync-changelog-pages.mjs` 修复（该脚本没有接进 npm script，必须手动跑）。

### 计划外补的一项：`RETIRED_ASSETS`

装到宿主后复查发现 `jj-team` **仍在**全部 5 个宿主 skills 目录和 2 个 commands 目录里——`install-skill` 只是不再分发它，不会清掉历史安装。`skill-inventory.json` 的 `install_discipline` 明写它会「removes leftover retired skill dirs from host dirs」，而那个清单 `src/installSkill.mjs:33` 的 `RETIRED_ASSETS` 是硬编码的，里面没有 `jj-team`。

已把 `jj-team` 加进 `RETIRED_ASSETS.skills`、`jj-team.md` 加进 `RETIRED_ASSETS.commands`，重跑安装后 7 处全部消失、三个 sibling 3/3 在位。**这一项是计划遗漏的**：不补的话，任何从 0.2.7 升级上来的用户机器上都会留着一个描述已不存在实现的 skill。`RETIRED_ASSETS` 用的是精确名匹配，不会像 `check-harness.mjs` 的子串匹配那样误伤 sibling。

改 `src/installSkill.mjs` 属 `src/` 变更，已按 `AGENTS.md` 重跑完整 `verify`，仍退出 0。

## 靶场状态

`verify` 末步 `lab:check` 按 `AGENTS.md` 记录的方式重 seed 了两个靶场。跑之前已把两边 `_materialized/` 整树备份到 `<lab>/_materialized-backup-20260923-preverify/`（loop-gym 148 个文件、family-gym 220 个文件，逐文件计数核对一致）。已有的 `team-state-backup-TEAM-loop-gym-20260923/` **不敷用**——它缺了现存状态里的 `reviewer/` 目录。

重 seed 后：loop-gym 139 个文件（少的 9 个正是 `TEAM-loop-gym-20260923` 的团队状态），family-gym 220 个文件不变。**两个靶场现在是重 seed 之后的状态**，备份仍在原处未动。


## 已知代价

1. **`skills/jj/SKILL.md` 的路由表此后没有机械守护。** 删掉 `tests/jj-team-contract.test.mjs` 后，没有任何测试或门禁断言伞形不存在。下次有人把 `→ $jj-team` 一行加回路由表，不会有任何东西变红。这是本次裁定的结果（不守护，纯删除），记在此处备查。
2. **`~/.jj-flow/team/` 目录在用户机器上可能仍有旧内容。** 代码不再写它，但也没有清理命令。业务仓里已落盘的 `TEAM-*` 目录同理——它们是工作记录，按 AGENTS.md 的取证纪律不动。

## 被删设计取舍的原文索引

`docs/design-docs/jj-team.md` 已删除。以下取舍的论证原文在 git 历史里，最后一个改动它的 commit 是 `c0306a7`：

```bash
git show c0306a7:docs/design-docs/jj-team.md
```

其中值得留意的几条推理（删除的是文档，不是这些判断）：

- **"数字只定规模、不否决"**——首版「并行度门否决建队」被修订，因为一个会因为量不到并行就拒绝开工的入口，在降级宿主上等于永远不开工。
- **"测量段的自洽由 spec 的字段表明写，不让读者自己发现"**——JSON 键 `parallelism` 保留原名（改键会让 2026-09 之前写下的每一份账本读不动），而含义改名「可派发项数」。
- **"无法验证与通过是两回事，故单独一个退出码"**——`snapshot_stale.mjs` 的 `2` 与 `0` 分开，因为 `0` 是调用方唯一会照着行动的码。
- **"`declared` 半截故意不含 `last_seen_at` 与 `tasks[]`"**——两者每次被碰到都变，纳入指纹会让它每执行一次就漂一次，每次执行都叫的守卫等于没有守卫。
- **"活体队友在本宿主不可判定，不可判定时降级为只报不判"**——`ListAgents` 只返回 agent id，`roles[]` 里任何一个名字都对不上一个活进程。
