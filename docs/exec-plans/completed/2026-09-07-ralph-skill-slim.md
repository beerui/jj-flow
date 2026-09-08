# Ralph 对话协议瘦身实施计划

> 状态：completed
>
> 设计：[Ralph 对话协议瘦身](../../design-docs/ralph-skill-slim.md)
>
> 开始：2026-09-07
>
> 完成：2026-09-08

## 目标与边界

把 `$jj-ralph` 收成一条可执行主链：短计划 → 开发验证 → 交付 → 验收 → 归档。入口目标不超过 100 行，机械细节按需读取。保留五个 ledger gate、存量 run、机械 CLI、审查证据与同需求 resume 语义。

本次用户已要求审查、制定任务清单并完成开发，因此从原设计的 PR0 文档范围进入 PR1 → PR2 → PR-flow → PR3。按依赖顺序逐段修改和验证，不把中间态分发为最终行为；不额外创建控制任务。仅交付当前工作区改动，不包含 Git 提交、推送、合并或发布。workspace-layout overlay 与知识投喂对话化继续冻结。

## 审查结论与设计修正

1. **保存边界必须过滤临时字段。** `dispatchRalph.mjs` 会在 `initRun` 后绑定 family 并再次 `saveRun`，仅在 init 内延后挂载不能防止 `intensity_inference`、`map_find`、`gate_set_suggestion` 落盘。保存层剥除返回值专用字段，保持 schema 1.2，不扩大未知字段许可；用 dispatch 集成用例核对磁盘。
2. **空骨架不能作为产物。** init 的 `1. [ ]` 不算有效验收或 Steps。检查真实 Goal、非空验收内容与每个 Step 的文件路径；未回答存疑阻挡，空存疑不阻挡。
3. **折叠采用一次 ledger 保存。** 保留 `setGate` 对外原子语义；包装层使用独立交付 helper，先检查产物，在内存依序应用 analyze/plan/deliver，最后一次保存。检查失败不写 gate；持久化中断按当前 ledger 可恢复重试，不宣称跨 run/index/events 文件事务。
4. **next 不是 Git 授权。** `commit-scoped-review` 说明需要的证据。提交沿用会话已有授权；缺授权时提供 `commit-prep` 并明确归档尚缺 commit-scoped review，保留原归档门禁。
5. **补全资产测试约束。** façade 的完整导出名单须同步；Claude wrapper 不超过 40 行；portable lib 必须字节同步。测试拆分保留原 `test()` 的完整断言，并提供入口聚合，保证单独运行 `tests/jj-ralph-contract.test.mjs` 仍覆盖全部 Ralph 合约。

## 任务清单

### PR1：入口与手册

- [x] T01 定位方案、核对架构、完成两项并行只读审查。
- [x] T02 记录审查修正、实施依赖与验收清单。
- [x] T03 将 SKILL 压到 ≤100 行，保留路由、检查点、五阶段、十项命令白名单和必要指针。
- [x] T04 新增 `references/ops.md`；把失败恢复、集成、热层与机械操作迁到唯一维护位置。
- [x] T05 同步 phases、artifact-layout、single-point 示例、Claude wrapper 和用户文档；删除强度菜单及默认 review/commit/end 链。
- [x] T06 迁移资产合约的断言归属；验证 PR1 原子 gate 窗口与 portable lib 不变。

### PR2：推断与包装边界

- [x] T07 实现 `INTENSITY_HEURISTIC` / `suggestIntensity`，复用既有 scope/验收/架构词规则；strict 优先，歧义 standard。
- [x] T08 init 在骨架前应用推断、输出解释、记录事件；显式机械覆写保留，resume 不重新推断。
- [x] T09 保存层过滤临时结果字段，补 dispatch 再保存的 schema/磁盘回归。
- [x] T10 包装层拒绝 `--lite` / `--full` / `--intensity` 及 `brief` / `close`，同步帮助；机械 CLI 保留兼容并移除 `gate_set?` 文本提示。
- [x] T11 空 finding 对策/适用范围在 helper 层拒绝；judgment 错误指向 `review-record`；`computeRalphNext` 行为保持。
- [x] T12 更新原有默认档/lite 用例与 façade 导出名单，增加推断、覆盖、拒绝、持久化用例；运行相关合约并同步 portable lib。

### PR-flow：能力检索与交付折叠

