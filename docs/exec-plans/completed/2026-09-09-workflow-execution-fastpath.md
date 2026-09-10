# 工作流执行优化

> 状态：completed

开始：2026-09-09。用户已批准实施 Cursor / Grok 对比报告中的三项优化。

## 目标与边界

减少 Ralph 定位和文档加载、review 交接与结果写回、Git end 固定步骤之间的模型往返。复用现有五门禁和 finalize，保留身份、范围、真实验证与只读审查约束。主进程开发，最多一个只读子代理提供检查。

依据：`docs/evaluations/EP-20260908-grok-latency-report.md` 与 `EP-20260908-cursor-flow-comparison-report.md`。这些是诊断样本，不是受控性能基准。

## 任务

- [x] 核实当前实现、已有聚合入口及样本中的失败路径。
- [x] Ralph：按指定 run 直接定位，默认输出简明候选，保留显式详细输出。
- [x] Ralph：提供当前阶段摘要与范围预检，优先复用当前合同及 deliver/finalize 聚合操作。
- [x] Review：提供任务范围、计划和验证记录的一次性交接材料，保留并发改动可见性。
- [x] Review：增加 host JSON 文件输入；对任务 diff 快照做真实性和失效检查后落盘，避免 PowerShell 内联转义。
- [x] End：实现 preview / execute 机械 runner，校验分支、范围、工作区快照与远程，逐步检查退出码并遇错停止。
- [x] End：覆盖提交 hooks、冲突、远程失败和返回工作分支；不使用 force push，不自动删除分支或清理用户文件。
- [x] 同步 canonical skills、CLI 帮助、安装所需脚本与用户文档。
- [x] 完成针对性行为/合约测试、`npm run verify`（含现有 Loop / Family 实验场）和 `git diff --check`。
- [x] 执行 `node src/cli.mjs install-skill --platform all --force`，记录使用方式、验证结果及速度证据的边界。

## 实施决策

- 工作分支：`codex/workflow-execution-fastpath`。保留已有 CHANGELOG 改动和诊断产物。
- 机械 runner 的 preview 本身不进行提交/推送；execute 仅在调用者已有 Git 收尾授权并提供核对后的计划时执行。开发期只在临时 Git 仓库与本地 bare remote 验证副作用。
- 指定任务 diff 不能通过任意文件列表绕过范围检查；快照需与当前 Git 状态匹配，未纳入的并发文件必须单独呈现并保留。
- 新执行方式与宿主模型配置分开验证；不宣称由机械测试证明真实 Agent 提速百分比。

## 验证记录

2026-09-09 完成验证：

- `npm run verify`：退出码 0，453 项测试全部通过；包含 Ralph/review/end 合约、项目检查、Harness/GC、scenario、host trial、文档构建、离线评测和既有 Loop / Family 实验场，两套实验场均 PASS。
- 临时 Git/bare remote 行为测试：中文 rename、同文件 staged + unstaged、只读预览、陈旧内容/index/HEAD/分支/远程、精确范围、集成目标、提交 hooks、远程领先/分叉、fetch 失败、冲突回退及主进程解决后继续、work/integration 推送分别失败并恢复。未在本项目执行 push/merge。
- 兼容检查：简明 locate 保留 next/warning/closeout 空值，`--details` 保留详细输出，旧机械 API 仍可用。独立安装的 Ralph/end 脚本不依赖业务仓安装 jj-flow。
- `node src/cli.mjs` 原来仅导出函数、直接调用无输出；已补直接执行入口，并用源码入口与 bin 入口行为测试确认，避免安装命令空执行。
- `ralph:check`、`end:check`、`git diff --check` 通过。更新 Claude/Grok 薄命令后，资产/review 合约另检 8/8。
- 全量验证在当前 shell 临时设置 `GIT_TRACE2_EVENT=0`，退出后恢复，防止外部 Trace2 消费者重新创建或锁住合成仓库目录。实际执行仍保留正常 hooks；该设置不写入产品 runner。
- 全局与当前项目分别执行 `install-skill --platform all --force`（当前项目加 `--project`）。核对 10 个宿主 skills 根及对应薄命令，共 502 个相关分发文件与 canonical 源逐字节相同。
- 首轮失败留下的两个临时目录 `jj-flow-git-DQnQfS`、`jj-port-evidence-JKdybn` 仍位于系统 Temp；自动审批以 `blocked by policy` 拒绝清理命令，未绕过该限制。最终验证已通过；这些残留不属于源码或安装资产。

## 使用与速度结论

用户继续使用 `$jj-ralph` / `$jj-review` / `$jj-end`（Claude/Grok 使用 `/`）；新会话加载更新后的技能。维护者使用方式见 [CLI 参考](../../commands/cli.md)。每次完整回归运行 `npm run verify`，其中已有 `lab:check`，无需另建测试项目。

已知 run 直接定位；Ralph 默认只给当前合同、阶段提示与验证尾部；review 一次交接并从文件写回；end 固定步骤收敛到 preview / execute 两个入口，异常才读详细规则。范围文件不能手改，代码/合同变化后需刷新并审查增量；已有快照审查也在后续门禁重新核对。

这些改动减少固定模型往返和上下文加载。453 项测试证明行为与边界，不能证明某个模型端到端提速百分比；前述 Grok/Cursor 样本不是同宿主同模型的受控对照。批量 end 会显式阻止未纳入的脏文件和脏子模块，处理后重新预览；可处理冲突由主进程继续解决，不把脚本回退当成任务完成。
