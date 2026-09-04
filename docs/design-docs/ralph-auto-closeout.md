# Ralph 自动收尾（accept → finalize 同回合闭环）

> 状态：Proposed

状态：Proposed（2026-09-03）
来源：Grok 会话 `01a06621-526c-7cc0-93ad-a50aad2d20f0`（seo-daji-web，task-enter-form-dynamic-apply）实测复盘。
修订：2026-09-03 代码核验后修正——`writeRalphIndex` 调用点 3 → 4（补 `abandonRun`，state.mjs:812）；解析链删除 repo 级 `.agents/skills` 死路径并注明 `~/.agents/skills` 有意排除；preflight 改为不带 `--run-id` 的 `status`（新需求 init 前尚无 run_id，`getStatus` 无 runId 时列出全部 runs）；§4.7 状态头事实修正（两处 init 模板均由 CLI 写入：task_plan 的 phase/status 头 knowledge.mjs:227、findings 的 `draft` 头 memoryHotLayer.mjs:307，此后 CLI 均不维护）并推荐删除而非 CLI 拥有；index 刷新两条硬约束升格为 §4.6 验收条件；status warning 从开放问题转为本期项（§4.1）；补文档同步、CHANGELOG、实施基线与 manifest 感知清理步骤。
修订 2（2026-09-03 二次审查）：§4.1 补输出层缺口——skill 主通道 `ralph_ops.mjs` 的 gate `printJson`（:403-415）手工挑字段，`setGate` 返回加 `next` 不会自动到达 stdout，须单独改（`ralph_ops.mjs` 是 skill SSOT，`ralph:sync` 不覆盖）；§4.6 改正「run.json 的写者只有 saveRun」绝对断言（migrate.mjs:169/:198/:282 三处直写，均在 migrateRuns 显式刷新覆盖内）；§4.2 解析链改为按当前宿主排序，并说明与现行链的优先级翻转；§4.9.4 清理范围从单个 jj-ralph 扩到整个 0.1.3 manifest（10 个 jj-* 重复注入）；§4.9.1 拆分已落地/待实施并补 CHANGELOG 设计文档条目；nit：finalize 刷新次数补条件 saveRun（archive.mjs:186）、gate 输出字段补回显说明、status warning 明确列表模式。
修订 3（2026-09-03 三次审查）：§3 停止规则补「或 failure 表」原文（SKILL.md:76/:80）；§4.6 硬约束 2 补 `recordFinding` 四必填字段陷阱（不经 saveRun 无递归，但 catch 内再 throw 即违反约束本身，knowledge.mjs:110）；§4.9.4 manifest 条目数更正 10 → 11（含目录已残缺的 `skill-en-zh-rewrite` 条目）；accept PASS 仅经 `setGate` 一条路径（judgment 是 `gate accept` 内的前置校验 `evaluateAcceptJudgment`，`setAcceptLayer` 只记层不推门），§4.1 的 `next` 覆盖面确认无缺口；20 处行号锚点复验无漂移。
修订 4（2026-09-03，采纳用户补充）：§4.6 新增 **Locate 快速入口**——SKILL Locate 步骤（:32-35）先读 `.workflow/ralph/index.md`：`## 活跃` 表一个 Read 即得全部正在工作的 run（run_id/状态/阶段/标题），`## 已完成（含 ABANDONED）` 覆盖语义匹配要查的归档 run；不依赖解析链、不起进程。标注与 §4.6 刷新修复的顺序依赖（修好前引导读 index 会放大 §1 问题 2）；§4.2 preflight 区分「验证机械层（status，不能省）」与「纯定位（index.md，不互替）」；§4.8 SKILL 标记三个 → 四个（含 `.workflow/ralph/index.md` 入口）。另注：在途 jj-review 批次的 Locate 已读活跃表（skills/jj-review/SKILL.md:41-42），§4.6 刷新修复是 jj-ralph 与 jj-review 两个 Locate 行为的共同依赖，排期上不应晚于 jj-review 批次。
修订 5（2026-09-03 四次审查，复查修订 4）：§4.6 Locate 条目三处精化——改动面补 :61 I/O 表行（Locate 输入列加 index.md）；「覆盖语义匹配」改为准确口径（index 行只到 run_id/标题粒度，goal/scope 仍读候选的 task_plan.md，index 给候选清单不替代语义判断）；补 `## 已完成` 表无行数上限的事实（writeRalphIndex 全量映射 completed 行），Locate 读法配合既有 offset/limit 约定（SKILL.md:87）读文件头，completed 封顶留实施时可选、不进验收条件。本轮锚点（SKILL.md:32-35/:61/:87、jj-review:41-42 及 10 处抽查）复验无漂移。
修订 6（2026-09-03 五次审查，收敛轮）：锚点复验零漂移（SKILL.md:32/:61、jj-review:41、writeRalphIndex state.mjs:942、setAcceptLayer gates.mjs:721）；§4.1 预算行明确为全批 SKILL 改动总和口径（各节合计约 4–6 行，≤10 留余量）；§4.8 增补 evals/regression 用例——按 EP-20260828-jj-end 模式把 §1/§2 的 Grok 会话 01a06621 固化为 episode 回归（invariants 断言 finalize MUST / `next` 提示 / `.state` 手写禁令），与合约 marker 互补防回退。结构判定：修订头保留审计轨迹，正文各节无冗余、无跨节矛盾。
修订 7（2026-09-03 六次审查，实施者视角冷读）：§4.9.0 在途基线更新为实况（~51 文件；补 jj-review 批次——§4.6 不晚于它的排期约束在步骤 0 重申——与 docs-site-vitepress 批次）并补「实施时开 exec plan」；§4.8 补硬约束 2 的失败模式测试（index.md 换同名目录造稳定 EISDIR，断言主写入不反噬 + 降级警告）。装配复查：修订行 7 条、无错别字、交叉引用完整。
修订 8（2026-09-03 七次审查，跨方案一致性）：补 §4.9.0 第 ④ 项——`ralph-workspace-layout.md` Proposed 双轨与本方案同文件面（state/gates/knowledge/SKILL）且都改 index/progress 语义；进一步发现其 §4.1 index 行自带一套刷新设计（显式重写清单 + `--write-index`）与本方案 §4.6 是同一问题的两种解法，兼容性核对结论（saveRun 钩子布局无关——writeRalphIndex 纯消费 listRuns 行、§4.4 修法分轨后仅落点变化、彼案先落地时显式重写收敛为冗余、§4.8 表头字面量需随双轨调整）与「先本后彼」实施顺序；点出 jj-review Locate → §4.6 → 双轨 Phase 1/2 的三方咬合链路。回指已双向登记（彼案 §3.5 冲突登记表加行）。构建产物复查：HTML 页面正常渲染（表格 1 张、转义管道符正确、39KB）。基线数复核仍为 51。
修订 9（2026-09-03 八次审查，行为级验证）：在临时业务目录用当前工作区代码实际跑机械层，四条现状断言逐字复证——init 后 index.md 不存在（§1 问题 2 / §4.6 动机仍成立）；`status` 无 run-id 列出全部 runs（§4.2 preflight 成立）；`gate` 输出字段与 §2 证据表逐字一致且无 `next`（§4.1 动机成立）；`resume` 后 index.md 出现且含 run 行（「仅 4 调用点刷新」成立）。并发批次未顺手修掉这些问题，方案无需改动。§4.9.0 从 ~700 字单段拆为 4 类关系子 bullet + 两条收尾，装配可读性修复。
修订 10（2026-09-04 实施前重核预演，隔夜复查）：无新 commit、ralph 核心文件隔夜未动（state.mjs 16:01 / SKILL.md 16:08 / ralph_ops.mjs 10:25，均 09-03），行为断言无需重跑；30 处行号锚点批量复验零真实漂移（唯一告警为匹配模式未算反引号的误报，SKILL.md:52 实为 ``default `finalize` ``）；工作区 52 变更（+1 为 `.zcode/` 会话产物，非仓库内容），§4.9.0 基线数 `~51` 仍准确。结论：文档隔夜后与仓库事实仍完全一致。

