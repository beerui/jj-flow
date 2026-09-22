# team — 起一个常驻团队（并行度定规模）

**可选入口：** 团队模式的总入口。调一次就把团队立起来，之后同一会话里直接说任务即可，不用再打前缀。单独跑完不算验收通过，验收仍看 [ralph](jj-ralph.md) / [dispatch](jj-dispatch.md) 的记录。

和 [coordinate](jj-team-coordinate.md) / [lifecycle](jj-team-lifecycle.md) / [swarm](jj-team-swarm.md) 的关系：那三个是**单轮引擎**，各管一类活；team 是**上层入口**——先量有多少活能同时干来定团队规模，再起常驻团队；请求本身就是单轮时，才点名交给其中一个引擎。它不改动那三个。

## 写法

| 工具 | 写法 |
|------|------|
| Codex / Grok / Qoder | `$jj-team …` |
| Claude | `/jj-team …` |

## 适用与边界

**用得当：**

- 有一批互不阻塞、能同时推进的活
- 工作会跨多次任务持续，需要规划文件、决策留痕和固定的审查维度
- 想像客服一样用：起一次，之后每轮直接说任务

**别用在：** 只推一个任务（用 [coordinate](jj-team-coordinate.md)）；固定规格流水线（用 [lifecycle](jj-team-lifecycle.md)）；多假设搜索（用 [swarm](jj-team-swarm.md)）；小改动直接用 [ralph](jj-ralph.md)。

### 先量后建规模（这个入口最不一样的地方）

别的团队工具先问你"要哪些角色"。team 先问**"有多少活能同时干"**：

1. 正在飞的活有几件（看实际记录：业务仓看 `.workflow/ralph/task-*`，本产品仓看 `docs/exec-plans/active/`；不看计划标题）
2. 哪些其实已经做完了（那是归档活，不是开发活）
3. 哪些卡在决策上（决策没拍 = 0）
4. 哪些要真机 / 人工验收（那是串行的，不算并行度）
5. 哪些是 team-lead 自己的在改的活（那是负责人的活，没有可派对象，不计入道数）
6. 哪些改同一批文件（撞文件的算一条道）

**测出来几，就配几个 implementer。数字只定规模，不决定起不起团队。**

| 测得 | 花名册 |
|------|------|
| 0 | **照样起**。只有 team-lead + reviewer，**不生成 implementer**（不养闲人）；数字和每条卡点照报 |
| 1 | **照样起**。team-lead + 1 个 implementer + reviewer |
| 2–3 | N 个 implementer + reviewer，按需加 researcher |
| 4+ | 按道数扩 implementer，每个阶段边界重新量 |

一条尺寸公式，不设例外：`implementers = 测得道数`；researcher / reviewer 按活的性质加，不从道数推导。

**为什么 0 道也起：** 0 道拿的是工作方式本身——规划文件、决策留痕、审查分离、可恢复。reviewer 一开始就在位，所以"谁做的不由谁审"从第 0 秒就成立；哪条道一解锁，立刻就能派活。

## 开始前

1. 在要处理的业务仓库对话里使用，并说清目标和范围
2. 知道并行度这块是**如实报数**的：卡在决策上、卡在真机验收上的活不会被算成并行度，也不会被凑进花名册
3. 知道宿主能力不同：Claude Code 上队友是并行的；Codex / Grok / Qoder 上没有常驻 teammate 时**照样起团队**，只是按状态文件逐道串行——产物、留痕、快照完全一样，丢的只有并发度

## 第一次这样用

**你说：**

```text
/jj-team 把设计文档和代码的漂移清一遍，顺便收掉没落地的 P2
```

**Agent 会做：**

1. 先解析会话绑定：这个项目已有活跃团队、且是本会话的 → 直接 resume，不重复建
2. 量可并行度，把数字和每条卡点一起摆出来
3. 探一遍环境（宿主能力 / 能摸到的模型 / 项目栈 / 发布面 / 已有约定 / 刚测的并行度），给出这个数字对应的花名册，**等你点一次头**
4. 建团队：状态文件、规划文件、工作快照，然后按花名册生成队友
5. 打完收工横幅，控制权交回你——**之后直接说任务就行**

**你会看到：**

```text
可并行度：2 条道（另有 3 条卡在决策上，不计入）
花名册：implementer-1 / implementer-2 / reviewer
状态目录：.workflow/.team/TEAM-<项目>-<日期>/

→ 起？ [y/N]
```

或者（0 道也照样起）：

