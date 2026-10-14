# 目录结构与文件布局：文件都放在哪？

`jj-flow` 产生的文件严格分为两处：**本机用户主目录（`~/.jj-flow`）**存放跨项目共享的地图与调度状态；**各个业务仓库内部（`.workflow/`）**存放该仓库自己的任务计划、进度与审查记录。

## 一、本机全局目录（`~/.jj-flow/`）

当你执行 `npx @brewer/jj-flow@latest install-skill` 时，系统会在你的用户主目录下自动初始化 `~/.jj-flow`（已有文件绝不覆盖）：

| 文件或子目录 | 默认路径 | 用途说明 | 写入规则 |
| :--- | :--- | :--- | :--- |
| **全局命名与路径配置** | `~/.jj-flow/naming.json` | 配置默认集成分支名、项目族根目录等全局约定 | 安装时生成默认配置，一般无需手改 |
| **全局项目地图** | `~/.jj-flow/map.md` | 登记本机各业务仓库的中文名、别名、本地路径与所属项目族 | 通过 [`$jj-init`](commands/jj-init.md) 预览，**经你确认后写入** |
| **跨项目知识库** | `~/.jj-flow/knowledge/` | 存放跨仓库可复用的开发规范、架构约定与踩坑经验 | 通过 `$jj-init` 或在 `ralph` 中说“写入知识库”，**经你确认后写入** |
| **项目记忆热层** | `~/.jj-flow/memory/<project_key>.md` | 每个业务仓库独立一份的高频经验摘要，开新任务时自动按需注入 | `ralph` 任务归档时自动从 `findings.md` 提炼写入（详见 [知识库与记忆热层](concepts-knowledge.md)） |
| **多仓调度控制面** | `~/.jj-flow/`（调度记录） | 保存 [`$jj-dispatch`](commands/jj-dispatch.md) 的 `DEL-*` 交付状态、回执与沙箱证明 | 调用 `$jj-dispatch` 经你批准派发后由系统维护 |

## 二、业务仓库内部目录（`<项目根>/.workflow/`）

当你在某个业务仓库里使用 `$jj-ralph`、`$jj-review`、`$jj-same` 或可选的 `team-*` 引擎时，仓库根目录下会生成 `.workflow/` 目录：

```text
<业务仓库根目录>/
└── .workflow/
    ├── ralph/                                # 【核心】单仓任务闭环与跨仓落地的记录根目录
    │   ├── index.md                          # 活跃任务（进行中）与已完成任务（最近归档）总索引
    │   ├── business-map.json                 # 当前仓库的业务模块与能力地图（归档时自动更新）
    │   │
    │   ├── task-<任务简述>/                  # 正在进行中的活跃任务（直接扁平放在 ralph/ 根下）
    │   │   ├── task_plan.md                  # 【人读核心】需求目标（Goal）、验收标准、分步计划（Steps）
    │   │   ├── progress.md                   # 【人读核心】按日期追加的执行进度、测试输出与验证记录
    │   │   ├── findings.md                   # 【人读核心】本轮改动摘要、排查踩坑与可复用结论
    │   │   ├── assignments/                  # 派发给子代理的精确指令单（ASSIGNMENT-TASK / REVIEW / FIX 等）
    │   │   └── .state/                       # 【机器状态】一般无需手动打开
    │   │       ├── run.json                  # 任务门禁状态、范围（scope）、交接包（handoff）单一真源
    │   │       ├── events.jsonl              # 状态机事件流水
    │   │       ├── handoff.json              # 供跨仓迁移读取的交接快照导出文件
    │   │       └── reviews/REV-*.json        # 只读代码审查的结构化报告
    │   │
    │   ├── completed/                        # 已验收归档或已主动废弃（ABANDONED）的任务目录
    │   │   └── task-<任务简述>/              # 归档后原样移入此处；后续若要微调仍可自动找回续做
    │   │
    │   ├── migrated/                         # 旧版 1.0 (RALPH-*) 升级迁移后的备份目录（只读）
    │   └── archive/                          # 旧版 1.0 历史快照（只读，可用 jj ralph migrate --prune-archive 清理）
    │
    ├── review-assignment.md                  # 无活跃 ralph 任务时，单独运行 $jj-review 的临时派单
    ├── .team/                                # 可选协作引擎（TC-* / TLV4-* / TAS-*）的会话产物目录
    └── evaluated/                            # 可选离线复盘工具（$jj-evaluated）生成的 EP-* 评估报告
```

## 三、日常使用时的查看建议

1. **平时看进度只看 3 个文件**：打开当前任务目录下的 **`task_plan.md`**（看目标和步骤勾没勾）、**`progress.md`**（看每一步做了什么、测试过没过）、**`findings.md`**（看审查意见和总结）。
2. **找当前有哪些任务看 `index.md`**：`.workflow/ralph/index.md` 清清楚楚列出了当前仓库有哪些“活跃”任务和“已完成”任务。
3. **跨仓交接说明在哪里？**：交接信息直接保存在源任务的 `.state/run.json`（`handoff` 字段）及 `.state/handoff.json` 中；早期旧版的 `.workflow/handoffs/` 独立目录已废弃。

## 相关阅读

* [1 分钟安装与配置](installation.md)
* [知识库与记忆热层](concepts-knowledge.md)
* [ralph · 单仓任务闭环](commands/jj-ralph.md)