## 1. 问题

用户诉求：run 的机械收尾（finalize / 归档进 `completed/`）不应该由用户手动跑命令。实测中 agent 推进了五门里的四门，却在 `gate accept PASS` 后结束回合，run 长期停在 `accept=PASS / archive=PENDING`。

第二个问题（2026-09-03 18:06-18:19 实测）：`index.md` 不随 run 生命周期刷新——新 run `task-seller-center-info-style` 于 18:06 `init` 创建、18:14 archive 完成，但 `index.md` 停在 17:14，整个生命周期内「活跃」表都没有这个入口任务；直到 18:17 一次 resume 触发刷新才登记。且刷新后仍有滞后（index 显示 phase=ARCHIVE，run.json 12 秒前已变 DELIVER）。

第三个问题（18:22-18:27 实测，归档后 reopen 的状态错乱）：run 第二轮于 18:22 archive 进 `completed/`；18:27 用户追加修改，`resume` 拉回根目录并正确 `rollback ARCHIVE→ACCEPT→DELIVER`（run.json 层自洽：IN_PROGRESS / DELIVER / deliver=FAIL）。但 ① agent 手写在 `findings.md:3` 的 `> Status: DONE` 不会随 reopen 失效，与真实状态直接矛盾；② index 在 resume 时（rollback 之前）刷新，定格在 `IN_PROGRESS | ARCHIVE` 这个中间态，rollback 不刷新 index，错误行一直挂着。

