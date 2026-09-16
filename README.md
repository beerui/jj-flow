# jj-flow

用**对话**在多个相关项目里把「改功能、迁功能、一起派任务」做完，并且**能核对、能接着做**。

支持：Codex、Claude、Grok、Qoder，另提供 AGENTS 兼容入口（`~/.agents`）。

> 聊天里说"做完了"不算数。算数的是仓库里的记录、Git 提交和审查结果。

## 这是什么

`jj-flow` 是面向 **项目族** 的 AI **编排工作流**：

- **init** 接入全局地图、梳理项目、补知识库
- **ralph** 在当前仓库走完 分析 → 计划 → 交付 → 验收 → 归档 的任务闭环
- **same** 把能力按目标仓自己的写法迁到同源仓库
- **dispatch** 多个项目预览、批准、一起派发
- **review** 只读审查、结论落盘；**end** 只动 Git 的收工

事实来源是控制面 manifest、Git 提交、验证 / 审查产物与沙箱证明，不是聊天状态。它不是新的应用框架：`npx` 管理 skills / agents / 命令入口，真实分析与编码在宿主对话里完成。

## 三步开始

1. 安装（约一分钟）
2. 看[第一次使用](https://beerui.github.io/jj-flow/usage.html)，在业务仓库走完一个小需求
3. 以后按下表选择入口，用日常中文说要做什么

```bash
npx @brewer/jj-flow@latest install-skill --platform all --project
```

装进本项目的 Codex / Claude / Grok / Qoder / AGENTS 配置目录（Claude 另含 `.claude/agents` 命名子代理）。覆盖已有安装请加 `--force`；卸载先预览：`uninstall-skill --platform all --dry-run --json`。协调状态、项目地图和知识库默认写 `~/.jj-flow`；写入须经你确认。

## 我该用哪个？

| 你想… | 用这个 | 一句话说明 |
|--------|--------|------------|
| 把当前仓接入全局地图、梳理项目、补知识库 | init | 先提案，确认后写入 |
| 只改当前这一个仓，从做到验收 | ralph | 五步闭环，完成后可继续改 |
| 把项目A 做好的能力搬到项目B / 项目C | same | 按目标仓自己的写法适配 |
| 多个项目一起派、一起盯 | dispatch | 预览 → 你批准 → 派发（无 Claude 入口） |
| 把审查结论写进任务 | review | 只读，不改业务代码 |
| 提交、推送、合进集成分支 | end | 只动 Git |

**快速判断：** 一个仓用 **ralph**；要搬家用 **same**；多个仓统一批准用 **dispatch**；只收工用 **end**。不想记入口时，直接说 `$jj` / `/jj`，由它帮你选择入口。

可选（**不算**验收通过）：team-coordinate 多角色、team-lifecycle 固定 SDLC、team-swarm 多方案搜索、evaluated 离线复盘（无 Claude 入口）。

## 对话怎么说

在**业务项目**的对话里使用前缀：Codex 用 `$jj-…`，其他工具通常用 `/jj-…`。

```text
$jj-ralph 登录成功后密码过期要弹提示，只做登录成功那条路
$jj-same 交接到 项目B 项目C
$jj-dispatch 先预览，再把这个改动派到项目A和项目C
$jj-review 审一下刚才的改动
$jj-end 收工，合到 dev
```

需要更清楚时，再补四件事：**目标、资料、范围、验收标准**。不需要记任务编号；Agent 会自己找到要接着做的任务。

## 它们怎么配合

```text
一个仓库做完 ──ralph──► 可以说“交接到…”
                              │
                              ▼
                          same 迁到别的仓库
                              │
        多个仓库一起派 ──dispatch──► 批准后分别做
                              │
                          end 提交 / 合分支
```

## 文档导航

| 章节 | 适合谁 | 内容 |
|------|--------|------|
| [开始](https://beerui.github.io/jj-flow/) | 新用户 | 安装、第一次使用、常见踩坑 |
| [工作流](https://beerui.github.io/jj-flow/commands.html) | 日常使用 | 六大入口 + 可选引擎，每个入口一页 |
| [概念](https://beerui.github.io/jj-flow/glossary.html) | 想懂「为什么」 | 术语、证据、目录、宿主、知识与记忆 |
| [维护者](https://beerui.github.io/jj-flow/maintenance.html) | 改本仓库的人 | 架构、CLI 参考、写作规范、发布 |
| [参考](https://beerui.github.io/jj-flow/design-docs/) | 深究者 | 设计文档、执行计划、ADR、历史验收 |

## 维护与发布

- 本地校验：`npm run verify`（含全量测试、docs:check、lab:check 等）
- npm 发布只走 GitHub Actions `NPM Publish` 工作流
- `CHANGELOG.md` 由 release-please 维护，只编辑 `Unreleased` 段

协议细节见 [AGENTS.md](AGENTS.md) 与 [ARCHITECTURE.md](ARCHITECTURE.md)；许可证见 [LICENSE](LICENSE)。
