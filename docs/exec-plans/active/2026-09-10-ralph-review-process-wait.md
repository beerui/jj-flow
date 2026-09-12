# Ralph / review 流程等待

> 状态：active

开始：2026-09-10。依据 `docs/evaluations/EP-20260910-ralph-review-fastpath-report.md`（fastpath 落地后的真人 Grok 会话）。对照基线 `EP-20260908-grok-latency-report.md` 与已完成计划 `docs/exec-plans/completed/2026-09-09-workflow-execution-fastpath.md`。

这些是诊断样本，不是受控性能基准。不报端到端提速百分比。无人工批准不写生产 skill。

## 目标与边界

减少 bound 首次 `$jj-review` 里新上下文 reviewer 对整棵脏树的重扫。保留独立只读审查、G-review-1 follow-up delta、模型 `reasoning_effort`、以及用户明确「当前的全部改动」时的全量路径。

不在本切片改 Ralph 参考文档税、finalize `EPERM` 重试、bundled `/review` 正文、或 ralph/dispatch checkpoint。

## 候选

**C-reviewer-exclusive-input-v1**（一次只做这一刀）

| 项 | 内容 |
| --- | --- |
| 机制 | bound 首次审查：先 `ralph_ops context --review` 生成包，再由 jj-review **直接** spawn 一个只读 reviewer。唯一主输入 = `review-context.json` + 任务 diff + `task_paths`。禁止 locate ralph、读 jj-review/jj-ralph skill、整仓 grep。依赖只读 listed 文件的直接 import。 |
| 为何不走 `/review` | 今日子代理 description 全是 `[reviewer] local changes`。Grok bundled `/review` local 模式会自己收集整棵脏树 diff，spawn 模板要求 `read_file` 源文件，且 reviewer 不 resume。包写进 prompt 挡不住。 |
| `/review` 仍可用 | unbound，或用户明确「当前的全部改动」/重新全量。 |
| 非目标 | 不改模型 effort；不撤独立 reviewer；不改 G-review-1；不编辑 `~/.grok/bundled/skills/review/SKILL.md`。 |

## 任务

- [x] 人工批准本候选（或归档）。无批准则停。用户 2026-09-10：「客服那边审查是怎么做的 参考那个做」。
- [x] `skills/jj-review/SKILL.md` 步骤 4：bound 首次审查直接 spawn；exclusive input；包未生成则先生成；禁止为此路径调用宿主 `/review`。G-review-2。
- [x] `skills/jj-review/references/host-review.md`「Context to pass」改为 exclusive 列表；写明 Grok bound 首次审查绕过 `/review` 编排器。
- [x] `tests/jj-review-contract.test.mjs`：packet 路径、`task_paths`、禁止整仓 locate/grep、禁止 bound 首次走 `/review` local。保留现有 G-review-1 断言。
- [x] 落地后才加 `evals/regression/` 新项：`EP-20260910-review-assignment-exclusive.json`。
- [x] `npm run verify`、相关合约测试、`git diff --check`；`node src/cli.mjs install-skill --platform all --force`。
- [x] `C-ralph-no-eager-refs-v1` + G-ralph-2：入口不挂五份手册；parent 是 team-lead，本轮 spawn；删除 `tiny-example.md`；回归 `EP-20260911-ralph-lead-spawn`。
- [x] Parent spawn 前用户可见进度：派遣开发实现 / 派遣审查（例句「派遣前端开发实现任务」「派遣reviewer审查改动代码」）。样本 miss：`01a08fa0`。
- [ ] cheap replay：同一 Grok 4.6 / high、绑定 run、脏工作区。失败则归档，不加长 skill。

Cheap replay 记录：父循环、是否 spawn、子代理 `description` / `tool_calls` / `duration_ms` / `effective_context_source`、是否读 packet 外文件。失败信号：description 仍是 `[reviewer] local changes`，或子代理仍扫整棵脏树。

## 实施决策

- 工作分支：`codex/workflow-execution-fastpath`。
- Review `C-reviewer-exclusive-input-v1`：用户 2026-09-10 批准「参考客服审查」，按 `ASSIGNMENT-REVIEW` 落地（G-review-2）。
- Ralph `C-ralph-round-budget-v1`：用户 2026-09-10 批准「跟客服一样」，已落地。再后：`C-ralph-no-eager-refs-v1`、`C-finalize-rename-retry-v1`。

