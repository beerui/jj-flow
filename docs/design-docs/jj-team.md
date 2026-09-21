# `jj-team`：团队模式入口

> 状态：Implemented
>
> skill + 命令页 + inventory + 设计文档已入库；真机多轮验收未做。
>
> 验收证据：`tests/jj-team-contract.test.mjs`（inventory/入口/状态落点/并行度定规模/会话绑定/宿主探测/通用维度/不改 sibling）、`npm run verify`
>
> 关联：`ARCHITECTURE.md`（控制面不变量）、`docs/commands/jj-team.md`、`jj-team-coordinate.md`、`jj-team-lifecycle.md`、`jj-team-swarm.md`、`ralph-plans-workspace.md`（`.plans` 角色层不引入的裁定）
>
> 来源协议：Claude 侧 `CCteam-creator`（常驻 teammate + planning-with-files）
>
> 产品 id：`jj-team`（inventory 约束 `^jj(-[a-z0-9]+)*$`）
>
> 别名：口语可称「团队模式」；仓库 SSOT 与 install 名以 `jj-team` 为准

## 1. 摘要

`jj-team` 是**团队模式的总入口**，不是第四条交付主路径。

jj-flow 主路径不变：

| 主路径 | 职责 |
| --- | --- |
| `jj-same` | 同源迁移 / 持续同步 |
| `jj-ralph` | 任务 ANALYZE→ARCHIVE + 能力地图 |
| `jj-dispatch` | 多项目调度身份 / 批准 / receipt |

本 skill 在**要用团队这套工作方式**时被调用：**调用即预置**，并行度测量决定团队规模而不是要不要建。它产出**主 checkout `.workflow/.team/TEAM-<project_key>-<date>/`** 的团队状态（声明禁 `.workflow/` 的仓兜底到 `~/.jj-flow/team/`，见 §4）；**不得**推进 ralph `run.json` phase、control-plane checkpoint，或创建 `delivery_id` / 持久 `task_key`。

## 2. 非目标

- **不是第四个单轮引擎。** 三个 sibling 引擎各管一类单轮活；本 skill 做的是常驻团队的预置与运营，单轮请求点名路由给它们。
- **不改三个 sibling。** `jj-team-coordinate` / `jj-team-lifecycle` / `jj-team-swarm` 的 SKILL 与流程不动；本 skill 只点名路由。
- **不引入仓库根 `CLAUDE.md`**（见 §8）。
- **不写仓库内状态，除了 §4 定下的那一处。** 不用 `.plans/`，不把团队状态写进 linked worktree 自己的 `.workflow/`（见 §4）。
- **不新增 CLI。** 预置本来就是「主对话建文件 + 生成队友」，上游 CCteam 即如此。加 `jj team …` 会把跨宿主能力绑死在一条代码路径上，而 `jj team-bridge` 这个待建命令已被三个 sibling 的 P2 占据（见 §3）；本 skill 不承接。
- **不碰现有 agent 入口。** `jj-ralph` / `jj-same` / `jj-review` 的入口与独占派单协议一字不改；本 skill 仅在 `/jj-team` 被调用时加载。

## 3. 与三个 sibling 引擎的关系

| 模式 | 何时 | 落点 |
| --- | --- | --- |
| **ccteam**（本 skill） | 跨多次任务的持续工作；需要花名册 + 规划文件 + 固定审查维度 | `<主 checkout>/.workflow/.team/TEAM-<pk>-<date>/` |
| coordinate | 单轮多角色流水线；动态 role-spec | `.workflow/.team/TC-*` |
| lifecycle | 固定 SDLC 文档链 | `.workflow/.team/TLV4-*` |
| swarm | 多假设对抗搜索 | `.workflow/.team/TAS-*` |

四者身份互斥：`TEAM-*` ≠ `TC-*` ≠ `TLV4-*` ≠ `TAS-*` ≠ `RALPH-*` ≠ `DEL-*`。

三个 sibling 的 P2 都指向同一个待建命令 `jj team-bridge`；本 skill **不承接**该命令，避免四处争 `src/cli.mjs`。

## 4. 状态布局与落点决策

```text
<主 checkout>/.workflow/.team/
├── TEAM-<project_key>-<YYYYMMDD>/
│   ├── team-session.json
│   ├── task_plan.md  findings.md  progress.md  decisions.md
│   ├── team-snapshot.md
│   └── <agent-name>/<prefix>-<task>/
└── archive/<team_id>/
```

