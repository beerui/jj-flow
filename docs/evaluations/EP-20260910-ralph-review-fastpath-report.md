# jj-evaluated report — EP-20260910 Ralph / review 流程、等待、重复验证

> Status: **search sample；C-reviewer-exclusive-input-v1 已按客服 ASSIGNMENT-REVIEW 落地（G-review-2）；C-ralph-round-budget-v1 已落地（G-ralph-1）**
>
> Skill: `$jj-evaluated` → `$jj-ralph` / `$jj-review`（fastpath 落地后的首次真人会话）
>
> Recorded: 2026-09-10
>
> Note: 报告写在版本化 `docs/evaluations/`（jj-flow 禁止仓库内 `.workflow/`）。§1–6 是诊断当时的记录。G-ralph-1 / G-review-2 已落地；cheap replay 未做。不推进 ralph checkpoint。

对照基线：`EP-20260908-grok-latency-report.md`（fastpath 前）与已完成计划 `docs/exec-plans/completed/2026-09-09-workflow-execution-fastpath.md`。

## 1. Episode and role mapping

| Field | Value |
| --- | --- |
| episode_id | `EP-20260910-ralph-fastpath-time` · `EP-20260910-review-fastpath-time` |
| skill under eval | `$jj-ralph` · `$jj-review` |
| host | Grok（`grok-4.6` / `reasoning_effort=high` / `agent_name=grok-build-plan`） |
| role | omitted — 任务 ralph/review，不是 项目A / 项目B / 项目C |
| captured_at | `2026-09-10T14:13:45.591Z` |
| evidence provenance | 会话 `events.jsonl` / `summary.json` / `prompt_history.jsonl` / subagent `meta.json`；派生表冻结在 `.tmp/eval-20260910/` |

### 本集样本（search）

| 会话 | 仓 | 分支 @ freeze HEAD | 取样轮次 |
| --- | --- | --- | --- |
| `01a088eb-0f71-73f1-a692-6fb357f576b7` | `D:\2025\seo-daji-web` | `feat/dynamic-form` `447c16ce` | Ralph T0/T1；review T2/T5/T8 |
| `01a08938-03cd-7441-aadf-95d3ab08a595` | `D:\2025\scsk-admin` | `dev` `1fd7f231` | Ralph T0 |
| `01a08aa9-6f39-7f10-8fac-018260d0c61d` | `D:\2025\seo-daji-web` | `feat/dynamic-form` `447c16ce` | Ralph T0 |
| `01a089f8-3f97-78d1-a813-8a67b7a0d502` | `D:\2025\trade-exhibition-mobile` | `feat/dynamic-enter-form` `141c2f12` | Ralph T0 |
| `01a088e4-37e5-7f91-a7f2-6b5067b4b99b` | `D:\a\cj-web` | `feat/cj-0911-lyj` `d0fa753b` | review T1 + follow-up T3 |
| `01a08aa6-1e12-7b22-a701-a1588b572137` | `D:\2025\scsk-admin` | `feat/dynamic-form` `35fd4c7a` | review T1 |
| `01a08acc-f91e-7b80-abfe-4cdfbfc4749f` | `D:\2025\daji-merchants-mobile` | `feat/dynamic-enter-form` `acdfdfc0` | review T8（`/jj-review`，focus 的 prompt 字段偏了一格） |
| `01a08a50-337b-7e93-93ec-0bb5ed42169d` | `D:\2025\seo-daji-web` | `feat/dynamic-form` `447c16ce` | review T4（用户写 `review`） |

不要把这些仓改名为 项目A/B/C。

## 2. Baseline table and clock-quality caveats

轮次墙钟来自 `events.jsonl` 的 `turn_started` / `turn_ended`，阶段来自连续 `phase_changed` 时间差。`clock_quality=derived`，`timestamp_provenance=thread`。子代理 `duration_ms` 为 `exact` / `user_export`。父轮 `tool_execution` 已包含等子代理的时间，不能把 `duration_ms` 再加进去。

不用文件 mtime、整段 `sessionDurationSeconds` 或单独的 `run.json` 时长当历史阶段事实。工具 `duration_ms` 可重叠，不能加总替代墙钟。9 月 8 日与今天不是同一需求的受控对照，不能报端到端提速百分比。