```text
可并行度：0 条道（3 条卡在决策上，2 条等真机验收）
花名册：team-lead + reviewer（不生成 implementer）
卡点：① 拿不准 A 方案要不要保留旧字段 ② B 的真机验收要你跑一次

→ 起？ [y/N]
```

**起完之后：**

```text
团队已就位：TEAM-jj-flow-20260918 ｜后续直接给任务（无需 /jj-team）
```

**怎样算做完：** 团队活干完、快照归档；业务交付是否通过，仍要回到 ralph 或 dispatch 验收。

### 起完即常驻（免前缀）

起完之后，**同一个会话里**你直接说任务就行，不用再打 `/jj-team`，也不用贴会话 id。Agent 会先给这一轮分类：

| 这一轮是 | 它做什么 |
|----------|----------|
| 一条新道 | 量一次，往团队账本追加，生成一个 implementer |
| 已在跑的道 | 把整件事发给那个 implementer |
| 不是团队活 | 直接回答，记一行日志，不生成任何东西 |

最后那行是刻意的：不是每句话都该变成一次派活。

**同一个会话里**再打一次 `/jj-team`，会静默 resume：不重复建、不问你任何问题。

**新会话**再打一次是另一回事：那个团队记的是上一个会话的 id，对不上，所以它会**问你要不要接管**——接管后你继续用同一个团队（旧会话 id 收进历史），也可以并存另起一个，或者关掉重来。它不会默默抢过来，因为那样会毁掉另一方的账本。

## 常用说法

```text
/jj-team 起个团队收拾这批漂移
/jj-team check          看团队现在什么状态
/jj-team remeasure      阶段边界重新量并行度
/jj-team resume         接上次的团队继续
/jj-team close          团队收工归档
```

## 做完之后

| 你想做什么 | 下一步 |
|------------|--------|
| 把团队产物作为实现证据 | 在 [ralph](jj-ralph.md) 的验收记录里引用路径 |
| 继续这个团队 | 直接说任务；或 `resume` 重新对上 |
| 团队收工 | 说 `close`——它只在你说了之后才关闭 |
| 正式验收当前仓 | 回到 [ralph](jj-ralph.md) |
| 多项目分别验收 | 使用 [dispatch](jj-dispatch.md) |

## 边界细则

- **不推进检查点**：和三个现有引擎一样，团队跑完不等于 ralph/dispatch 验收通过
- **不与独占派单并用**：`jj-ralph` / `jj-same` / `jj-review` 派的是只读派单文件的命名子代理；`/jj-team` 是另一条执行线，同一个任务不要两条一起跑
- **不写仓库根 `CLAUDE.md`**：上游 CCteam 会在仓库根写一个，好让花名册扛过上下文压缩；这里不写——它会在 `AGENTS.md` 旁边再造一个真理源头。压缩后要恢复，说一句「读 `.workflow/.team/TEAM-<项目>-<日期>/team-snapshot.md` 恢复团队状态」，或者重打一次 `/jj-team`
- **审查底线固定四个通用维度**，不按项目另发明、不删、不改权重：

  | # | 维度 | 权重 |
  |---|------|------|
  | RD-1 | 产品深度 | 高 |
  | RD-2 | 可测试性 | 中 |
  | RD-3 | 性能 | 中 |
  | RD-4 | API 优雅 | 中 |

  任何一项 WEAK → 判决不能是 `[OK]`。安全 / 正确性 / 错误处理这些标准检查照常叠加，它们不是维度，是底线。

  **项目维度（`PD-<n>`）只在 Phase 3 探测指到它时才加**，而且只能加到底线看不见的那类契约上：宿主能力改变了变更必须守的约定（`teammates: false` 时「一道的状态要扛住单发派单」是真需求）、栈里有带日期的迁移或锁死的运行时、发布物对仓外消费者有承诺（SDK 形状、跨仓调用方）。它和底线维度一样记 id / 名字 / 权重和自己的 STRONG/ADEQUATE/WEAK 锚点，也一样有一票否决权——加它就是为了能在它上面否掉一个改动。`team-session.json` 里记成 `{floor, project[], all}`，`floor` 永不为空，`project` 可以是 `[]`，`all` 是两者拼接。六路信号各自能许可什么、以及哪一路什么都许可不了，见 `skills/jj-team/references/review-dimensions.md`

