# Harness Engineering 收口与真实 Host 路径

> 状态：completed
>
> 负责人：Repository Harness
>
> 开始日期：2026-07-18
>
> 完成日期：2026-07-27
>
> 残留风险：真实 Codex App Host 仍为 [PENDING 里程碑](../../milestones/real-host-acceptance.md)；`autonomy.max_unattended_level` 保持 `A1`

## 目标

让 Harness 从“当前工作树可运行”收敛为 fresh clone 可发现、可验证、可恢复的版本化工程系统，并为真实 Codex App Host 验收保留明确边界。

## 非目标

- 不让 Node.js 核心 runtime 直接调用 Codex App API。
- 不启用自动 merge、push 或 release。
- 不引入完整 Prometheus、LogQL 或分布式追踪栈。
- 不把 `.workflow`、聊天或本机缓存作为交付事实源。
- 不用半真实 host trial 冒充真实 Codex App 验收。

## 执行波次

### Wave 0：Repository Truth Plane

- [x] 建立 `docs/exec-plans/active`、`completed` 和索引。
- [x] 将 Harness 权威资产提交到 Git，并从 fresh clone 运行完整验证。

### Wave 1：文档与门禁自洽

- [x] 修正 Harness 成熟度评分和阶段描述漂移。
- [x] 让 Harness 机械验证 exec plan 索引、状态和成熟度评分。
- [x] 增加反例测试，证明过期文档和未索引计划会 fail closed。

### Wave 2：真实 Host 边界（半真实已证 / 真实 PENDING）

- [x] 半真实路径：临时控制仓 + 真实 Git worktree 完成开发、Review、返工和恢复（见 M7）。
- [x] 版本化保留真实 Host 缺口为 `PENDING`，禁止用 semi-real 报告关闭该缺口（见 `docs/milestones/real-host-acceptance.md`）。
- [x] 在真实 Host 验收通过前，**不** 将 `max_unattended_level` 从 `A1` 提升到 `A2`/`A3`（当前 manifest 仍为 `A1`）。
- [ ] （残留 / 部署环境）在真实 Codex App project/worktree 中执行开发、Review、返工和恢复。
- [ ] （残留 / 部署环境）保存由宿主产生的 runtime sandbox attestation 和结构化 receipt。

### Wave 3：持续 Gardener

- [x] 增加定时只读 `harness:gc` 工作流和结构化 artifact。
- [x] P0/P1 漂移创建或更新一个去重 issue；禁止自动修改业务文件。

## 决策日志

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-07-18 | 执行状态进入 `docs/exec-plans`，不使用 `.workflow` | 版本化仓库是唯一记录系统，隐藏状态不能推进 Harness 检查点 |
| 2026-07-18 | 真实 Host adapter 留在宿主边界 | npm runtime 无权代表 Codex App 创建 task 或签发 sandbox attestation |
| 2026-07-18 | Gardener 首版只读 | 先证明 finding 精度，再考虑有限白名单修复 |
| 2026-07-27 | Wave 0 以 fresh clone `npm run verify` 关闭 | 证明权威资产已入库且不依赖聊天、memory 或工作区脏状态 |
| 2026-07-27 | 本计划 completed，真实 Host 单列 PENDING 里程碑 | 完成条件要求缺口以 PENDING 保留；仓库侧收口与宿主联调解耦，避免计划永久卡在 active |

## 验收命令

```bash
node --test tests/harness-check.test.mjs tests/harness-gc.test.mjs tests/docs-site.test.mjs
npm run verify
git diff --check
```

## 当前验证记录

### 工作树验证（历史）

- `node --test tests/harness-check.test.mjs`：PASS（含 Gardener 权限 allowlist 反例）。
- `node --test tests/docs-site.test.mjs`：PASS。
- `node scripts/check-project.mjs`：PASS。
- `node scripts/check-harness.mjs`：PASS。
- `npm run docs:check`：PASS。
- `npm run verify`：历史记录 150+/tests、Harness GC 98/A、4 个 scenario、semi-real Host trial 和 docs check 全部 PASS。
- `actionlint`：本机不可用；workflow 已通过 YAML 解析和 Harness 静态权限契约检查。

### Wave 0 fresh clone 验证（2026-07-27）

在干净临时目录从当前 Git 仓库 `git clone --local`（HEAD `ee85ed4` 起，本完成提交之前基线），确认：

- 无 `node_modules`、无 `.workflow`、无聊天/memory 依赖；
- `npm ci` 后执行 `npm run verify`：**PASS**；
- 单元测试 `# tests 172` / `# pass 172` / `# fail 0`；
- `harness:check`、`harness:gc`（无阻断 finding）、4 个 scenario、`host:trial`（`mode=semi-real`，`codex_app_threads=false`）、`docs:check` 均 PASS。

复现：

```bash
git clone <jj-flow-remote-or-local> /tmp/jj-flow-fresh
cd /tmp/jj-flow-fresh
npm ci
npm run verify
```

## 完成条件对照

1. [x] fresh clone 不依赖聊天、memory 或 `.workflow` 即可通过 `npm run verify`。
2. [x] 未索引 exec plan、非法成熟度分数和文档/manifest 分数漂移都会触发结构化 finding。
3. [x] 定时 Gardener 上传 JSON 报告，P0/P1 时创建或更新去重 issue，且没有自动修复权限。
4. [x] 真实 Codex App Host 缺口以 `PENDING` 保留（`docs/milestones/real-host-acceptance.md`），不能被半真实报告替代；`max_unattended_level` 仍为 `A1`。

## 残留风险与后续

| 风险 | 处置 |
| --- | --- |
| 真实 App thread / sandbox 未证明 | 跟踪 [真实 Host 验收](../../milestones/real-host-acceptance.md)；仅宿主证据可关闭 |
| 自主等级过早抬升 | 门禁与文档双重约束；升级前必须更新 manifest 与里程碑状态 |
| GC P2/P3 局部 helper 重复 | 接受为低优先级维护候选，不阻断收口 |

后续宿主联调 **新开** 执行记录或直接在 real-host 里程碑推进，不再把本计划改回 active。