## 2. 实测证据链（Grok 会话 01a06621，2026-09-03）

| 证据 | 来源 | 结论 |
| --- | --- | --- |
| `gate deliver PASS`、`gate accept PASS`、`finding F-015` 由 agent 自己执行，`resolved` 均指向 `C:\Users\motou\.grok\skills\jj-ralph\scripts\lib\ralph.mjs` | 会话 `terminal/call-*.log`（call-11cd1548、call-a753deee 等） | 机械层在 Grok 宿主可用，bundled lib 从 `~/.grok/skills` 解析成功 |
| `finalize` 命令 0 条；events.jsonl 最后一条为 `gate accept=PASS`（09:29:37Z）；turn 7 于 09:35:21Z 结束 | terminal 日志 + `.state/events.jsonl` + events.jsonl（会话） | **断点 = accept PASS 之后、finalize 之前** |
| chat_history.jsonl 中 `"command"` 字段 0 条 | 会话 chat_history.jsonl | Grok 聊天记录不落盘终端命令文本，查命令必须看 `terminal/`，只查聊天记录会得出错误结论（复盘时已踩坑，见 §5） |
| gate JSON 输出除命令回显（ok/action/run_id/gate/status）外只有 `gates_written / gate_set / promotion / phase / run_status / resolved`，由 `ralph_ops.mjs` gate 分支的 `printJson` 手工挑字段（:403-415，非 spread `setGate` 返回） | terminal 日志 + ralph_ops.mjs:403-415 | accept PASS 后模型得不到结构化「下一步」信号；且后续加 `next` 必须同时改该输出层（§4.1） |
| `scope` 事件打印 `gate_set=undefined` | `.state/events.jsonl` | gate_set 概念已删，输出模板未清理 |
| `writeRalphIndex` 全仓只有 4 个调用点：`resumeRun`（knowledge.mjs:828）、`archiveRun`（archive.mjs:132）、`migrate`（migrate.mjs:354）、`abandonRun`（state.mjs:812） | grep src/ + skills/jj-ralph/scripts | `init` / `gate` / `scope` / `deliver-attempt` / `accept-layer` / `set-status` 等常规状态写入**都不刷新 index** |
| 新 run 18:06 init → 18:14 archive 全程，index.md mtime 停在 17:14；18:17 resume 后才刷新（且滞后 run.json 12 秒） | `.workflow/ralph/` 目录时间线 | index.md 的时效性取决于「碰巧经过四个调用点」，不是派生不变量 |
| run.json 18:27 reopen 后为 IN_PROGRESS / DELIVER / deliver=FAIL，`findings.md:3` 仍是 agent 手写的 `> Status: DONE` | run.json vs findings.md | 产物里的叙事状态头由 agent 自由书写，reopen 时无人重置 |
| 18:27:26 resume 刷新 index（当时 phase 仍为 ARCHIVE），18:27:34/35 两次 rollback-phase 改变 phase 但不刷新 index | `.state/events.jsonl` | index 行定格为 `IN_PROGRESS \| ARCHIVE` 自相矛盾态；再次证明刷新点错位 |

## 3. 根因

accept → finalize 断链，三层都留了口子：

1. `skills/jj-ralph/SKILL.md:52` "default `finalize`"、`references/phases.md:121` "prefer `finalize`" —— 措辞是允许，不是必须；
2. CLI gate 输出无 `next` 字段 —— 模型只能靠散文记忆下一步，而散文说的是 "default"；
3. 停止规则只认 🔴 CHECKPOINT 或 failure 表（SKILL.md:76/:80），finalize 不在其中、不受任何 CHECKPOINT 保护，被静默跳过是合规行为。

次要隐患（本次实测未发作，但要修）：

- 解析链（SKILL.md:97/:147、claude-commands/jj-ralph.md:24）是 Codex 中心的（`$CODEX_HOME`），没写 `~/.grok/skills/...` —— 本次 agent 是「猜对」路径，换宿主/新机器不可复制；
- 无禁令禁止 agent 手写 `.state/run.json` / `gates.*`（合约测试 fixture 还手写 gates，有模仿风险）；
- `src/ralph/state.mjs:1072/:1075` 打印 `gate_set=undefined`；
- `grokSkillInstalled`（src/grokHostAdapter.mjs:71-81）只查 jj-dispatch SKILL.md 存在性，不查 jj-ralph scripts 完整性。

