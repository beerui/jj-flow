# jj-flow

`jj-flow` 是 Maestro 上层的交付编排协议。`jj` 只是一个简单标识，不代表组织或业务品牌。它不改 Maestro 核心，而是在 Maestro 前面加一层很薄的 `/jj`：识别意图、收集证据、固化关键决策、选择 Maestro 链路，并生成可交给 Maestro 的 prompt。

## 为什么要单独成项目

文档站负责展示内容，`jj-flow` 负责沉淀可执行的交付方法。两者分开之后，Maestro 更新时只需要维护 `/jj` 适配层，真实项目经验也可以持续版本化、测试和发布。

## 当前边界

v0.1 只做 3 件事：

1. 把自然语言需求路由到 `delivery`、`feat`、`fix`、`knowhow`、`review`。
2. 生成 Maestro 调用建议、证据清单、风险 guard。
3. 提供 `$jj validate` 检查项目状态、文档/代码漂移和下一步升级建议。
4. 提供 `$jj evolve` 把自检结果转换成项目自身的修正 backlog 和升级计划。
5. 保留 ARMS、YApi、禅道等真实工具的接入位置，但不在第一版里重写这些工具。

## 快速使用

先按 [安装文档](docs/installation.md) 把 `$jj` skill 放到 Codex 可读取的位置。之后在 Codex 里直接使用：

```bash
npx @shendu-sdt/jj-flow@beta install-skill
```

默认安装到用户级 `~/.codex/skills/jj`。如果只想让当前项目使用：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --project
```

然后在 Codex 里输入：

```text
$jj delivery 按 PRD、接口文档和设计图完成这个需求
$jj validate 检查当前项目状态并给出下一步升级建议
$jj evolve 基于当前自检结果推进下一项项目管理能力
$jj fix 线上 ARMS 出现 goods-detail 500
$jj knowhow 把这次真实项目经验沉淀成规范
```

`delivery` 是推荐入口。用户只提供需求、关键资料位置和必须拍板的决策；资料收集、Maestro 调用链、guard 状态和后续执行由 Codex 内的 `$jj` 协议推进。

完整命令参数和使用方案见 [命令参考](docs/commands.md)。

## 模式

| 命令 | 用途 | 主要证据 |
| --- | --- | --- |
| `$jj delivery` | 少参数端到端交付 | 项目上下文、PRD/接口/设计、关键决策、测试结果 |
| `$jj validate` | 项目管理者自检 | workflow 状态、命令文档、recipe/guard、测试、路线图 |
| `$jj evolve` | 项目自身迭代 | validate evidence、correction backlog、路线图、升级计划 |
| `$jj feat` | 真实项目功能交付 | YApi、设计/需求、验收条件 |
| `$jj fix` | 线上问题定位与修复 | ARMS/SLS、复现路径、代码证据 |
| `$jj knowhow` | 把项目经验沉淀为可复用知识 | 对话记录、提交、复盘 |
| `$jj review` | 交付前质量审查 | diff、测试、风险清单 |

## 项目结构

```text
bin/                 CLI 入口
src/                 调度、证据、guard、recipe
tests/               Node 内置测试
skills/jj/           Codex skill 草案
workflows/           jj-flow 交付流程定义
examples/            真实工具接入的 evidence 示例
docs/                安装、命令、架构、规划、维护说明
.github/             CI、Release Please、Dependabot
```

## 发布

项目使用 Conventional Commits、Release Please 和 GitHub Actions。合并到主分支后，Release Please 会生成 release PR，并维护 `CHANGELOG.md`。

## 文档站

文档源在 `docs/`，可以构建成 GitHub Pages 静态站点：

```bash
npm run docs:build
```

构建产物在 `site/`，由 `.github/workflows/pages.yml` 部署。长期说明以文档站为准，README 只保留快速入口。

## 维护者调试

CLI 和 Node 命令只用于本仓库开发、测试和文档站构建，不作为普通用户的主要用法。日常交付入口以 Codex 内的 `$jj` 为准。