落点候选与裁定：

| 候选 | 裁定 | 依据 |
| --- | --- | --- |
| `<主 checkout>/.workflow/.team/` | **是** | 与三个 sibling 同一发现根（`TC-*` / `TLV4-*` / `TAS-*`），一条约定覆盖四个引擎。**错键从安静的串项目变成响亮的失败**：glob 找不到 → 预置新团队，而不是落进一个看着合法、其实属于别的项目的 home 目录。 |
| `<当前 checkout>/.workflow/.team/` | **否** | **worktree 是决定性的**：linked worktree 的 `.workflow/` 是另一份目录。团队跨分支切换、`jj-end` 合并或 dispatch worktree 时账本会被复制成两份，Phase 0 的 glob 会随 cwd 忽而 0 个忽而 2 个。搬进仓内而不定主 checkout，等于把旧设计防的这个 bug 原样搬回来。 |
| `~/.jj-flow/team/` | **仅兜底** | 声明 `harness-manifest.json` → `record_system.forbidden_paths` 含 `.workflow` 的仓不能用项目内落点：`scripts/check-harness.mjs`（`HNS-STATE-001`）只要该路径存在就让 `harness:check` FAIL。本产品仓正是如此，所以它是需要兜底的那个。**兜底由仓自己的门禁机械执行，不是手搓的例外。** |
| `<repo>/.plans/` | **否** | 非 jj-flow 约定。`ralph-plans-workspace.md` 已裁定不引入 `.plans` 的角色/团队层。 |

**主 checkout，不是当前 checkout。** Step 0 用两条既有命令定根，**不新增 CLI**：`common = git rev-parse --git-common-dir`，主 checkout = `path.resolve(cwd, common, '..')`；未命中（非 git 仓、jj 非 git backend）才退回 `git rev-parse --show-toplevel`。

**必须 `resolve`，`dirname` 是错的。** 从主 checkout 跑时命令返回的是**相对**的 `.git`，`dirname` 得到 `.`，本次碰巧解析回主 checkout——那是运气不是规则，换个 shell、换个 `--git-dir` 拼法、或路径里带 `..` 就指向别处。本机 git 没有 `--absolute-git-common-dir`，不能靠它绕。本仓主 checkout + 六个 linked worktree 全量实测过，`resolve` 对相对与绝对两种输出都给正确答案，代价为零。

**两个仓的实测事实（team-lead 2026-09-20 核过，不是推断）**：

| 仓 | `harness-manifest.json` | `forbidden_paths` | 团队落在哪 |
| --- | --- | --- | --- |
| `D:\daji-docs\jj-flow`（本产品仓） | 有 | 含 `.workflow` | **兜底 →** `~/.jj-flow/team/TEAM-jj-flow-20260918/` |
| `D:\2025\seo-daji-web`（用户当场报告的仓） | **没有这个文件** | 未声明 | **项目内 →** `D:\2025\seo-daji-web\.workflow\.team/TEAM-<pk>-<date>/` |

用户原始诉求是「我是在 `seo-daji-web` 里跑的，为什么会生成 jj-flow 的 team；真实内容和文档都放到项目级 `.workflow` 下」。**上表第二行就是答案落地的位置**：那个仓没有声明禁 `.workflow`，所以它按新规则落在自己的 `.workflow/.team/` 下，发现根是它自己。这条要写进命令页——否则下一个用户在自己的仓里看到 home 落点，会以为规则没变。

**`$JJ_FLOW_HOME` 的作用域收窄**：它现在只搬兜底根，不再整体覆盖团队落点。命令页必须如实改口，不能留一句「可整体换个位置」。

**两条代价，明说：**

1. **兜底路径上账本不随仓走。** 第二个克隆该仓的开发者看不到团队状态。这是兜底换来的代价；若日后可分享性成为硬需求，那是**新设计**，不是在仓里加一个指向 home 的指针文件——两个落点比一个更糟。
2. **一个 `project_key` 默认一个活跃团队。** 真正并发的第二个团队在目录名后加 `-<n>`，靠文件内的 `project_key`（权威）而非目录名被找到。

**`project_key` 的权威位置是 `team-session.json` 的那个字段**，目录名只是便利。需要**计算**键时，产品里只有一份实现：`resolveProjectKeyFromCwd`（`src/projectMap.mjs`）。如实记一笔：**jj-team 路径上一个调用方都没有**（jj-team 没有运行时），所以不能写成「团队键由它解析」；它同时是 `~/.jj-flow/memory/<pk>.md` 的命名函数，那才是必须与它一致的硬理由。搬迁之后这条发现的分量也削弱了——发现根变成仓内目录后，`project_key` 不再回答「我找不找得到这个团队」，只回答「这个团队叫什么」；它只在兜底路径里仍是发现键，那一处仍须以代码为准。