index.md 的结构性问题：它自称「CLI 派生视图；以各 run 的 `.state/run.json` 为准」，但刷新没有挂在状态写入路径上，只挂在 resume / archive / migrate / abandon 四个业务动作里。任何不经过这四个动作的状态变化（init 首当其冲）都会让 index 落后于事实——「派生视图」目前是巧合一致，不是不变量。

reopen 的叙事层问题：run.json / gates 由 CLI 管得很对（resume → rollback 链条自洽），但产物里的**叙事状态头**是半拉子所有权：`> Status:` 行由 init 模板写入（task_plan 写 phase/status、findings 写 draft），之后 CLI 不维护、由 agent 按文档示例自由改值（archive 时写成 DONE）、reopen 时无人重置（事实修正见 §4.7）；index 又恰好在 rollback 前的中间态刷新。用户看到的是「归档了、又拉出来、里面全写着 DONE」——机械层正确，派生层与叙事层撒谎。

## 4. 改动清单（按优先级）

### 4.1 核心：finalize 同回合 MUST 化 + 机械 nudge

- `SKILL.md:52`：`default finalize` → `MUST run finalize in the same turn; never end a turn with accept PASS un-finalized`；Failure modes 表加一行：`accept PASS 未 finalize → 本回合立即补跑 finalize；不把收尾留给用户`。MUST 的语义是**同回合必须尝试**：finalize 被 product-consistency reject 时走既有 Failure modes 的 `finalize` / archive reject 行（修复后 re-`gate accept`），不是强行归档。
- `references/phases.md:121-122`：`prefer` → MUST；happy path 顺序不变（finalize → completion report）。
- `src/ralph/gates.mjs`：`gate accept PASS` 的返回 JSON 增加 `"next": "finalize"`；product-consistency reject 时 `next` 回退为修复提示。`next` 只加在 accept 门（其它门加了是噪声）；实现时确认不泄漏到 archive 门输出（`setGate` 返回对象同时服务两门）。
- **输出层须单独改两处**（「返回层加了 stdout 就有」不成立）：skill 路径的 stdout 由 `skills/jj-ralph/scripts/ralph_ops.mjs` gate 分支的 `printJson` 手工挑字段（:403-415，非 spread `setGate` 返回），必须显式加 `next`——`ralph_ops.mjs` 是 skill SSOT，`src/` 下无对应文件、`ralph:sync` 不覆盖，须单独改；`src/cli.mjs` 文本模式（:986-991）同步加一行 `next=finalize` 提示（`--json` 路径 :984 直接 stringify 整个 result，自动透传无需改）。漏改 ralph_ops 这一处，nudge 就到不了 agent——§2 实证的断点路径正是它。
- 第二道保险（原 §5.4 开放问题 2，采纳进本期）：`jj ralph status` 对 `accept=PASS` 且未 finalize 的 run 输出一行 warning（`getStatus` 纯派生，gates.mjs:1373）。**列表模式（无 `--run-id`）也要报**——§4.2 preflight 用的正是裸 status；`listRuns` 行已有 layout/phase/status，足以判定「active + phase=ARCHIVE + status=IN_PROGRESS ≈ accept PASS 未 finalize」，不必逐 run loadRun。SKILL 措辞会漂移，CLI 派生输出不会——这是比文档更强的 nudge。
- `npm run ralph:sync` 同步 vendored 副本（合约测试断言两侧一致）。
- 兼容性：strict 的 judgment PASS 前置 CHECKPOINT 仍在 finalize 之前，顺序不变；analyze-hold 到不了 accept，无冲突。
- 预算：SKILL.md 净增 ≤ 10 行（该文件每行都进每次会话上下文；口径为**全批 SKILL 改动总和**——§4.1 MUST 行、§4.2 解析链、§4.3/§4.7 禁令、§4.6 Locate 合计约 4–6 行，留余量）。

### 4.2 加固：宿主感知解析链 + preflight

