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

本 skill 在**要用团队这套工作方式**时被调用：**调用即预置**，并行度测量决定团队规模而不是要不要建。它产出 `~/.jj-flow/team/<project_key>/` 的团队状态；**不得**推进 ralph `run.json` phase、control-plane checkpoint，或创建 `delivery_id` / 持久 `task_key`。

## 2. 非目标

- **不是第四个单轮引擎。** 三个 sibling 引擎各管一类单轮活；本 skill 做的是常驻团队的预置与运营，单轮请求点名路由给它们。
- **不改三个 sibling。** `jj-team-coordinate` / `jj-team-lifecycle` / `jj-team-swarm` 的 SKILL 与流程不动；本 skill 只点名路由。
- **不引入仓库根 `CLAUDE.md`**（见 §8）。
- **不写仓库内状态。** 不用 `.plans/`，不用 `.workflow/`（见 §4）。
- **不新增 CLI。** 预置本来就是「主对话建文件 + 生成队友」，上游 CCteam 即如此。加 `jj team …` 会把跨宿主能力绑死在一条代码路径上，而 `jj team-bridge` 这个待建命令已被三个 sibling 的 P2 占据（见 §3）；本 skill 不承接。
- **不碰现有 agent 入口。** `jj-ralph` / `jj-same` / `jj-review` 的入口与独占派单协议一字不改；本 skill 仅在 `/jj-team` 被调用时加载。

## 3. 与三个 sibling 引擎的关系

| 模式 | 何时 | 落点 |
| --- | --- | --- |
| **ccteam**（本 skill） | 跨多次任务的持续工作；需要花名册 + 规划文件 + 固定审查维度 | `~/.jj-flow/team/<project_key>/` |
| coordinate | 单轮多角色流水线；动态 role-spec | `.workflow/.team/TC-*` |
| lifecycle | 固定 SDLC 文档链 | `.workflow/.team/TLV4-*` |
| swarm | 多假设对抗搜索 | `.workflow/.team/TAS-*` |

四者身份互斥：`TEAM-*` ≠ `TC-*` ≠ `TLV4-*` ≠ `TAS-*` ≠ `RALPH-*` ≠ `DEL-*`。

三个 sibling 的 P2 都指向同一个待建命令 `jj team-bridge`；本 skill **不承接**该命令，避免四处争 `src/cli.mjs`。

## 4. 状态布局与落点决策

```
~/.jj-flow/team/<project_key>/
  team-session.json
  task_plan.md  findings.md  progress.md  decisions.md
  team-snapshot.md
  archive/<team_id>/
  <agent-name>/<prefix>-<task>/
```

落点候选与裁定：

| 候选 | 裁定 | 依据 |
| --- | --- | --- |
| `<repo>/.workflow/` | **否** | **worktree 是决定性的**：`<repo>/.workflow/` 在 worktree 里是另一份目录。团队跨分支切换、`jj-end` 合并或 dispatch worktree 时账本会被复制成两份，Phase 0 的 glob 会随 cwd 忽而 0 个忽而 2 个。另有 `harness-manifest.json` 的 `forbidden_paths` 含 `.workflow`。 |
| `<repo>/.plans/` | **否** | 非 jj-flow 约定。`ralph-plans-workspace.md` 已裁定不引入 `.plans` 的角色/团队层。仓内状态也无法表达跨仓的项目族团队。 |
| `~/.jj-flow/team/` | **是** | 按 **project** 而非按 checkout 键控。`~/.jj-flow/README.md` 已把该目录定为跨项目状态区，本次已把 `team/` 与 `memory/` 补进其路径表（`src/homeLayout.mjs`）。`<project_key>` 与 `~/.jj-flow/memory/<project_key>.md` 同键。 |

落点解析复用 `src/homeLayout.mjs` 的 `defaultJjFlowHome()`，因此 `$JJ_FLOW_HOME` 可整体覆盖。

**两条代价，明说：**

1. **账本不随仓走。** 第二个克隆该仓的开发者看不到团队状态。这是选择 home 换来 worktree 正确性的代价；若日后可分享性成为硬需求，那是**新设计**，不是在仓里加一个指向 home 的指针文件——两个落点比一个更糟。
2. **一个 `project_key` 默认一个活跃团队。** 真正并发的第二个团队用 `<project_key>-<n>/`，靠文件内的 `project_key`（权威）而非目录名被找到。

**本次改动了 `src/homeLayout.mjs`**：home README 是 `~/.jj-flow/` 结构的 SSOT，新增 `team/` 顶层目录而不登记，会让下一个读 README 的 agent 认为该目录不受支持。改动仅限 README 文本两行，镜像 `skills/jj-ralph/scripts/lib/homeLayout.mjs` 由 `ralph:check` 强制同步。注意 `writeIfMissing` 语义：**已存在的 home README 不会被回填**。

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

**风险**：`team-snapshot.md` 的陈旧检测依赖快照头记录**已加载 skill** 各文件的修改时间（业务仓里没有 `skills/jj-team/`，必须记宿主实际加载路径）。已写入 `specs/state-layout.md`；未做机械校验。

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

- [x] **预置链路实测（2026-09-18）**：本仓 `~/.jj-flow/team/` 此前不存在，Phase 0 判定为「无活跃团队」→ 预置成功，`team-session.json` 落盘 `status: active`；量得 1 道。**花名册定为 team-lead + reviewer（`implementers = 0`）——这个 0 不是公式给的**：按 §7 的 `implementers = measured lanes`，1 道应为 1 个 implementer，真正的原因是那唯一一条道的 owner 是 team-lead 本人（见本节末条 open item）。
- [ ] 同会话免前缀未实测：起完之后轮次 2 裸给任务，确认仍在同一团队上下文里
- [ ] 会话绑定只在 Claude Code 上确定可读（`CLAUDE_SESSION_ID` 优先）；Codex / Grok / Qoder 的 `unknown` 降级路径未实测
- [ ] 快照陈旧检测目前是文档规则，未机械化（§8 风险）
- [ ] 降级宿主（串行花名册）未实测
- [ ] **并发降级会话不可区分**（已知限制，非未处理 bug）：同一项目两个会话在读不到会话 id 的宿主上都会走「静默恢复唯一未绑定团队」这条路，resume 同一个团队 —— 文件里没有任何字段能区分它们，那条「唯一未绑定」的条件**不构成约束**。代价是两会话可能交错写 `progress.md`；不代价是不丢数据（`team-session.json` 整体重写、`progress.md` 只追加）。要真正约束需要引入会话级标记，属新设计。
- [ ] 0 道预置的可证伪条件（§7）未到评估时点
- [ ] **并行度公式未区分道的 owner**：team-lead 自有的在飞改动会被算成一条可派的道，从而推出一个闲着的 implementer —— 恰是 §7 防腐条款要盯的失败。候补排除项 `owner-is-team-lead`。
- [ ] **无编号散文复述不受门禁保护**（已知限制，靠编辑纪律而非断言）：门禁只禁「设计文档出现规则编号」与「枚举会话 id 阶梯」——这两条可变异验证且不误伤合法内容。一份**不含编号、改用中文散文复述规则**的副本仍会逃逸。**不再加断言**：能抓它的断言只能对中文散文做形状匹配（正是本文件记录过的假绿），而结构化廉价比方会被 §7 自己的花名册表误伤。所以这条靠编辑时自觉 —— 但它是**具名的**限制，不是没人知道的缺口。