三分法：

| 桶 | 计入 |
| --- | --- |
| 流程 | 读 skill/参考、locate、context 包、gate/finalize、review-record、父进程在 spawn 前后的编排 |
| 等待 | `waiting_for_model`；review 里等 `[reviewer]` 的 `tool_execution` |
| 重复验证 | 同一轮里第二次及以后的 test / fixtures / eslint / prettier |

### 2.1 新版 Ralph 首轮 vs 9 月 8 日

| 样本 | 墙钟 | 等到第一次改代码 | 模型等待 | 推理 | 工具阶段 | 循环/工具 | 验证 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 09-08 scsk 对照 | 880.1 s | 594.8 s | 197.2 s | 627.0 s | 26.8 s | 53 / 160 | fixtures 0.6 s + ESLint 1.9 s |
| seo 未入驻模板 T0 | 415.8 s | 261.9 s | 101.4 s | 262.7 s | 15.1 s | 31 / 72 | `node --test` ×1 |
| seo 仅主站 T1 | 600.8 s | 241.4 s | 210.9 s | 346.3 s | 29.3 s | 40 / 128 | test ×2 |
| scsk 企资 PDF T0 | 706.7 s | 349.1 s | 196.9 s | 442.5 s | 31.9 s | 41 / 148 | fixtures → lint → fixtures |
| seo 图片横排 T0 | 761.2 s | 253.2 s | 220.9 s | 427.9 s | 76.4 s | 48 / 119 | `rg`，无单测 |
| H5 区号 T0 | 755.8 s | 373.2 s | 227.5 s | 474.4 s | 37.2 s | 49 / 134 | test + prettier/eslint |

模型等待 + 推理仍占这些轮次墙钟的约 90–96%。第一次改代码从对照的 9.9 min 落到约 4.0–6.2 min。`context --review`、折叠 deliver/accept、finalize 已出现在轨迹里。

仍付出的流程税：首轮继续读 `SKILL.md`、`ops.md`、`phases.md`、`artifact-layout.md`、`must-evidence.md`、`tiny-example.md`；有的还跑 `locate --details`。图片横排 finalize 因目录 rename `EPERM` 连着重试 finalize / archive / remediate，把工具阶段拉到 76 s。

### 2.2 新版 review 首次 vs follow-up vs 9 月 8 日

| 样本 | 父墙钟 | 子代理（exact） | 父进程其余 | 二次全量 spawn |
| --- | ---: | ---: | ---: | --- |
| 09-08 对照 | 830.0 s | 504.6 s / 65 工具 | ~325 s（含 JSON 写回失败） | 否 |
| seo 首次 T2 | 508.4 s | 333.9 s / 52 工具 | ~174 s | 否 |
| cj 首次 T1 | 618.2 s | 435.5 s / 68 工具 | ~183 s | 否 |
| scsk 首次 T1 | 759.5 s | 493.5 s / 55 工具 | ~266 s | 否 |
| seo「当前的全部改动」T8 | 762.9 s | 659.0 s / 96 工具 | ~104 s | 是（用户明确） |
| seo 国家锁定 T4 | 920.0 s | 738.4 s / 85 工具 | ~182 s | 否 |
| H5 商家资料 T8 | 1281.4 s | 797.5 s / 69 工具 | ~484 s（locate/help 探测） | 否 |
| cj follow-up T3 | **140.0 s** | 无 | 整轮 | 否 |
| seo follow-up T5 | **140.1 s** | 无 | 整轮 | 否 |

父进程从对照约 5.4 min 收到约 2.8–4.4 min（H5 探测失败除外）。文件版 `review-record` 成功，9 月 8 日 PowerShell 内联 JSON 失败没有再出现。G-review-1 在两次 follow-up 上成立。

子代理 meta 已带上 `review-context.json` 路径、Goal/Steps 和任务文件列表，但 `effective_context_source=new`，仍是 52–96 次工具。包交出去了，审查进程仍按空白新上下文扫。

## 3. Failure / behavior tags and hypotheses

