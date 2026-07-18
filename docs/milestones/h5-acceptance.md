# H5 持续熵清理验收

> 状态：completed
>
> 范围：Harness Engineering H5，只读 entropy scan、质量评分和版本化基线

## 交付结果

- `src/harnessGc.mjs` 扫描 Harness 门禁、文档站覆盖、schema 登记、host action fixture、invariant owner、exec plan 归档和重复 helper。
- `jj harness-gc --json` 与 `npm run harness:gc` 输出统一结构化报告和 100 分质量评分。
- P0/P1 finding 阻断，P2/P3 保留为小型维护候选；所有 finding 均声明 `auto_fix_eligible=false`。
- `harness-manifest.json` 为每条 invariant 指定 owner，并登记 GC runner、schema、test、baseline、最低分和只读策略。
- `scripts/check-harness.mjs` 校验 baseline 状态、最低分、只读策略和 runner fingerprint；过期基线会 fail closed。

## 机械验收

| 验收项 | 证据 |
| --- | --- |
| 当前仓库 GC PASS 且分数不低于 95 | `docs/milestones/h5-gc-baseline.json` |
| GC 只读且不创建 `.workflow` | `tests/harness-gc.test.mjs` |
| 注入 P1 漂移时 FAIL | `tests/harness-gc.test.mjs` |
| CLI 输出结构化 JSON | `tests/harness-gc.test.mjs` |
| baseline 与 runner fingerprint 保持一致 | `scripts/check-harness.mjs` |
| 日常验证持续运行 GC | `package.json` 中的 `verify` |

## 边界

H5 首版是只读 gardener，不自动删除、重写、提交或合并。P2/P3 代表候选维护成本，不等于必须抽象；局部重复在保持独立更清晰时可以保留。真实 Codex App thread/sandbox 联调仍属于部署环境验证，与 GC 完成状态无关。