- 替换 SKILL.md:97/:147 与 claude-commands/jj-ralph.md:24 的解析链：`node <宿主skills>/jj-ralph/scripts/ralph_ops.mjs`，**按当前宿主排序**（不是固定全局顺序——多宿主机器上固定序会让 Claude 会话先命中 `~/.grok/skills` 的别家副本，单平台重装后即静默版本漂移）：① 本宿主全局 skills 目录（Grok 会话 `~/.grok/skills`、Claude `~/.claude/skills`、Codex `$CODEX_HOME/skills`、Qoder `~/.qoder/skills`）；② repo 内仓级安装目标 `.grok/.claude/.codex/.qoder/skills/jj-ralph/scripts`（install-skill 的 cwd 目标 `projectGrokTarget` 等，业务仓做过仓内安装时命中）；③ 其它宿主全局目录按序（多宿主零配置兜底，如 Grok 读 Claude 侧资产的场景；跨宿主副本可能漂移，命中时报告命中路径）；④ 全局 `jj ralph`；⑤ `npx -y @brewer/jj-flow@beta ralph`（版本漂移风险，仅兜底，命中时打印警告）。与现行链有一处优先级翻转（原 repo 优先 → 现本宿主优先）：进上下文的 SKILL.md 几乎总来自宿主全局目录（§2 实证即 `~/.grok/skills`），脚本应与所加载的 SKILL 同源；仓内安装主要兜底无全局安装的环境，本仓也无按仓钉版的惯例。SKILL 内保持一行表格文案量级，宿主枚举细节不逐字展开。
- `~/.agents/skills` **有意不进解析链**：本机它是 0.1.3 时代 grok 平台的旧 manifest 安装（`~/.agents/skills/.jj-flow-install.json`，`platform: grok`，且缺 jj-init 等新技能），与 `~/.grok/skills` 并存造成重复注入，按 §4.9 步骤 4 清理——写进链里会与清理自相矛盾。install-skill 从不写 repo 级 `.agents/skills`，该路径是死路径。
- 会话首次机械步骤前 preflight：跑一次不带参数的 `status`（新需求 init 前尚无 run_id；`ralph_ops.mjs` 的 status 不要求 `--run-id`，无 runId 时 `getStatus` 列出全部 runs）。preflight 的目的是**验证机械层可用**，status 这一步不能省；纯「找正在工作的 run」另有更廉价入口——读 index.md（§4.6 Locate 快速入口，不依赖解析链），但读文件验证不了机械层，两者不互替。解析链全失败 → 🔴 CHECKPOINT，给一行修复指引（`install-skill --platform <host> --force`），不得在无机械层时继续 run。

### 4.3 禁令：`.state` 只能 CLI 写

Failure modes 加一行：`.state/run.json` / `.state/events.jsonl` / `gates.*` 只能由 CLI 写入；状态要变 = 跑对应 gate/resume/finalize 命令，禁止手编。

### 4.4 bug：`gate_set=undefined`

`src/ralph/state.mjs:1072`（progress 行）与 `:1075`（返回值）：`run.gate_set` → 复用同文件 `effectiveGateSet(run)`（state.mjs:989，legacy run 视为 full）；`npm run ralph:sync` 同步。

### 4.5 可选：doctor 完整性检查

`grokSkillInstalled` 增加 `jj-ralph/scripts/ralph_ops.mjs` 存在性检查，结果进 harnessDoctor grok 块；缺失时给 finding，next_action = 重装命令。

### 4.6 index.md 派生一致性（新发现，第二优先级）

把 index 刷新下沉到状态写入路径本身，使其成为真正的不变量：

- `saveRun`（src/ralph/state.mjs）末尾调用 `writeRalphIndex(cwd)` —— saveRun 是所有生命周期变更（init/resume/gate/scope/deliver-attempt/accept-layer/rollback-phase/archive）落盘的唯一咽喉点（state.mjs:604/611；initRun 亦经 saveRun，knowledge.mjs:197）。口径注意：run.json **并非**只有 saveRun 一个写者——migrate 模块另有 3 处直写（migrate.mjs:169/:198 的 destId 迁移写、:282 的 `rewriteParkedPaths`），都在 `migrateRuns` 流程内且被其末尾显式刷新（:354）覆盖，正好落在下述豁免里；除此之外生命周期路径无第二个写者。挂在这里则 init 即登记、每次变更后 index 必然与 run.json 一致，满足「新 run 开启先维护 index」的顺序要求。
- 两条硬约束（**验收条件**，不是实现细节）：
  1. **先写 run.json，再刷 index**——顺序反了 index 读到的是旧状态；
  2. **index 写失败 try/catch 降级为 finding/警告，不得反噬主写入**——派生视图的故障不能阻断主流程。降级实现别裸调 `recordFinding`：它要求 phenomenon/cause/action/scope 四字段、缺失即 throw（knowledge.mjs:110），异常发生在 catch 里恰好违反本条；机器兜底直接写文件或只打警告行更稳（recordFinding 不经 saveRun，无递归风险）。