| Tag | 证据 | 假设 |
| --- | --- | --- |
| `redundant_analysis` | 五个 Ralph 首轮都读了 `phases`/`ops`/`layout`/`must`/`tiny`；skill 已写「不要启动全读」 | 入口缩短 + Immediate actions 不足以挡住 Grok high 的并行 Read |
| `subagent_overhead` | 首次 review 子代理 5.6–13.3 min；包已在 prompt 里 | 宿主 `/review` 一律新上下文；提示仍要求「再读 diff 里的源文件」 |
| `handoff_reuse` | cj/seo follow-up 各 140 s、无 spawn | 3b delta 有效；不要为了加速去改这条 |
| `tool_unavailable` | 图片横排 finalize `EPERM`；H5 review 找 `jj`/`ralph_ops` | 归档 rename 无重试；CLI 解析链在部分仓不直观 |
| `validation_wait` | scsk fixtures 二次；H5 test 后再 prettier/eslint | 重复验证存在，但不是分钟级主因 |
| `user_correction` | 「当前的全部改动」再开 96 工具 reviewer | 用户明确全量时允许；不要当成回归失败 |

因果主链（不是分数）：

1. Ralph 墙钟仍被模型等待和推理占满。fastpath 缩短的是改代码前的编排，不是推理。
2. Review 墙钟仍被新上下文 reviewer 占满。fastpath 缩短的是父进程交接和写回；follow-up 不再二次 spawn 是今天唯一接近「明显变快」的一段。
3. 重复验证不是今天的主因。

## 4. Optimization / holdout / regression split

Validate：`node skills/jj-evaluated/scripts/evaluated_ops.mjs check-split --manifest docs/evaluations/EP-20260910-ralph-review-fastpath.split.json` → ok。

| 组 | 成员 |
| --- | --- |
| search | `EP-20260910-ralph-fastpath-time`、`EP-20260910-review-fastpath-time` |
| holdout | 空；不对 proposer 报泛化分数 |
| regression | `EP-20260907-grok-review-subagent-waves`（G-review-1）；落地后加 `EP-20260910-ralph-assignment-rounds`、`EP-20260910-review-assignment-exclusive` |

9 月 8 日三份样本仍是先前 search，不进入本 split，避免和「fastpath 后」混成一对假对照。

执行计划（已落地；cheap replay 未做）：`docs/exec-plans/active/2026-09-10-ralph-review-process-wait.md`。

## 5. One candidate

**C-reviewer-exclusive-input-v1**（只动 review 交接，不改模型 effort，不撤独立审查）

机制：bound 首次审查的唯一主输入是已经生成的 `review-context.json` + 任务 diff + 包内 `task_paths`。禁止 reviewer 再 locate ralph、再读 jj-review/jj-ralph skill、对整仓 grep。需要调用链时只读 listed 文件的直接依赖。父进程第一件事是 `context --review`；包已在时不要再串读 `host-review.md`、宿主 review skill 和 `jj-review` 全文。

Grok 上 **不要走 bundled `/review` 编排器** 来做 bound 首次审查。今天子代理 description 全是 `[reviewer] local changes`，这是该技能 local 模式的固定标签：它自己收集整棵脏树 diff，spawn 模板要求 `read_file` diff 里的源文件，并且 `The reviewer is not resumed`。包已经写进 prompt 也挡不住。jj-review 自己 spawn 一个只读 reviewer。`/review` 只留给 unbound，或用户明确「当前的全部改动」/重新全量。不改 bundled `/review` 正文（非本仓 SSOT）。

预期：子代理工具次数从 52–96 收到「包内文件 + diff + 少量依赖」；父进程 spawn 前循环下降。不承诺墙钟百分比。

有界 diff：

- `skills/jj-review/SKILL.md` 步骤 4：bound 首次审查直接 spawn；提示必须声明 exclusive input；包未生成则先生成再 spawn；禁止为此路径调用宿主 `/review`。
- `skills/jj-review/references/host-review.md`「Context to pass」升为 exclusive 列表，而不是 minimum；Grok bound 首次审查绕过 `/review` 编排器。
- 合约测试：spawn 提示含 packet 路径、`task_paths`、禁止 locate/grep 整仓、禁止 bound 首次走 `/review` local 的句子。
- 不改 G-review-1；follow-up 继续禁止二次全量 spawn。落地后回归：`evals/regression/EP-20260910-review-assignment-exclusive.json`。合约：`tests/jj-review-contract.test.mjs`。

