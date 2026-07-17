# `jj-validate` 项目自检

`jj-validate` 只用于维护 `jj-flow` 项目本身。它检查项目状态、路线图、命令资产、用户文档、npm 包内容和测试是否一致，并确认 `jj-flow` 仍然是 Maestro 上层的薄交付协议，而不是另造一套执行引擎。

## 适用场景

- 修改了 `.codex/skills`、`.claude/commands`、安装逻辑、文档或测试，需要检查是否发生漂移。
- 准备发布前，需要确认 npm 包资产、命令说明和项目验证仍一致。
- 用户反馈某个命令行为或文档与实际不符，需要先确定漂移范围和证据。
- 路线图进入下一阶段前，需要判断哪些项目已经 `PASS`、哪些仍是 `PENDING` 或 `FAIL`。

## 何时不用

- 普通业务需求、页面功能或线上 bug 不使用它，选择 [`jj-delivery`](command-jj-delivery.html)。
- 已有明确自检结果并准备实际修改 `jj-flow` 时，进入 [`jj-evolve`](command-jj-evolve.html)。
- 只审查某个业务 diff 的质量风险时，使用 [`jj-delivery`](command-jj-delivery.html) 并限定为审查范围。
- 不要用 `jj-validate` 把缺失证据自动补成通过，也不要在自检过程中顺手实施路线图功能。

## 输入模板

```text
$jj-validate
自检目标：<要确认的项目状态或发布条件>
范围：<全量 / 文档 / Codex skills / Claude commands / npm 包 / 测试 / 路线图>
证据：<失败日志、用户反馈、commit、diff 或 artifact 路径>
关注点：<Maestro 边界、安装一致性、命令兼容、测试覆盖等>
输出要求：<只报告 / 给出下一步升级建议>
```

Claude Code 使用 `/jj-validate`。不提供范围时，默认检查当前 `jj-flow` 项目的整体状态。

## 完整示例

### 示例 1：发布前全量自检

```text
$jj-validate
自检目标：确认当前 jj-flow 可以进入 beta 发布准备。
范围：.workflow 项目状态、路线图、Codex skills、Claude commands、npm 打包文件、安装文档和测试。
证据：审查当前分支相对 master 的全部 diff，并核对 package.json scripts。
关注点：命令资产是否成对更新；jj-dispatch 是否仍为 Codex-only；文档站是否能从 docs 源生成；是否仍保持 Maestro 上层协议定位。
输出要求：按 PASS / PENDING / FAIL 列出检查项、证据路径、影响和下一步建议，不修改文件。
```

### 示例 2：定向检查命令文档漂移

```text
/jj-validate
自检目标：检查 jj-same 的 handoff 与持续同步说明是否在各入口一致。
范围：.codex/skills/jj-same、.claude/commands/jj-same.md、docs/commands.md、docs/usage.md、相关测试。
证据：用户反馈“PARTIAL_HANDOFF 不应一律阻塞编码”。
关注点：EXECUTION_READY 与 HANDOFF_READY 是否分开；FRESH / PARTIAL / STALE / BROKEN 是否对应正确启动动作；失败同步是否会错误推进基线。
输出要求：列出事实冲突和缺失测试；没有证据的项目保持 PENDING。
```

### 示例 3：只检查调度协议回归

```text
$jj-validate
自检目标：确认 jj-dispatch 的控制协议修改没有破坏恢复和 Review 门禁。
范围：jj-dispatch skill、control-plane schema、dispatch contract tests 和用户文档。
证据：当前 feature 分支的 diff。
关注点：PREVIEW/DISPATCH 批准、UNKNOWN/RECONCILE、单项目单 writer、terminal commit Review PASS。
输出要求：给出必须运行的聚焦测试及当前结果，并指出是否需要进入 jj-evolve。
```

## 执行过程

1. 读取 `.workflow/project.md`、`.workflow/roadmap.md` 和 `.workflow/state.json`，确认项目定位、当前阶段和已登记证据。
2. 检查 `.codex/skills`、`.claude/commands`、`docs/`、npm `files`、安装说明和测试覆盖是否一致。
3. 对比命令名称、平台边界、输入、状态、完成标准和用户可见示例，找出事实冲突或遗漏。
4. 验证 `jj-flow` 只负责收集上下文、形成控制面和编排 Maestro/Codex，不复制或重写 Maestro core。
5. 根据范围运行聚焦检查；全量项目自检通常以 `npm test`、`npm run check`、`npm run docs:check` 或聚合的 `npm run verify` 为证据。
6. 按 `PASS / PENDING / FAIL` 输出结果、证据路径、影响和最短修正建议，供 `jj-evolve` 消费。

## 输出/完成标准

- 每个检查项都有明确状态，不使用“基本没问题”代替结论。
- `PASS` 必须有当前文件、命令或测试证据；未读取、未运行或无法验证的项目保持 `PENDING`。
- `FAIL` 说明事实冲突、影响范围和最短解除条件，而不是只粘贴错误日志。
- 明确当前项目定位是否仍为 Maestro 上层协议，是否出现复制 core 或重型执行引擎倾向。
- 给出下一步建议的优先级：先修自检失败和方向错误，再处理路线图能力。
- 自检本身不擅自修改代码、文档、路线图或发布状态。

## 关键门禁与状态

| 状态 | 含义 | 后续动作 |
| --- | --- | --- |
| `PASS` | 当前证据足以证明检查项成立 | 可作为发布或演进输入 |
| `PENDING` | 缺少文件、命令结果、人工判断或外部证据 | 补证据后重新验证 |
| `FAIL` | 已发现明确漂移、回归或定位越界 | 优先交给 `jj-evolve` 修正 |

以下情况不能标记 `PASS`：

- Codex skill、Claude command 与用户文档描述不同步。
- npm 包没有包含文档声称会安装的资产。
- 测试或文档检查未运行，却将其写成已通过。
- 新增逻辑开始替代 Maestro 的 plan、execute、review 或 test 能力。
- 路线图或 `.workflow/state.json` 与当前代码事实明显不一致。

## 常见误区

- 把 `jj-validate` 用作普通业务项目的质量审查。
- 一边自检一边直接改文件，导致原始失败证据消失。应先形成清晰结果，再由 `jj-evolve` 实施。
- 只运行测试，不检查命令资产、文档和 npm 打包边界。
- 只读路线图，不核对当前代码与 Git diff。
- 因为命令退出码为 `0` 就把所有人工或外部检查写成 `PASS`。
- 自检已经显示路线图完成后仍凭空制造新功能；应转向维护、真实项目试用或等待明确反馈。

## 相关命令

- [`jj-evolve`](command-jj-evolve.html)：消费自检结果并实施下一轮修正或演进。
- [`jj` CLI](command-cli.html)：运行本地项目检查或查看调度输出，不替代本命令的证据判断。