- 成本：每次 saveRun 全量 listRuns（root + completed/ 所有 run.json）。一次 finalize 会刷 3 次（archive 内两次 saveRun + 显式一次；handoff 存在时 finalize 入口还有一次条件 saveRun，archive.mjs:186，最多 4 次），本机规模可接受；bulk migrate N 个 run 放大为 O(N²) 读，migrate 批路径豁免（结束时已有显式刷新，migrate.mjs:354，覆盖其 3 处直写）。index.md 本身体积也随 completed 行数线性增长（全量映射、无上限），Locate 侧读文件头即可规避；completed 表封顶（如最近 N 行 + 总数）留实施时可选，不进验收条件。
- 原 resume/archive/migrate/abandon 四处显式调用点保留（幂等）或收敛删除，实现时定；收敛时勿漏 `abandonRun`（state.mjs:812）。
- 验收：init 后 index「活跃」表立即含新 run 行；gate / rollback-phase 后 status/phase 行同步更新；无 12 秒级滞后窗口。
- **Locate 快速入口（收益，依赖本节刷新修复）**：SKILL.md Locate 步骤（:32-35 子句 + :61 I/O 表行的输入列）增加「先读 `.workflow/ralph/index.md`」——`## 活跃` 表（run_id / 状态 / 阶段 / 标题）即全部「正在工作的」run；不依赖解析链、不起进程，解析链失败时它仍是唯一可读的 run 清单。读法配合既有 offset/limit 约定（SKILL.md:87）：活跃表在文件头，读头部即可，不必整读——`## 已完成` 表**无行数上限**（writeRalphIndex 全量映射 completed 行），随归档历史增长；且 index 行只到 run_id/标题粒度，goal/scope 语义匹配（:34）仍要读候选的 `task_plan.md`——index 给候选清单，不替代语义判断。选定后照常跑机械命令（以 run.json 为准）。索引缺失（尚无任何 run）或行可疑时落回 `status` / 扫 `.workflow/ralph/*`——与在途 jj-review 批次的同款约定一致（其 Locate 已是「读 `index.md` 活跃优先，表空/缺文件才 glob」，skills/jj-review/SKILL.md:41-42）。**顺序依赖：必须与 §4.6 同批落地**——刷新修好之前引导 agent 读 index，会放大 §1 问题 2（新 run 整个生命周期不在活跃表里）；jj-review 的 Locate 行为已在途，本节刷新修复因此是 jj-ralph 与 jj-review 两个 Locate 的**共同依赖**，排期上 §4.6 不应晚于 jj-review 批次。SKILL 净增约 1–2 行（:32-35 子句 + :61 表行）。

### 4.7 reopen 状态归一（resume / rollback 的派生与叙事层）

事实修正（代码核验）：`> Status:` 头不是 agent 凭空手写——两处 init 模板都由 CLI 写入：`task_plan.md` 写 `> Status: <phase> / <status>`（knowledge.mjs:227），`findings.md` 写 `> Status: draft`（memoryHotLayer.mjs:307）；此后 CLI 从不维护，而 artifact-layout.md 的示例（:54 `DELIVER / IN_PROGRESS`、:102 `DONE + M-1 已修`）暗示 agent 手动跟进。问题面比 §1 描述的更大：状态头整个 run 生命周期都是陈旧的，reopen 只是让它开始撒谎。

- **删除状态头（推荐，而非 CLI 拥有）**：两处 init 模板去掉 `> Status:` 行，artifact-layout.md 两个示例同步删掉。CLI 拥有意味着每次状态变更要维护两个叙事文件里的派生行——正是 §4.6 刚诊断过的「派生视图靠巧合一致」反模式，翻倍不值得。状态只活在 run.json（事实源）+ index.md（§4.6 修复后的派生视图）+ progress.md 带日期轮次。存量 run 的旧头不迁移（读到无害），靠 SKILL 禁令止增。
- **SKILL 禁令扩展**：`.state` 手写禁令（4.3）加上「不得在 findings.md / task_plan.md 维护全局状态行；完成报告的状态叙述只进 progress.md 当日轮次」。
- **完成报告措辞**：固定一句「已归档 `completed/<task>`；继续修改将 resume 同一 run_id（不新建）」，消除「归档了怎么又被拉出来」的意外感。
- index 的 `IN_PROGRESS \| ARCHIVE` 中间态由 4.6（saveRun 咽喉点刷新）自动消除：rollback-phase 落盘即刷新（rollbackPhase 内部经 saveRun，gates.mjs:1232），index 不再定格中间态。

### 4.8 测试

