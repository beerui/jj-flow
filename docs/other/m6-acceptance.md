# M6 验收报告：主调度运行时与项目差异决策

- **里程碑**：M6
- **阶段**：P11 主调度可恢复运行时、P12 目标差异与决策门禁
- **结论**：`PASS`（协议层与自动化测试已满足；真实 Codex App host 联调保留为下一里程碑）
- **日期**：2026-07-17
- **基线提交**：`5647fe7`（`feat: 加固 jj-dispatch 可恢复 tick 与目标差异门禁`）

## 需求闭合

| 需求 | 状态 | 证据 |
|------|------|------|
| REQ-DISPATCH-RUNTIME | 完成 | `src/dispatchRuntime.mjs`、`jj dispatch-tick`、`tests/dispatch-runtime.test.mjs` |
| REQ-TARGET-DIFFERENCE | 完成 | 目标 `analysis` 门禁、`eligibleProjects` 独立派发、相关 runtime/contract 测试 |

## P11 验收对照

| 成功标准 | 结果 | 证据 |
|----------|------|------|
| 单次 tick/resume 以 `expected_revision` 拒绝旧快照写入 | PASS | `runtime tick rejects stale revision...`；`persistPlaneCas rejects stale expected revision...` |
| 结构化 receipt 可幂等消费并输出 `actions` / `decision_required` / `next_wait` | PASS | `receipt envelope...idempotent`；tick 成功路径返回 `actions`/`decision_required`/`next_wait` |
| 主调度关闭后可从 manifest 恢复且不需要 daemon | PASS | `resume re-emits CREATE_THREAD for pending intents...`；CLI 单次 `dispatch-tick` 无后台进程 |
| 文件写回为 revision CAS | PASS | `persistPlaneCas` + CLI `--write` |
| receipt `attempt` 与 `task_key`/intent 绑定 | PASS | `receipt attempt must match task_key and live intent attempt` |

## P12 验收对照

| 成功标准 | 结果 | 证据 |
|----------|------|------|
| 开发前要求 `ANL-TARGET`、`difference_ref`、`knowledge_refs` | PASS | `runtime tick blocks target dispatch until approved ANL-TARGET...` |
| `DIRECT/ADAPT/SYNC/NO_CHANGE_REQUIRED/BLOCKED` 可追溯 | PASS | `DIFFERENCE_DECISIONS` + control-plane 校验与 contract 测试 |
| 缺分析/缺批准时保持 `decision_required` | PASS | 全局无就绪目标 → `DECISION_REQUIRED`；部分就绪 → 就绪目标可派发，未就绪进 `decision_required` |
| 目标决策互相独立 | PASS | `one target waiting for analysis does not block another ready target` |
| 不可绕过目标分析 | PASS | `target analysis cannot be bypassed...`；移除 `--no-target-analysis` |

## 自动化验证

```bash
node --test tests/dispatch-runtime.test.mjs tests/jj-dispatch-contract.test.mjs
npm run verify
```

在 `5647fe7` 基线上：`npm run verify` 通过（106 tests）。

## 明确不做 / 留给后续

- 不实现常驻 daemon、数据库、自动 merge/push/release。
- 不在本里程碑完成真实 Codex App 多项目联调（列为 M7）。
- 控制项目知识库与业务仓库知识库的运营规范，在真实控制仓试跑时沉淀。

## 下一里程碑建议（M7）

**真实控制项目试跑与 host 闭环**

1. 用独立控制仓 + `examples/project-family-control` 跑通 PREVIEW → 批准 → tick → BIND → receipt → resume。
2. 补 host 侧 receipt 样例与失败恢复演练清单。
3. 按试跑结果收紧 skill 提示与 schema 缺口。