- **默认不设 custodian**：机械门禁已经覆盖合规时，custodian 是重复建设；只有出现门禁抓不到、reviewer 又反复标记的模式时才加
- **永不自动关闭**：唯一的自动信号是时间，而时间恰恰会毁掉半途任务的唯一记录。闲置久了只提示一句，关不关你说了算
- **快照陈旧由代码判定，而且判两件事**：`team-snapshot.md` 头部有两个块。`stamp` 记着生成时 skill 各文件的修改时间（路径是宿主实际加载路径，业务仓里没有 `skills/jj-team/`）；`fingerprint` 记着生成时团队所处的**环境**——宿主能摸到的模型、项目栈、发布面、项目已有的约定，以及台账自己声明的能力 / 花名册 / 维度。后半截比 skill 更容易过期（宿主升级、`rebuild` 重写了 `roles[].model`、清单变了），而它完全不碰 skill 目录里的任何文件，纯比 mtime 看不见它。压缩恢复、`check` 或 `resume` 之前，运行一次 skill 自带的 `scripts/snapshot_stale.mjs --team-dir <团队目录>`：退出码 `0` = 新；`1` = 旧，并点名改了哪个文件或哪个信号、以及它属于哪半截（`derived` / `declared`），重新生成两个块；`2` = 无法验证（没有快照、块读不出、没有 fingerprint、fingerprint 和它自己的内容对不上、skill 路径或项目路径已不在），**`2` 不算通过**；`3` = 命令本身打错了，什么都没检查——它既不是「新」也不是「旧」，别拿去重新生成 stamp。mtime 与 digest 都由脚本产出，不手写
- **降级不是死路**：宿主没有常驻 teammate 能力时说明 `模式：degraded`，团队照跑，只是串行；只有请求本身就是单轮时才改走 [coordinate](jj-team-coordinate.md)

## 记录在哪

```text
<主 checkout>/.workflow/.team/
  TEAM-<project_key>-<日期>/   一个活跃团队
    team-session.json           团队身份、花名册、测得的道数（恢复时先读它）
    task_plan.md  findings.md  progress.md  decisions.md
    team-snapshot.md            完整入职 prompt，恢复用
    <agent-name>/
  archive/<team_id>/            收工后的团队整体归档
```

目录名一律用 `team_id`（`TEAM-<project_key>-<日期>`），**不再有 `<project_key>/` 这一层中间层**——`project_key` 的权威位置本来就是 `team-session.json` 里的那个字段，少一层就少一处能拼错的地方。真正并发的第二个团队在目录名后加 `-2`。

`<project_key>` 的**权威值写在 `team-session.json` 里**，所以目录名即使拼法不同也找得回自己的历史。真要算一个键时，产品里只有一份实现：`resolveProjectKeyFromCwd`（`src/projectMap.mjs`）——`~/.jj-flow/memory/<project_key>.md` 用的也是它，这才是必须与它一致的理由。

**为什么在仓库里：** 最硬的理由是**错键不再安静**。账本在 home 里时，拼错项目键不会报错——它会落进一个已存在、看着合法的目录，于是「接管」替代了「预置」：你在 `seo-daji-web` 里跑 `/jj-team`，得到的却是 `jj-flow` 的团队。落点改成项目内之后，同一次错键的 glob 返回空，逼出一次新预置。其次是账本随仓走，以及与另外三个引擎同一个发现根（`.workflow/.team/`）。

worktree 那条旧理由没有作废，它换了形态：根永远是**主 checkout**（`git rev-parse --git-common-dir` + `path.resolve(cwd, common, '..')`，不是你现在待的这个 checkout），所以 linked worktree 不会把账本复制成两份。从主 checkout 跑时那条命令返回的是**相对**的 `.git`，所以必须 `resolve` 不能 `dirname`。

**声明把 `.workflow/` 列为禁止路径的仓兜底回 `~/.jj-flow/team/TEAM-<project_key>-<日期>/`**（`harness-manifest.json` → `forbidden_paths`，`harness:check` 只要路径存在就 FAIL）。本产品仓就是其中一个，所以你在它里面看到的是 home 落点——它会明说这是兜底、以及是哪条规则逼的，不会默默换地方。

代价也说清楚：兜底路径上账本不随仓走，第二个克隆的人看不到；一个项目默认只有一个活跃团队。`$JJ_FLOW_HOME` 只挪兜底根，项目内的落点它说了不算。

## 相关

[ralph](jj-ralph.md)、[coordinate](jj-team-coordinate.md)、[lifecycle](jj-team-lifecycle.md)、[swarm](jj-team-swarm.md)、[命令总览](../commands.md)