- [x] T13 init/resume 内置一次 CAP 检索（上限 5），保留 reuse suggestions、查询优先级、空命中事件与返回对象；不写临时结果到 ledger。
- [x] T14 新增产物检查器，覆盖真实 Goal/验收/Step 文件、空骨架、未回答存疑与空节。
- [x] T15 包装层 deliver PASS 在检查后一次保存 analyze/plan/deliver；重复调用与部分状态恢复安全，机械 `setGate` / CLI 仍只改所点 gate。
- [x] T16 将 SKILL / phases / ops 切到最终折叠主链，说明脚本缺失的 degraded unfold 不可直接 finalize。
- [x] T17 覆盖成功、零写入拒绝、已勾/空存疑、返回 CAP、机械原子性和恢复；同步 portable lib。

### PR3 与交付

- [x] T18 按现有 `test()` 边界拆分 Ralph 合约，保持聚合入口和断言语义；对比拆前/拆后测试数量及结果。
- [x] T19 运行 Ralph、dispatch、task-artifacts、hot-memory 相关合约与 `npm run verify`，修复此次变更引入的问题。
- [x] T20 运行 skill 校验、主进程只读行为复核、`git diff --check`；核对全部任务验收证据。
- [x] T21 执行 `node src/cli.mjs install-skill --platform all --force`，核对宿主分发结果（实际执行入口修正见记录）。
- [x] T22 更新设计状态、CHANGELOG、索引与本计划完成记录，交付可审查工作区。

## 验收矩阵

| 要求 | 证据 |
| --- | --- |
| 入口 ≤100 行、白名单 10、无强度菜单、保留检查点与引用 | 资产合约 + skill 校验 |
| 文案/单像素 tiny、鉴权/协议 strict、冲突 strict、歧义 standard | 推断表驱动测试；CLI 与包装层真实 init |
| 显式机械覆写有效、resume 保留原值 | lifecycle/推断测试 |
| 临时字段不进 schema，dispatch 再保存也安全 | run.json 磁盘字段断言 + schema 校验 |
| 包装层拒非法旗标，机械 CLI/lite 兼容 | spawn/CLI 合约 |
| finding 空值拒绝、judgment 恢复指令正确、next 不按档分支 | hot-memory/gates 合约 |
| CAP 自动检索上限/查询优先级/空命中/无持久化 | init/resume 集成测试 + events |
| 折叠写三键、缺产物/存疑拒绝零键、机械 CLI 原子、恢复幂等 | wrapper/gates 合约 |
| 主链按证据验收归档，next 不扩大 Git 授权 | SKILL/references 与独立只读行为复核 |
| 测试拆分不减少覆盖，便携副本及多端安装同步 | 测试数量对照 + ralph:check + install-skill |
| 仓库管线完整通过 | npm run verify + git diff --check |

## 执行与验证记录