**本次改动了 `src/homeLayout.mjs`**：home README 是 `~/.jj-flow/` 结构的 SSOT，`team/` 那一行的描述必须说清它是**兜底落点**，否则下一个读 README 的 agent 会以为它是一个全局层。改动仅限 README 文本一行，镜像 `skills/jj-ralph/scripts/lib/homeLayout.mjs` 由 `ralph:check` 强制同步（`scripts/sync-ralph-skill-lib.mjs` 规定单向拷贝：`src/homeLayout.mjs` → 副本；两份都手改 = 一次 FAIL，且错因看起来像别的地方）。注意 `writeIfMissing` 语义：**已存在的 home README 不会被回填**。

## 5. 会话绑定与免前缀

用户诉求「像客服一样用，入口是 jj-team，不用每轮打前缀」拆成三个常被混为一谈的机制：

| 机制 | 买到什么 | 边界 |
| --- | --- | --- |
| **上下文延续** —— Phase 5 之后 team-lead 就是这段对话 | 会话内后续轮次**不需要任何命令** | 压缩 / 长间隔后失效 |
| **Phase 0 静默 resume** —— 重调 `/jj-team` 按 `host.session_id` 命中并恢复 | 压缩后的修复路径只值一个词，且不会重复预置 | 需要读得到会话 id |
| **`resume, do not init` 守卫** | 二次调用永不产生重复团队 | 纯散文，靠合约测试兜底 |

**第一条是关于上下文的承诺，不是触发器。** 没有 hook、没有注入（本机 `.claude/settings.local.json` 无 hook，且用户明确排除该方案）——花名册之所以还在，是因为它就在这段对话里。要把它写成机制就会写成谎。

### 5.1 Phase 0 解析顺序

首个命中即停。**解析顺序的完整正文只有一份 —— `skills/jj-team/specs/state-layout.md`**；`SKILL.md` 不复述它，只写调用点上真正要记住的三条；本文档也只记**判断依据**，既不重抄表格、也不引用规则编号（编号属于那份 SSOT）。

判断依据就三句话：**本会话已有团队不是要问用户的问题**——用户不该为自己上一轮做过的事再点一次头，所以同会话重调一律静默恢复；**只有别的会话持有活跃团队时才是真歧义**——此时静默任何一方都会毁掉另一方的账本，必须问；**归档是机械的**——已结束的团队直接归档后重建，不需要点头。多活跃则问、无则预置，沿用 sibling 惯例与默认路径。

复用既有模式而非新造：`src/ralph/state.mjs:718-743` `findRalphInitConflict`（同会话已有活跃 run 时拒绝二次 init）+ `src/dispatchRalph.mjs:31-42` `runMatchesThreads`（用 host handle 在后续轮次重新命中同一 run）。

### 5.2 读不到会话 id 时

**per-host 的来源映射只有一份，在 `skills/jj-team/specs/state-layout.md`**；本文档不复述它，只记两条设计判断：

1. **身份从环境变量阶梯取，顺序照抄 `src/claudeHostAdapter.mjs` 已有的那份，不自己排。** 这条是踩出来的：本文档一度重抄了阶梯，结果与 spec **同向抄错**——两处都把优先级写反了。错一次等于错两处，且两处互相「印证」，复制出来的错误比单点错误更难发现。
2. **读不到就写 `null`，绝不编造。** 这是 `skills/jj-dispatch/references/agent-write-plane.md:51,58` 的同一条纪律（真 handle 拿不到就留 PENDING）；`resolveClaudeSessionId` 本身也拒绝占位符。编一个 id 会让账本在直到误路由之前都看不出在说谎。绑定退化为「本项目下唯一未绑定活跃团队」，并把 `session_id_source: "unknown"` 写下来让该状态**可见**。

### 5.3 每轮分类

skill 必须说明「一轮没有调用 `/jj-team` 的对话」该怎么处理，否则「直接说任务」无从落地：裸句子先分类为 **新道 / 已有道 / 不是团队活**，分别对应「量一次并追加任务 + 生成 implementer」「把整件事 SendMessage 给那个 implementer」「直接回答并记一行日志」。

