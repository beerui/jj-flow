# Harness Engineering 收口与真实 Host 路径

> 状态：active
>
> 负责人：Repository Harness
>
> 开始日期：2026-07-18

## 目标

让 Harness 从“当前工作树可运行”收敛为 fresh clone 可发现、可验证、可恢复的版本化工程系统，并为真实 Codex App Host 验收保留明确边界。

## 非目标

- 不让 Node.js 核心 runtime 直接调用 Codex App API。
- 不启用自动 merge、push 或 release。
- 不引入完整 Prometheus、LogQL 或分布式追踪栈。
- 不把 `.workflow`、聊天或本机缓存作为交付事实源。

## 执行波次

### Wave 0：Repository Truth Plane

- [x] 建立 `docs/exec-plans/active`、`completed` 和索引。
- [ ] 将 Harness 权威资产提交到 Git，并从 fresh clone 运行完整验证。

### Wave 1：文档与门禁自洽

- [x] 修正 Harness 成熟度评分和阶段描述漂移。
- [x] 让 Harness 机械验证 exec plan 索引、状态和成熟度评分。
- [x] 增加反例测试，证明过期文档和未索引计划会 fail closed。

### Wave 2：真实 Host 验收

- [ ] 在真实 Codex App project/worktree 中执行开发、Review、返工和恢复。
- [ ] 保存由宿主产生的 runtime sandbox attestation 和结构化 receipt。
- [ ] 只有真实验收通过后，才评估把最大无人值守等级从 A1 提升到 A2/A3。

### Wave 3：持续 Gardener

- [x] 增加定时只读 `harness:gc` 工作流和结构化 artifact。
- [x] P0/P1 漂移创建或更新一个去重 issue；禁止自动修改业务文件。

## 决策日志

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-07-18 | 执行状态进入 `docs/exec-plans`，不使用 `.workflow` | 版本化仓库是唯一记录系统，隐藏状态不能推进 Harness 检查点 |
| 2026-07-18 | 真实 Host adapter 留在宿主边界 | npm runtime 无权代表 Codex App 创建 task 或签发 sandbox attestation |
| 2026-07-18 | Gardener 首版只读 | 先证明 finding 精度，再考虑有限白名单修复 |

## 验收命令

```bash
node --test tests/harness-check.test.mjs tests/harness-gc.test.mjs tests/docs-site.test.mjs
npm run verify
git diff --check
```

## 当前验证记录

- `node --test tests/harness-check.test.mjs`：17/17 PASS（含 Gardener 权限 allowlist 反例）。
- `node --test tests/docs-site.test.mjs`：5/5 PASS。
- `node scripts/check-project.mjs`：PASS。
- `node scripts/check-harness.mjs`：PASS。
- `npm run docs:check`：PASS。
- `npm run verify`：150/150 tests、Harness GC 98/A、4 个 scenario、semi-real Host trial 和 docs check 全部 PASS。
- `actionlint`：本机不可用；workflow 已通过 YAML 解析和 Harness 静态权限契约检查。

## 完成条件

1. fresh clone 不依赖聊天、memory 或 `.workflow` 即可通过 `npm run verify`。
2. 未索引 exec plan、非法成熟度分数和文档/manifest 分数漂移都会触发结构化 finding。
3. 定时 Gardener 上传 JSON 报告，P0/P1 时创建或更新去重 issue，且没有自动修复权限。
4. 真实 Codex App Host 缺口继续以 `PENDING` 保留，不能被半真实报告替代。