- 2026-09-07：初始 HEAD `07d8392`。已有工作区改动为设计文档新增，以及设计索引、CHANGELOG 各一行；保留这些内容并在其上实施。
- 2026-09-07：完成方案语义与测试/分发边界审查，修正项见上；开始 PR1。
- 2026-09-08：PR1 SKILL 260 → 76 行；Ralph 合约 62/62、`ralph:check`（15 文件）、`check`、`harness:check`、`docs:check` 通过。修复设计草案里的相对死链和代码围栏语言标记。验证日志：`.tmp/ralph-slim-pr1.log`、`.tmp/ralph-slim-pr1-docs.log`。
- 2026-09-08：按用户要求，后续由主进程完成，不再并行派多个子代理；轻量任务允许 Grok Build，当前无需额外执行任务。
- 2026-09-08：PR2 完整 `npm run verify` 通过（412/412 tests，含 docs/evaluated/lab）。日志：`.tmp/ralph-slim-pr2-verify-retry.log`。首次仅 Windows host-trial 临时目录清理遇到 ENOTEMPTY；独立 host-trial 和原样重跑通过。自动审批拒绝清理该次残留目录，保留 `C:\Users\motou\AppData\Local\Temp\jj-flow-host-trial-rTy5la`，未绕过或改动 host-trial 代码。
- 2026-09-08：PR-flow Ralph 合约 76/76，dispatch/task-artifacts/hot-memory 78/78；便携副本独立完成 init → deliver-attempt → 折叠 deliver → accept → finalize → resume，恢复输出 CAP。完整 `npm run verify` 重跑通过 421/421（首次 host-trial CLI 用例非 0，其余通过；未改该用例断言）。日志：`.tmp/ralph-slim-flow.log`、`.tmp/ralph-slim-flow-related.log`、`.tmp/ralph-slim-flow-verify-retry.log`。保留同期已有的 resume progress 占位修复及其新增合约。
- 2026-09-08：PR3 使用 AST 的完整 `test()` 边界拆为 9 个 `tests/ralph/*.contract.mjs`；原入口只聚合，避免测试被重复发现。76 个名称及正文 SHA-256 全部一致（`.tmp/ralph-slim-split-equivalence.json`）；拆后原入口 76/76（`.tmp/ralph-slim-split.log`）。最大模块 746 行。
- 2026-09-08：技能校验发现原 description 的 `<task_key>` 不符合通用 frontmatter 规则，改为 `{task_key}`；入口仍为 77 行。主进程复核了同需求恢复、审查只读、存疑/缺产物拒绝、默认收尾与 Git 授权边界；运行时职责未移动，`ARCHITECTURE.md` 无需改动。
- 2026-09-08：`quick_validate.py` 通过。已执行仓库约定的 `node src/cli.mjs install-skill --platform all --force`；实测该文件只导出函数、不启动 CLI，因此随后用真实入口 `node bin/jj.mjs install-skill --platform all --force --json` 安装。当前仓宿主副本仍旧，另用相同安装器加 `--project` 刷新；两种作用域的 Codex/Claude/Qoder/Grok/Agents 共 10 份 Ralph skill（每份 34 个文件）均逐字节匹配 SSOT，Claude/Agents command 同步。日志：`.tmp/ralph-slim-install.json`、`.tmp/ralph-slim-install-project.json`、`.tmp/ralph-slim-install-parity.json`。宿主目录均被 Git 忽略。
- 2026-09-08：拆分后全量 tests 421/421，但随后必跑 host-trial 命中 `HST-CLEANUP-001` / `EBUSY`（`.tmp/ralph-slim-final-verify.log`）。短时清理重试仍复现；只读检查残留发现 `.git/ai/worktrees/` 在删除期间重新出现，且本机 `trace2.eventtarget` 指向 Git AI named pipe。T19 增补最小验证设施修复：只对 trial 的 Git 子进程设置 `GIT_TRACE2_EVENT=0`，避免外部后台写入临时仓；原清理门禁仍要求目录实际消失，否则 FAIL，CLI 失败会输出完整报告。既有残留目录不触碰；重跑真实 trial 后更新 runner 指纹证据。
- 2026-09-08：修复后 host-trial 4/4（含外部 Trace2 输出隔离回归）；独立 trial PASS 且临时根实际删除。新报告与 `docs/milestones/m7-host-trial.json` 除 runner 指纹外完全一致，仅据真实结果更新指纹。最终完整 `npm run verify` 通过 422/422；check、harness、gc、scenario、host-trial、docs、evaluated、lab 全部通过（`.tmp/ralph-slim-final-verify-fixed.log`）。最后再次核对 76 个 Ralph 测试正文哈希与拆分前相同，`git diff --check` 通过。

## 交付与边界复核

- 入口 77 行、Claude wrapper 34 行；路由、4 个红检查点、五阶段和 10 项命令白名单均由资产合约检查，通用 skill 校验通过。
- 推断、CAP 与折叠由 conversation/knowledge/cli 合约覆盖；持久化临时字段由 dispatch/task-artifacts 合约覆盖；验收、审查与旧 run/lite 兼容合约完整保留。
- `tests/jj-ralph-contract.test.mjs` 为稳定聚合入口，9 个分模块最大 746 行。全量测试未重复发现子模块，最终共 422 项。
- 用户级及项目级安装副本与 SSOT 完全同步；源码、schema 与 Git 权限边界保持，未启动冻结的 workspace-layout overlay 或知识投喂对话路径。
- 本次交付位于当前工作区。验证失败轮次产生的少量临时 fixture 目录保留，其中 PR2 的清理曾被自动审批拒绝；没有绕过该限制。修复后的 trial 均验证自身临时目录实际删除。
- 执行计划归档和索引更新后再次通过 `docs:check`（`.tmp/ralph-slim-final-docs.log`）；所有 T01–T22 已勾选，无遗留活跃计划链接。
