# Ralph 瘦身：现有实验场单次对比

记录时间：2026-09-08。运行现有 Loop gym、Family gym，旧版与新版各执行一次相同的 `npm run lab:check`，记录功能结果与机械套件耗时。

## 结果

| 产品版本 | Loop gym | Family gym | 命令退出码 | 总耗时 |
| --- | --- | --- | ---: | ---: |
| 修改前 `08d3a47a720ee4c5544bbbf06a33697431993714` | PASS | PASS | 0 | 5776.988 ms |
| 修改后 `d238e697323949c5362ef7497241f74b31536387` | PASS | PASS | 0 | 5623.369 ms |

两套实验场在两个产品版本上均返回 PASS，findings 均为空。本次新版少用 153.619 ms，约 2.66%。每个版本只有一个样本，不能将这次差值视为稳定提速比例。

这是机械套件的墙钟耗时，包含 npm 启动、夹具重建、Git 操作和检查脚本。未调用模型执行完整需求，未测量 Agent 对话耗时、工具调用数或 token。Loop manifest 声明 9 个机械场景、Family 声明 10 个；现有报告仅给出套件整体结果，不提供逐场景执行回执。

## 固定条件与来源

- Node.js：`v20.19.0`；平台：Windows。
- Loop gym：`75461e1b6b61d721d437e55fc9e67fbde4507acc`。
- Family gym：`652d1f5099814c070bdf48ba3d32be4d7d309916`。
- 根目录来自现有 `lab-roots.json`，两个版本使用相同的实验场脚本与种子。
- 顺序：旧版、新版。旧版源码通过 `git archive` 导出到临时目录，新版使用当前工作区；没有切换工作分支。
- `JJ_FLOW_ROOT` 由各版 `lab-check` 指向被测源码。lab manifest 的 `jj_flow_commit` 是兼容声明，未当作实际被测版本。
- 测试进程设置 `GIT_TRACE2_EVENT=0`，两个版本条件相同；未修改用户全局 Git 配置。
- 用 `Stopwatch` 记录命令总耗时；两个样本分别从北京时间 `19:52:46.918`、`19:52:52.774` 开始。
- 本地原始证据：`.tmp/lab-comparison-20260908-195145/comparison.json`、`before.json`、`after.json`、`before.log`、`after.log`。临时证据不随 Git 分发。

## 后续复验

在已配置实验场的 jj-flow 工作区运行：

```powershell
npm run lab:check
```

该命令已包含在 `npm run verify` 中。后续每次比较保留实际产品版本、实验场版本、结果和耗时；套件或种子变化时另记基线。若要比较 Agent 完成需求的速度，再记录实验场的实际 Agent 场景耗时，不能用机械套件的秒数替代。