## Ralph 本切片（已落地，验收中）

**C-ralph-round-budget-v1** — 对齐客服：同一文件夹活一辈子，复杂工作拆成当前这一刀，没有终身循环上限。

- 对话路径 `gate_set=full`：`deliver-attempt` **不**因 `max_iterations` / `max_deliver_loops` BLOCK。
- 当前这一刀 = 下一个未勾 Step；不要在同一轮开始后面的 Step。
- `scope --replace-in` 与从 COMPLETED / ABANDONED / PAUSED `resume`：开新 progress 轮并重置 attempt 计数。STAGNATION 从 BLOCKED resume 不重置。
- 机械 `--lite` 仍封顶 `max_deliver_loops=3`（`MAX_ITERATIONS`），升 full 后继续。
- 不补 `set-budget`；禁止 `set-status` 假装抬上限。G-ralph-1。

**C-ralph-no-eager-refs-v1**（本刀）：入口不挂 `ops` / `phases` / `artifact-layout` / `must-evidence` / `tiny-example`。Parent = team-lead：写派单并本轮 `spawn_subagent`（`general-purpose`），禁止在主对话改业务代码。删除 `tiny-example.md`。G-ralph-2。`$jj-review` 同样不启动读 reference、不在 parent 审。

## 验证记录

2026-09-10 固化（无产品 diff）：

- `evaluated_ops validate`：`EP-20260910-ralph-fastpath-time` events=5 ok；`EP-20260910-review-fastpath-time` events=14 ok。
- `evaluated_ops check-split`：`EP-20260910-ralph-review-fastpath.split.json` ok；holdout 空。

2026-09-10 Ralph `C-ralph-round-budget-v1` 落地后：

- 合约：`tests/ralph/gates.contract.mjs`（full 无终身 cap、lite 仍 cap、`scope --replace-in` 开新轮、COMPLETED resume 重置 vs STAGNATION 不重置）、`tests/ralph/context.contract.mjs`（full `iteration: 2`）、`tests/ralph/assets.contract.mjs`（G-ralph-1 / `beginAssignmentRound`）。
- 回归：`evals/regression/EP-20260910-ralph-assignment-rounds.json`。
- `npm run verify`：463/463 pass；`ralph:check` in_sync=17；`evaluated:check` 含 G-ralph-1；`git diff --check` 无 error。
- 上一轮 `npm test` 7 fail 来自本计划状态行写成 `active（候选待批准，未实施）`（HNS-EXEC-PLAN-STATUS-002）；已改回 `active`。

2026-09-10 Review `C-reviewer-exclusive-input-v1` 按客服 `ASSIGNMENT-REVIEW` 落地后：

- 合约：`tests/jj-review-contract.test.mjs`（G-review-2 exclusive `task_paths`；禁止 bound 首次 Grok `/review`；G-review-1 保留）。
- 回归：`evals/regression/EP-20260910-review-assignment-exclusive.json`。
- `npm run verify`：464/464 pass；`evaluated:check` 含 G-review-2；`git diff --check` 无 error；skill 已 `--force` 分发。Cheap replay 未做。

2026-09-10 按审查改（unbound working-tree review，未落盘）：

- F-1：bound 首次发现顺序不再 first-match `/review`；列文件 spawn 就是宿主路径。
- F-2：`phases.md` intensity 表标明 `max_iterations` 仅 `--lite` BLOCK；init progress 写 schema default。
- F-3：合约断言 packet 路径 + 禁止 locate/grep/读 skill。
- F-4：CHANGELOG 指向 `tests/ralph/gates.contract.mjs`；评估报告区分诊断与已落地。
- F-5：`scope --replace-in` 抬起上一刀 `STAGNATION`；补 PAUSED / ABANDONED resume 重置测试。
- `npm run verify`：464/464 pass（中间一次 `collect-port-evidence` Windows EBUSY 属无关 flake，重跑通过）。
- F-6：用户明确「当前的全部改动 / 重新全量审查」时，即使 bound 也走 4b/`/review`；默认 bound 首次仍 exclusive spawn。

## 回滚

不落地则无回滚。若落地：回退 `skills/jj-review/SKILL.md` 与 `references/host-review.md`（及对应合约测试 / 回归项），保留 G-review-1。
