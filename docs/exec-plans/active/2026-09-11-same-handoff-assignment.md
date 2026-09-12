# same / dispatch 交接派单与人设提示词

> 状态：active

开始：2026-09-11。依据真人 Grok 会话 `01a08e5b`（`/jj-dispatch` 再 `$jj-same`：`run.handoff` 空、`distribution_prompt` 仍是旧识票验收、parent 直接改目标仓）。对照客服 ASSIGNMENT-TASK 形状与 team-snapshot 人设提示词。

无人工批准不写生产 skill。本刀用户已要求按客服改。

## 目标与边界

交接要把**本轮**任务写成派单文档，到对应仓库调研，再根据任务文档 spawn。任务派发的执行人 spawn 必须带前置人设提示词提示词。

不把 dispatch 改成 ralph team-lead 实施器。dispatch 仍是控制面；same 仍是实施器。不改 `src/dispatch*` / `src/ralph*` 引擎。不宣称端到端提速。

## 候选

**C-same-assignment-onboard-v1**

| 项 | 内容 |
| --- | --- |
| 机制 | `$jj-same` parent = team-lead。每目标仓写 `ASSIGNMENT-RESEARCH` → spawn 只读调研 → 写 `ASSIGNMENT-HANDOFF` → spawn 实施（派单前缀 + exclusive 文件）。`distribution_prompt` 不是执行人 spec，也不是人设提示词。 |
| 人设提示词 | spawn prompt 开头贴客服子集：不是 team-lead、exclusive 文件、先确认再开工、调研只读、实施不 commit、短句汇报。全文在 `skills/jj-same/references/onboarding.md`，不挂入口。 |
| 非目标 | 不改 Mode S/W/P；不把 SendMessage / `.plans/daji-cs` 拷进 Grok；same 入口不 markdown 链接新手册。 |

## 任务

- [x] same：`references/assignment.md` + `references/onboarding.md`；SKILL 对话路径 + 派单前缀 + G-same-1。
- [x] dispatch：批准后交给 `$jj-same` 对话路径；`distribution_prompt` 标明不是执行人 spec / 人设提示词。
- [x] ralph `artifact-layout` 树列出 RESEARCH / HANDOFF；修好文件形状段。
- [x] 合约 / 回归 / 用户文档 / CHANGELOG / 本计划。
- [x] 可选 cheap replay：同一「DISPATCH 再 $jj-same」形状，确认 parent 写派单并 spawn，而不是 `search_replace`。

## 验证记录

2026-09-11 `C-same-assignment-onboard-v1` 落地后：

- 合约：`tests/jj-same-contract.test.mjs`（G-same-1、派单前缀、不挂 onboarding/assignment）、`tests/jj-dispatch-contract.test.mjs`、`tests/ralph/assets.contract.mjs`。
- 回归：`evals/regression/EP-20260911-same-handoff-assignment.json`。
- `npm run verify`：468/468 pass；`ralph:check` in_sync=17；`evaluated:check` 含 G-same-1；`git diff --check` 无 error。
- skill 分发见下一条。

2026-09-11 cheap replay（Family gym 干净 clone，不污染 `lab:check` 物化仓）：

- 隔离 `.tmp/docs-not-cli-family/{notes-alpha,notes-beta,control}`。
- `$jj-dispatch`：手写 `DEL-empty-label-zh` plane + C4 attestations；无 `jj dispatch-tick` / `jj task scaffold` / `ensureDispatchRalphRuns`。
- `$jj-same`：`ASSIGNMENT-RESEARCH-notes-beta` spawn `01a08fb9` → `ASSIGNMENT-HANDOFF-notes-beta` spawn `01a08fbc`（均带派单前缀）。lead 实施 spawn `01a08fb7`。
- 主对话未改 `src/views/list.js` / `src/screens/NoteList.js`。决策 ADAPT。
- 验证：alpha 4/4 PASS；beta 3/3 PASS。dirty → `EVIDENCE_READY`；未 commit、未 VERIFIED。
