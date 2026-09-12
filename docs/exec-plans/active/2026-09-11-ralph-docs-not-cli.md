# Ralph 对话记账文档约束

> 状态：active

开始：2026-09-11。依据用户：「记账也不该跑 cli，所有的都应该参考客服流程 不应该有cli」。对照客服：team-lead 写派单、spawn、把进度写进 markdown；没有 `ralph_ops` / `jj ralph`。

## 目标与边界

对话 `$jj-ralph` / `$jj-same` / `$jj-dispatch` / `$jj-review` 只写文档（`task_plan.md` / `progress.md` / `findings.md` / `assignments/` / `index.md` / `.state/run.json` / plane）。不跑 locate / init / deliver-attempt / gate / finalize / review-record CLI。

机械 `jj ralph` / `ralph_ops` 仍给 CLI 用户。不改 accept 门禁语义。不删引擎。不宣称端到端提速。`$jj-end` 仍是 Git。

## 任务

- [x] `jj-ralph` SKILL：Conversational documents 表；G-ralph-3；init/abandon/locate/finalize 都写文件。
- [x] `ops.md`：对话永不跑 gate；机械折叠与 degraded unfold 仍留给 CLI。
- [x] `jj-same`：缺目标仓 Ralph 写文档，永不 `jj ralph init`。
- [x] `jj-dispatch`：对话读 plane，不跑 CLI 矩阵。
- [x] 合约 / 回归 / 文档 / CHANGELOG。
- [x] cheap replay：Loop gym 干净副本 ` .tmp/docs-not-cli-trial`；开单写文档；ASSIGNMENT-TASK1 spawn；记账 append `progress.md` + 双写 `run.json`；无 `ralph_ops`。

## 验证记录

2026-09-11 `C-ralph-docs-not-cli-v1` 落地后：

- 合约：`tests/ralph/assets.contract.mjs`（G-ralph-3、Conversational documents、ops 不再要求对话跑 gate）、`tests/jj-same-contract.test.mjs`（永不 `jj ralph init`）、`tests/jj-dispatch-contract.test.mjs`（对话不跑 CLI 矩阵）。
- 回归：`evals/regression/EP-20260911-ralph-docs-not-cli.json`。
- `npm run verify` 471/471 pass；`ralph:check` in_sync=17；`git diff --check` 无 error。
- skill 已 `install-skill --platform all --force` 与 `--platform all --project --force`。
- 2026-09-11 cheap replay（Loop gym 干净 clone，不污染 `lab:check` 物化仓）：
  - 活 gym 有 8 条活跃 → 按 skill 应询问用户；试验改用无 `.workflow` 的 seed clone。
  - 开单：手写 `task-empty-label-zh/`，无 `jj ralph init`。
  - spawn `01a08fa4`：7 tools（read_file / search_replace / `node --test`）；events 无 `ralph_ops` / `jj ralph` / `deliver-attempt` / `gate` / `finalize`。
  - 主对话未改 `src/format.mjs`。验证 3/3 pass。tiny 跳过审查，停在 `READY_FOR_USER_TEST` 等验收（未 finalize）。