- `tests/jj-ralph-contract.test.mjs`（按既有 marker 模式，:324-367）：SKILL.md 含 finalize MUST、`~/.grok/skills/jj-ralph/scripts` 路径、`.state` 手写禁令、`.workflow/ralph/index.md` Locate 入口四个标记；`next` 字段断言走 runNode（ralph_ops）stdout——`printJson` 手工挑字段，漏改输出层时这里必须挂（§4.1）；`jj ralph gate --json` 由 cli.mjs 透传，自然覆盖。
- status warning（runNode 模式）：`gate accept PASS` 后 `status` 输出含未 finalize 警告行，finalize 后消失；不带 `--run-id` 的列表模式同样要报（§4.2 preflight 依赖裸 status）。
- `tests/install-skill.test.mjs`（:374-389 模式）：grok 安装含 `jj-ralph/scripts/ralph_ops.mjs`。
- `tests/grok-host-adapter.test.mjs`（:310-327 模式）：doctor 完整性断言。
- index 行为测试（jj-ralph-contract 的 runNode 临时 cwd 模式，:800-869）：`init` 后读 index.md 断言含新 run_id 行；`gate` 后断言 status/phase 行已更新。
- index 失败降级测试（硬约束 2 的验收）：把 `.workflow/ralph/index.md` 换成同名**目录**（跨平台稳定 EISDIR）再跑 `gate`——断言主写入成功（run.json 已更新）且输出含降级警告；恢复文件后下次 saveRun 重建 index。
- reopen 行为测试：archive → resume → rollback-phase 后，断言 index 行 phase/status 与 run.json 一致；init 生成的 task_plan.md / findings.md 不含 `> Status:` 行；marker 断言 SKILL 含「不得维护全局状态行」禁令。
- marker 测试 :373 起同时断言 `docs/commands/jj-ralph.md`——SKILL 变更须同步用户文档（见 §4.9 步骤 1），否则测试挂。
- 测试 fixture 直接手写 run.json 安排状态（如 :858）是合法手段；在该处加一行注释「测试直接安排状态；会话内禁止手写 `.state`」，消除 §4.3 禁令的模仿歧义。
- evals/regression 用例（与合约 marker 互补）：按 `EP-20260828-jj-end-staging-not-dev` 模式把 §1/§2 的 Grok 会话 `01a06621` 固化为 `evals/regression/EP-20260903-ralph-accept-pass-finalize.json` + `docs/evaluations/` 源 episode——invariants 断言 SKILL 含 finalize MUST、`next` 提示与 `.state` 手写禁令；真实 episode 锚定，防止后续改 SKILL 时悄悄回退（合约测试改得起，episode 背书改不动）。

### 4.9 文档同步、验证与部署

0. 实施基线：当前工作区有多批在途未提交改动（2026-09-03 六次审查时 ~51 文件），与本方案的关系分四类：
   - ① **同文件面在途批次**（migrate 整理 / 人读产物短合同 / lite 弃用 / jj-end self-merge）——与本方案共同修改 SKILL.md、state.mjs、gates.mjs、jj-ralph-contract.test.mjs；
   - ② **jj-review 批次**（jj-review 不依赖 ralph）——其 Locate 已读 index 活跃表，**§4.6 的刷新修复是它的依赖，排期上 §4.6 不应晚于它落地**（文件面无冲突，纯顺序约束）；
   - ③ **docs-site-vitepress 批次**——本设计文档的注册与 CHANGELOG 条目随它走；
   - ④ **未来重叠，非在途**：`ralph-workspace-layout.md` 的 Proposed 双轨（`tasks/` 活跃层、progress 分轨到 `.state/events.log`、~20 处 `appendProgressLine` 改写、jj-review 定位 glob 加 `completed/`）与本方案动同一批文件且都改 index/progress 语义，**且其 §4.1 的 index 行另有一套刷新设计**（init/finalize/abandon/resume/migrate 显式重写 + `status --write-index` 重生成——修了 init 缺口，但 gate/scope/rollback 变更仍不刷新）与本方案 §4.6 saveRun 咽喉点是同一问题的两种解法。兼容性已核对：§4.6 saveRun 钩子布局无关（writeRalphIndex 纯消费 listRuns 行，listRuns 吸收 `tasks/` 层是彼案自身的活）、§4.4 的 gate_set 修法在分轨后只是落点变为 events.log、Locate 读法不受影响；若本方案先落地，彼案 §4.1 的显式重写清单收敛为冗余（幂等无害）、`--write-index` 降级为修复工具；唯 §4.8 若断言 `## 活跃（根目录 task-*` 表头字面量需随双轨调整。
   - 先落地在途批次再实施本方案，或明确 rebase 顺序；两案都实施时**先本后彼**（本方案小、双轨大；回指已登记在彼案 §3.5 冲突表），并在 exec plan 里显式排顺序——jj-review Locate → §4.6 → 双轨 Phase 1/2 的链路任何一个乱序都会让定位退化。
   - 本方案引用的行号以全部在途批次之后为准（六轮审查时锚点零漂移、七轮行为冒烟复证问题断言，但工作区仍在并发演进，实施前重核）。实施时按仓库惯例开 exec plan（`docs/exec-plans/active/2026-09-XX-ralph-auto-closeout.md`），把 §4.1–§4.8 拆成可勾选步骤。