混杂：若 Grok 宿主仍把所有 review spawn 强制套上 bundled 模板（description 仍是 `[reviewer] local changes`、仍读整棵脏树），cheap replay 失败则归档，不要继续加长 skill。

## 6. Replay / 未做的验证

诊断当时未改生产 skill。之后 G-ralph-1 / G-review-2 已落地（合约 `tests/ralph/gates.contract.mjs`、`tests/jj-review-contract.test.mjs`）。未跑 cheap/expensive replay。

机械回归：`npm run verify`、`EP-20260907`、`EP-20260910-ralph-assignment-rounds`、`EP-20260910-review-assignment-exclusive`。真人复测需要同一 Grok 4.6 / high、绑定 run、脏工作区，记录：父循环、是否 spawn、子代理 `description` / `tool_calls` / `duration_ms` / `effective_context_source`、是否读 packet 外文件、是否仍出现 `[reviewer] local changes`。

## 7. Human decision / promotion

| 项 | 状态 |
| --- | --- |
| 本集 | 诊断已固化；Ralph / Review 客服派单已落地。Cheap replay 未做 |
| promote | Review `C-reviewer-exclusive-input-v1` 已按客服 `ASSIGNMENT-REVIEW` 落地（G-review-2）。Ralph `C-ralph-round-budget-v1` 已落地（G-ralph-1）。 |
| rollback | 不落地则无回滚；若落地，回退上述两个文件并保留 G-review-1 |

后续切片（不要和 review 候选并进）：

1. **C-ralph-round-budget-v1**（用户 2026-09-10 批准「跟客服一样」）：对话路径 full **不**按终身 `max_iterations` 停。同一 `run_id` 拆成当前未勾 Step；`scope --replace-in` / 从 COMPLETED·ABANDONED·PAUSED `resume` 开新轮并重置 attempt。`STAGNATION` 仍挡。机械 `--lite` 仍封顶。G-ralph-1。不补 `set-budget`。证据：`cj-web` `task-260911-risk-setting`。
2. **C-ralph-no-eager-refs-v1**：首轮禁止读 `phases`/`ops`/`layout`/`must`/`tiny`，除非 `next` 点名；默认 `locate` 不用 `--details`。
3. **C-finalize-rename-retry-v1**：`finalize` 目录 rename `EPERM` 有限次重试。

## 8. Next data-collection

- 冻结目录：`D:\daji-docs\jj-flow\.tmp\eval-20260910\`（`today-focus.json` sha256 `a85a8634f0ee12fb773b6758d88ab2f4d40e210d222a93449a19c3323158db0b`，`today-trace2.json` sha256 `19b0a329d1024380f319f88c75b16613d8fce4fd2178eedfe8cdb23955a1a59a`，`today-ralph-review-timing.json` sha256 `795d6005c776e28abe910f4452d456a1ecd6a238ef1488d2ae2af823c0ae1812`）。
- 原始会话仍在本机 `~\.grok\sessions\...`；版本化 episode 只保留路径、哈希和派生指标。
- 未取未参与调优的 holdout 会话。下次真人复测应另开仓/另开需求，不要用本集八个线程打分。
- 未纳入评分（不事后扩 search）：`01a08acc` freeze T8 prompt 仍偏一格（「编辑信息不需要展示」）；episode 以 `prompt_history` 的 `2026-09-10T12:34:48.422Z` `/jj-review` 为准。同线程 T9 另一次 `/jj-review` 墙钟 313.736 s、父 `tool_execution` 21.168 s，不像二次全量 spawn，未写入 episode。

Validate / check-split（2026-09-10 复跑）：

- `EP-20260910-ralph-fastpath-time.episode.json` → ok，shape=`episode_wrapper`，events=5，warnings=0
- `EP-20260910-review-fastpath-time.episode.json` → ok，shape=`episode_wrapper`，events=14，warnings=0
- `EP-20260910-ralph-review-fastpath.split.json` → ok，warnings=0
