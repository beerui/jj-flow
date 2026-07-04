# 使用说明

这页讲日常交付流程。安装看 [安装](installation.html)，完整参数看 [命令参考](commands.html)。

## 推荐入口：Codex 内交付

```text
$jj delivery 实现 AI 获客列表、详情和精修验收
```

`$jj delivery` 是端到端交付入口。用户只需要给一句需求、关键业务数据或必须由人拍板的决策；不要为了启动流程强制传 `--prd`、`--api`、`--design` 这类参数。

模型默认先自动发现上下文：

- 当前项目目录、`.workflow`、README、已有规格和路线图。
- 用户消息中给出的 PRD、接口文档、设计图、Codex 线程链接或其它资料位置。
- 真实工具产出的 evidence，例如 YApi、ARMS/SLS、测试结果、diff 和交付记录。

只有遇到会改变交付边界、方案取舍或上线风险的阻塞决策，才回到用户确认。资料路径可以自然写在需求里作为加速信息，但不是必填参数。

## 常用写法

```text
$jj delivery 按 PRD、接口文档和设计图完成页面交付
$jj delivery 参考 codex://threads/019f2ba4-2c09-7750-8a77-a2e9b3b9093b 总结流程并完成后续交付
$jj validate 检查当前项目状态，给出下一步升级建议
$jj evolve 基于当前自检结果推进下一项项目管理能力
$jj fix 线上 ARMS 出现 TypeError，需要定位根因并修复
$jj knowhow 把这次真实工作对话沉淀成可复用流程
```

如果任务跨分析、开发、精修和验收多轮对话，仍优先用 `$jj delivery`。它会把多个资料源整理成一个交付上下文，而不是让用户手动拆成多个命令。

## 提供资料的方式

直接把资料写进 Codex 对话即可，不需要整理成固定参数：

- PRD 或需求文档路径。
- YApi、接口文档或真实请求记录。
- MasterGo、截图或设计图链接。
- Codex 历史线程，例如 `codex://threads/...`。
- 必须由用户拍板的业务决策。

`$jj` 会把这些资料整理成 context package、guard 状态和 Maestro 调用链。缺少证据时保持 `PENDING`，不会把猜测写成通过。

## Codex 内部会做什么

1. 读取用户原始需求和当前项目上下文。
2. 自动发现 `.workflow`、README、已有规格、路线图、PRD、接口文档、设计图和 Codex 线程。
3. 生成 `maestro_calls`、`guard_report` 和 `maestro_prompt`。
4. 按 Maestro 链路推进分析、计划、实现、审查、测试和精修。
5. 只有阻塞交付边界、方案取舍、上线风险或外部权限时，才向用户提问。

## 项目管理者自检

当你要维护 `jj-flow` 本身，而不是交付某个业务需求时，用 `$jj validate`：

```text
$jj validate 检查文档、recipe、guard、测试和路线图是否一致
```

它会优先读取当前项目文件、`.workflow/state.json`、路线图、命令文档和测试状态，输出 `PASS`、`PENDING`、`FAIL` 与下一步建议。它的重点不是替代 `npm run verify`，而是判断项目能力是否还和文档、路线图、用户反馈保持一致。

## 项目自身迭代

当自检已经能说明当前状态，而你希望 `$jj` 继续推动这个项目升级时，用 `$jj evolve`：

```text
$jj evolve 基于当前自检结果推进下一项项目管理能力
```

它会把 validate evidence、路线图和用户反馈整理成 correction backlog 与下一轮升级计划。默认优先修正自检失败或文档/代码漂移；如果没有失败项，则推进 `.workflow` 中下一项 phase。`$jj evolve` 仍然只生成上下文、guard 和 Maestro 调用链，实际分析、实现、审查和测试继续交给 Maestro 与 Codex thread。

## 维护者调试入口

下面命令只用于维护本仓库或调试 `$jj` skill，不是普通交付的主入口：

```bash
npm run verify
npm run docs:build
```

如果需要检查 `$jj` 生成的结构化调度结果，维护者可以在仓库内调用 CLI；这属于内部实现细节，文档和用户流程仍以 Codex 内 `$jj` 用法为准。