1. 文档同步：设计文档注册（`docs/design-docs/index.md` + `scripts/build-docs.mjs` 构建清单）与 CHANGELOG Unreleased「规划草案，Proposed」条目**已随本方案落地**（2026-09-03 复查确认）；实施时再同步 `docs/commands/jj-ralph.md` 与 `docs/skill-zh-bridge/jj-ralph/README.zh.md`，CHANGELOG 实施条目注明合约测试。
2. `node --test tests/jj-ralph-contract.test.mjs` → `npm run verify` → `git diff --check`
3. `node src/cli.mjs install-skill --platform all --force`
4. 清理 `~/.agents/skills` 的整个 0.1.3 grok 旧安装，不止 jj-ralph：manifest（`.jj-flow-install.json`，`platform: grok`、`package_version: 0.1.3`、缺 jj-init）拥有 **11 个条目**——10 个 jj-* 目录（jj、jj-dispatch、jj-end、jj-evaluated、jj-ralph、jj-review、jj-same、jj-team-coordinate、jj-team-lifecycle、jj-team-swarm）全部与 `~/.grok/skills` 并存重复注入，第 11 个 `skill-en-zh-rewrite` 目录已不在、只剩 manifest 残留条目；只删 jj-ralph 治标不治本。目录里另有 darwin-skill、sd-tracker 等**非本 manifest 拥有**的资产，不能整目录删：按 manifest entries 逐个核对（digest + 本地修改）后删对应目录，并同步移除 manifest 条目（全清则连 manifest 一起删）。当前 grok 默认目标已是 `~/.grok/skills`，`uninstall-skill --platform grok` 未必指向旧位置，必要时按 manifest 路径手动删。
5. 补救存量：由 agent 用新约定对 `task-enter-form-dynamic-apply`（accept PASS、iteration 19/20）执行 finalize 归档进 `completed/`，顺手清掉 `task-seller-center-info-style` findings.md 的陈旧 `> Status: DONE` 头 —— 都不是用户手动跑

## 5. 方案审查

### 5.1 v1 方案的三处硬伤（复盘修正）

1. **根因误判**：v1 断言「agent 无路可走、门禁全靠用户手动推」——被 terminal 日志证伪。机械层一直可用，真断点只在 accept → finalize。
2. **论证方法缺陷**：只 grep chat_history 就下结论，而 Grok 聊天记录不落盘命令文本；必须查 `terminal/` 落盘日志。
3. **自相矛盾**：v1 的补救步骤让用户手动 finalize，恰好违背用户原始诉求。

### 5.2 v1 中仍然成立的部分

finalize MUST 化、宿主解析链文档化、`.state` 手写禁令、`gate_set=undefined` 修复、doctor 完整性检查、合约测试与验证纪律。

### 5.3 残余风险

- ~~`next` 字段挂在哪一层：建议 gates.mjs 返回层（JSON 与 stdout 同源），cli.mjs 只透传；实现时定。~~ → 已核验并细化进 §4.1：「同源」只对 `cli.mjs --json`（:984 直接 stringify 整个 result）成立；skill 主通道 `ralph_ops.mjs` 的 gate `printJson` 手工挑字段（:403-415），须单独加 `next`；`cli.mjs` 文本模式另加提示行。
- npx 兜底与本地 skill 版本漂移：仅最后回退，命中时打印警告。
- finalize MUST 化后若用户想先看完成报告再归档：happy path 本来就是 finalize → completion report，顺序不变，无需新交互。
- index 刷新下沉到 saveRun 的两条硬约束（先写 run.json 再刷 index；index 写失败 try/catch 降级不反噬主写入）已升格为 §4.6 验收条件，不再列为残余风险。
- task_plan.md 旧模板（`# Intent`/`## Problem`/`Open questions`）与 progress.md 双标题风格是迁移遗留，建议单独小任务，不混入本方案。

### 5.4 开放问题

- gate 输出 `next` 提示是否也要覆盖 `finalize` 失败（product-consistency reject）→ 建议本期先只做 accept PASS → finalize 主路径。
- ~~是否把「accept PASS 未 finalize」做成 CLI 侧状态告警（`jj ralph status` 输出 warning），形成第二道保险~~ → 已决策：纳入本期（§4.1）。SKILL 措辞会漂移，CLI 派生输出不会。
