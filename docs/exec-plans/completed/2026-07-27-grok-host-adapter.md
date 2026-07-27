# Grok Host Adapter Phase 1 — 契约扩展

> 状态：completed
>
> 负责人：Repository Harness
>
> 开始日期：2026-07-27
>
> 完成日期：2026-07-27
>
> 关联设计：[Grok Host Adapter](../../design-docs/grok-host-adapter.md)
>
> 边界：本计划只覆盖 **Phase 1 契约与纯状态测试**；不实现 Grok adapter 执行面、不写真实试跑 evidence、不提升 `max_unattended_level`
>
> 残留风险：Phase 2/3 未开始；设计文档整体仍为 Proposed；真实 Grok 路径不可用于关闭 Wave 2

## 目标

在不伪造 Codex thread API 的前提下，把 Grok Build 作为可选第二宿主写进 **可验证契约**：

1. `host_id` / `handle_kind` 枚举与 host profiles 进入 host-action-contract 与 runtime 常量。
2. control-plane intent 兼容 session handle（`thread_id` 字段存 handle 值 + `handle_kind=session`）。
3. 缺 attestation 的绑定与假 Grok 证据 fail-closed。
4. 合约测试纯状态、无网络。

## 非目标

- Phase 2：项目注册表、worktree 生命周期、可脚本化 create/bind/reconcile。
- Phase 3：真实 Grok 会话试跑与 A2 评估。
- 新增 `CREATE_SESSION_TASK` / `RECONCILE_SESSION` 运行时 action 类型（首版靠 `host_id` 分流复用 `CREATE_THREAD` / `RECONCILE_THREAD`）。
- 修改 `autonomy.max_unattended_level`。

## 执行清单

### Wave A：版本化计划与契约面

- [x] 开 active exec plan 并登记索引 / 文档站构建
- [x] 扩展 `host-action-contract` + schema：`host_ids`、`handle_kinds`、`host_profiles`
- [x] 同步 `src/dispatchHostContract.mjs` 常量与 attestation 纯校验
- [x] control-plane schema / runtime：`handle_kind` 字段与 bind 规则

### Wave B：门禁与测试

- [x] harness-check 对 host profiles 做 parity；反例：缺 attestation / 伪 Grok 证据不得 PASS
- [x] 新增 `tests/grok-host-contract.test.mjs`
- [x] 更新 skill 文案：dispatch 需已批准 Host；Grok 路径见设计文档
- [x] 跑合约测试与 `npm run verify`

## 决策日志

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-07-27 | 首版复用 `CREATE_THREAD` / `RECONCILE_THREAD` 类型名，用 `host_id` + `handle_kind` 分流 | 控制面状态机单一；避免双 action 枚举分叉 |
| 2026-07-27 | `session_id` 写入现有 `thread_id` 字段，强制 `host_id=grok-build` 且 `handle_kind=session` | 兼容现有 bind/reconcile API 与 schema 必填 `thread_id` |
| 2026-07-27 | 未知 `host_id`（如 trial fixture `host-main`）默认 `handle_kind=thread` | 不破坏既有半真实与合约测试 |
| 2026-07-27 | Phase 1-only 收口进 `completed/`，Phase 2 另开计划 | 契约面已可独立验收；避免 active 计划无限扩展 |

## 验收命令

```bash
node --test tests/grok-host-contract.test.mjs tests/jj-dispatch-contract.test.mjs tests/harness-check.test.mjs tests/host-trial.test.mjs
npm run harness:check
npm run verify
git diff --check
```

## 验证记录

- `node --test tests/grok-host-contract.test.mjs tests/jj-dispatch-contract.test.mjs tests/harness-check.test.mjs tests/host-trial.test.mjs tests/dispatch-runtime.test.mjs`：PASS（90）
- `npm run verify`：PASS（含 harness:check、scenario:check、host:trial、docs:check）
- Phase 1 契约目标完成并归档。

## 后续工作（不在本计划范围）

1. Phase 2：控制项目注册表 + worktree 生命周期 + 可脚本化 create/bind/reconcile + doctor 边界。
2. Phase 3：真实 Grok 试跑 evidence；**禁止** 与 semi-real 混用。
3. 设计文档在 Phase 3 真实验收前保持 Proposed，不因 Phase 1 升为 Implemented。