**「不是团队活」这一支是承重的**：没有它，团队会变成每一轮无关对话的税——正是让用户弃用这类入口的失败模式。

## 6. `team-session.json`

复用 sibling 形状（`jj-team-coordinate/SKILL.md:241-273`），偏离处逐条标注，字段表见 `skills/jj-team/specs/state-layout.md`。三处值得在此说明：

- **`team_id` 不叫 `session_id`。** 这个身份比任何会话活得久；与 `host.session_id` 并列同名会立刻产生歧义。映射关系写进 spec。
- **`status` 是四值**（`active|paused|completed|abandoned`），比 sibling 多一个。照搬三值会让「已放弃」被记成 `completed`——一句下游每个消费者都得学会看穿的谎。加一个值 + 一句书面理由，比在每个读者里写条件便宜且诚实；合约测试断言全部四个值。
- **`tasks` 不是 sibling 的 `pipeline`。** 后者是依赖 DAG，前者是账本。**不要假装是同一个东西**，容器名也就跟着换了。

**永不自动关闭。** 无 hook 时唯一可用的自动信号是墙钟，而墙钟恰恰会毁掉半途任务的唯一记录。因此只做提示：活跃团队 `now - last_seen_at > 14d` 且无在世队友时打一行并提议 `close`。`pause` / `close` 永远显式。

## 7. 并行度：定规模，不否决

本 skill 与上游 CCteam 最大的差异：上游先问「要哪些角色」，本 skill 先问「有多少活能同时干」。

测量顺序（不变）：在飞工作 → 实质完成 → 卡在决策上 → 卡在真机/人工验收 → 文件集碰撞。`并行度 = 有真实无阻塞工作的道数`。

| 测得 | 花名册 |
| --- | --- |
| 0 | **照样预置**。team-lead + reviewer，`implementers = 0`；数字与卡点照报 |
| 1 | **照样预置**。team-lead + 1 implementer + reviewer |
| 2–3 | N 个 implementer + reviewer，按需加 researcher |
| 4+ | 按道数扩 implementer；每个阶段边界重新量 |

一条公式，不设例外：`implementers = 测得道数`；researcher / reviewer 按活的性质加，**不从道数推导**。一条规则比一条带对冲的规则可测得多。

公式要守的不变量在「道数」的定义上：**owner 是 team-lead 的在飞改动不是可派道**。它没有可派对象，计入就会按这条公式推出一个闲着的 implementer —— 恰是本节防腐条款要盯的失败模式。所以它和「卡在决策上」同级排除，落进 `parallelism.excluded`，而不是在公式外再开一个例外。

**为什么 0 道也预置。** 0 道买到的是工作方式本身——规划文件、决策留痕、审查分离、可恢复；reviewer 一开始就在位，所以审查分离从第 0 秒成立，任何一条道一解锁就能立刻派。**但不生成任何 implementer**：0 道预置的是一个骨架，不是凑出来的人。

**防腐条款（本设计最容易被侵蚀的地方）**：数字必须仍然决定花名册规模，且花名册里永远不许有闲着的 implementer。守不住这两条，门就退化成装饰。

**可证伪条件**：若连续多个会话里，0/1 道团队从未向生成的队友派过活，则 0 道预置是文书，规则退回「只在 ≥1 道时预置」，或把账本并回 `jj-ralph`。**评估时点在收集到实际使用数据之后，不是现在。**

## 8. 无 CLAUDE.md 的压缩恢复

上游 CCteam 在仓库根写 `CLAUDE.md`，靠 Claude Code 的自动加载扛过上下文压缩。本 skill **不写**：在 `AGENTS.md` 已是产品 SSOT 的前提下，再写一个 `CLAUDE.md` 会造出第二个真理源头，正是本产品持续防的漂移类型。

替代机制：

| 机制 | 承担 |
| --- | --- |
| `team-session.json` | 绑定 + 花名册 + 测得的道数（恢复时先读） |
| `team-snapshot.md` | 完整未删节的入职 prompt；恢复时直接复用 |
| 重调 `/jj-team` | 同会话则静默 resume，并按需重载 `references/` |
| 状态文件本身 | `task_plan.md` → `findings.md` → `progress.md` |

Phase 5 结束时打一条**固定、可 grep** 的横幅：

```
团队已就位：TEAM-<project_key>-<date> ｜后续直接给任务（无需 /jj-team）
```

固定措辞是为了日后能在 transcript 里找回来。

