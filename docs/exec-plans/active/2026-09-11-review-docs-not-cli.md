# Ralph review 文档约束

> 状态：active

开始：2026-09-11。依据真人 Grok 会话 `01a08ea0`（审查员 06:40 已写 `[BLOCK]`，主对话到 06:45 仍在 `review-record` / skeleton / `FINDING_SEVERITIES`）。对照客服：审查是派单 + findings，不是 CLI。

## 目标与边界

对话 `$jj-review` / ralph `next=review` 只靠 `ASSIGNMENT-REVIEW` 和 `findings.md`（bound 再写 `REV-n.json`）。不跑 `ralph_ops context --review` / `review-record`。`HIGH` 能落盘。审查员只读 listed 文件。`[BLOCK]` 本轮必须回用户。

机械 `jj ralph review-record` 仍给 CLI 用户。不改 accept 门禁语义。不宣称端到端提速。

## 任务

- [x] `jj-review` SKILL：文档 persist、G-review-3、exclusive listed files、文案/样式 skip。
- [x] `jj-ralph` SKILL：`next=review` 不点名 CLI 落盘。
- [x] `normalizeFindingSeverity`：`HIGH`→`high`（机械 CLI 也不炸）。
- [x] 合约 / 回归 / 文档 / CHANGELOG。
- [x] 堵住剩余对话口：`claude-commands/jj-ralph.md` 不再教 `context --review`；strict 门禁错误指向 `$jj-review`；persist 写 `reviews[]` + `accept_layers.judgment`。
- [ ] 可选 cheap replay：同一 `[BLOCK]` 形状，确认先回用户、不 grep ralph 源码。

## 验证记录

2026-09-11 `C-review-docs-not-cli-v1` 落地后：

- 合约：`tests/jj-review-contract.test.mjs`（G-review-3、不 Prefer CLI、`accept_layers.judgment`）、`tests/ralph/review.contract.mjs`（`HIGH`→`high`）、`tests/ralph/conversation.contract.mjs`（strict 错误指向 `$jj-review`）、`tests/ralph/assets.contract.mjs`（命令入口不教 `context --review`）。
- 回归：`evals/regression/EP-20260911-review-docs-not-cli.json`。
- `npm run verify` pass；`ralph:check` in_sync=17；`git diff --check` 无 error。