**诚实边界**：压缩后花名册可能不在上下文里，重调一次 `/jj-team` 是修复路径。若实践中这一步仍嫌重，升级方向是 `UserPromptSubmit` hook——那需要**推翻**「常驻范围=同会话、不加 hook」这条已定决策，不是悄悄加宽 skill description。

**风险**：`team-snapshot.md` 的陈旧检测依赖快照头记录**已加载 skill** 各文件的修改时间（业务仓里没有 `skills/jj-team/`，必须记宿主实际加载路径）。已写入 `specs/state-layout.md`，并已机械化：`skills/jj-team/scripts/snapshot_stale.mjs` 复读每个登记路径，按 0 / 1 / 2 / 3 退出码回答「新 / 旧 / 无法验证 / 命令打错」，快照新增或删除了 skill 文件同样算旧（纯 mtime 比对看不见新增文件）；`2` 与 `3` 分开是因为「读不出」不是「改过」、而「命令打错」两者都不是——合成一个码会让缺 stamp 读成通过，或把打错的命令送去重新生成 stamp。mtime 由脚本产出，不许手写。剩下的是仓库门禁摸不到 home 里的快照本身，所以机械化落在 Phase 0 / `check` / `resume` 的调用点与合约测试上，不由 `npm run verify` 代跑。

## 9. 审查维度（通用）

固定四项，不按项目另发明：

| # | 维度 | 权重 |
| --- | --- | --- |
| RD-1 | 产品深度 | 高 |
| RD-2 | 可测试性 | 中 |
| RD-3 | 性能 | 中 |
| RD-4 | API 优雅 | 中 |

任何一项 `WEAK` → 判决不能是 `[OK]`。安全 / 正确性 / 错误处理等标准检查叠加在维度之上，属于底线而非维度。维度同时钉进 `team-session.json` 的 `review_rubric`，让恢复后的 reviewer 读到正确的锚点。

**设计取舍**：项目专属维度看起来更锋利，但会在每个项目里各自发明一套词汇，锚点失去可比性，分数跨审查不再有意义。四项通用维度足够抽象到处处可用，又足够具体到能争论。

## 10. 宿主探测与降级

**探测能力，不探测品牌。** 每会话探测一次并写入 `host{}`：

| 探测 | `host_mode` |
| --- | --- |
| `TeamCreate` + `SendMessage` + `Task*` 可用（Claude Code） | `full` |
| Codex / Grok / Qoder **当 Team/Task API 存在时** | `full` |
| Codex 无上述 API | `codex-degraded` |
| Grok / Qoder / 通用 无上述 API | `generic-degraded` |

这条修饰语是 sibling（`jj-team-coordinate/SKILL.md:310,312`）写对了而本 skill 首版漏掉的：仅凭「是 Grok」就自报 degraded，会把整条 full path 在本来支持它的宿主上跳掉。

**降级不是死路。** 降级宿主照样预置并跑团队，只是花名册**串行**：没有常驻 teammate，就按状态文件逐道单发 Agent。状态文件、规划文件、决策留痕、快照完全一样，丢的只有并发度。只有请求本身就是单轮时才改走 coordinate——把它当无条件兜底，等于宣称「在 Grok 上团队模式不成立」。

## 11. 默认不设 custodian

custodian 的主要价值是把反复出现的人工审查转成自动化检查。本产品已有 `npm run verify` 串联的 11 道机械门禁（`ralph:check` / `end:check` / `test` / `check` / `harness:check` / `harness:gc` / `scenario:check` / `host:trial` / `docs:check` / `evaluated:check` / `lab:check`），`harness-manifest.json` 即其清单。

在门禁已覆盖合规的前提下加 custodian 属重复建设。**触发条件**：出现门禁抓不到、reviewer 又反复标记的模式时再加。

## 12. 未关闭项

- [x] **预置链路实测（2026-09-18）**：本仓 `~/.jj-flow/team/` 此前不存在，Phase 0 判定为「无活跃团队」→ 预置成功，`team-session.json` 落盘 `status: active`；量得 1 道，且那唯一一条道的 owner 是 team-lead 本人。**花名册定为 team-lead + reviewer（`implementers = 0`）**：当时这个 0 是判断得出的；`owner_is_team_lead` 落进公式之后，同一次测量现在由公式给出同一个 0——改的是道数的定义，不是给公式开特例（见本节 owner 排除条）。2026-09-20 搬迁后该目录改名为 `TEAM-jj-flow-20260918/`，仍在 `~/.jj-flow/team/` 下，理由是 §4 的兜底（本仓声明禁 `.workflow/`）。
- [ ] 同会话免前缀未实测：起完之后轮次 2 裸给任务，确认仍在同一团队上下文里
- [ ] 会话绑定只在 Claude Code 上确定可读（`CLAUDE_SESSION_ID` 优先）；Codex / Grok / Qoder 的 `unknown` 降级路径未实测
- [x] 快照陈旧检测已机械化（2026-09-20）：`skills/jj-team/scripts/snapshot_stale.mjs` 以退出码 0 / 1 / 2 / 3 回答「新 / 旧 / 无法验证 / 命令打错」，`specs/state-layout.md` 固定 stamp 格式；调用点接进 Phase 0 / `check` / `resume`，行为由 `tests/jj-team-snapshot-stale.test.mjs` 覆盖。§8 风险段同步改写。**F-14 记账**：第 4 个码（用法错误）落地时，文档里枚举退出码的地方只改了代码、没改文档——原方案的靶子清单扫的是 4 个候选文件得 9 处，全量扫 17 个文件后多出设计文档这 2 处同样枚举全量的行。根因与原方案自己记下的是同一条：按词扫必然漏。
- [ ] 降级宿主（串行花名册）未实测
- [ ] **并发降级会话不可区分**（已知限制，非未处理 bug）：同一项目两个会话在读不到会话 id 的宿主上都会走「静默恢复唯一未绑定团队」这条路，resume 同一个团队 —— 文件里没有任何字段能区分它们，那条「唯一未绑定」的条件**不构成约束**。代价是两会话可能交错写 `progress.md`；不代价是不丢数据（`team-session.json` 整体重写、`progress.md` 只追加）。要真正约束需要引入会话级标记，属新设计。
- [ ] 0 道预置的可证伪条件（§7）未到评估时点
- [x] **并行度公式已排除 owner 是 team-lead 的道（2026-09-20，排除项名 `owner-is-team-lead`）**：在飞改动归 team-lead 本人时不计入可派道数，与「卡在决策上」同级记进 `parallelism.excluded`；公式本身不变，改的是「道数」的定义。SKILL 测量表、`specs/state-layout.md` 字段表、`references/team-manual.md` 与合约测试同步。2026-09-18 那次 `implementers = 0` 即此例。
- [x] **团队账本落点改为项目级 `.workflow/.team/`（2026-09-20）**：从 home 搬到**主 checkout** 的 `.workflow/.team/TEAM-<project_key>-<date>/`，目录名一律用 `team_id`、不再有 `<project_key>/` 中间层，`archive/` 随 `.team/` 根下沉。买到三件事：发现根与三个 sibling 统一；**错键从安静的串项目变成响亮的失败**（glob 空 → 预置新团队）；账本随仓走。worktree 正确性由「主 checkout 而非当前 checkout」这条规则保住（`git rev-parse --git-common-dir` + `path.resolve(cwd, common, '..')`；`dirname` 在主 checkout 上返回 `.`，是运气不是规则）。声明禁 `.workflow/` 的仓兜底到 `~/.jj-flow/team/`，兜底由仓自己的门禁（`HNS-STATE-001`）机械执行；本产品仓是唯一需要兜底的那个，`D:\2025\seo-daji-web` 没有该 manifest 所以落项目内。`$JJ_FLOW_HOME` 作用域随之收窄为只搬兜底根。**顺带修掉两处同址缺陷**：解析表的 fall-through 洞（团队绑着别人的 id 而本宿主读不到 id 时没有任何规则命中 → 静默第二次预置；改为放宽该条前提 + 给整张表一条显式终局「无命中不预置，问」），以及 `project_key` 的三种推导表述（改为点名 `resolveProjectKeyFromCwd` 是唯一实现，并如实记下 jj-team 路径上没有它的调用方）。
- [ ] **无编号散文复述不受门禁保护**（已知限制，靠编辑纪律而非断言）：门禁只禁「设计文档出现规则编号」与「枚举会话 id 阶梯」——这两条可变异验证且不误伤合法内容。一份**不含编号、改用中文散文复述规则**的副本仍会逃逸。**不再加断言**：能抓它的断言只能对中文散文做形状匹配（正是本文件记录过的假绿），而结构化廉价比方会被 §7 自己的花名册表误伤。所以这条靠编辑时自觉 —— 但它是**具名的**限制，不是没人知道的缺口。
