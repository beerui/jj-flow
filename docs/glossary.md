# 术语（通俗版）

先看左列日常说法，右列是文档里可能出现的词。

| 日常说法 | 简单意思 |
|----------|----------|
| 项目族 | 同一产品拆出来的多个仓库（如项目A / 项目B / 项目C） |
| ralph / 任务闭环 | **当前仓库**里的五步闭环：分析 → 计划 → 交付 → 验收 → 归档（旧称「单仓」） |
| same | 把能力 **迁到** 别的同源仓库 |
| dispatch | **多个仓库** 一起预览、批准、派发 |
| review | 把审查结论 **写进任务记录** |
| end | **提交并合分支** 的收工 |
| 交接 / handoff | 从任务带出、用于迁移的说明（不是聊天记忆） |
| 任务号 task_key | 调度里可接着做的稳定编号 |
| delivery | 一次「多项目交付」的编号（不是要你输入的命令） |
| 调度记录 / control-plane | 多项目派发的状态文件 |
| 验收通过 / VERIFIED | 记录和证据齐了；**不等于** 已推送远端 |
| 功能分支 / project-branch | 默认在命名好的 feature 分支上改 |
| Mode S | Grok 上：尽量 **一个会话** 串行完成多个任务 |
| PENDING | 证据不够，不能当「已通过」 |
| 证据 | 提交、审查文件、调度记录等 **可核对** 的东西 |
| intensity（tiny / standard / strict） | 分析、计划写多详细、验收多严；对话路径一律五步，tiny 只是写得更短 |
| `completed/` | 已归档或已放弃的任务目录（含 ABANDONED） |
| `events.jsonl` | 机器事件流水（门禁、尝试次数等）；人读进度见 `progress.md` |
| team-coordinate / `TC-*` | 会话内**动态多角色**执行；**不是**验收依据 |
| team-lifecycle / `TLV4-*` | 固定 **SDLC** 规格→实现流水线；**不是**验收依据 |
| team-swarm / `TAS-*` | 对抗蚁群**搜索**；**不是**验收依据 |
| 会话执行引擎 | team-*：只管「本轮如何执行」；验收仍认 ralph/dispatch |
| init | 把当前仓接入全局地图、梳理项目、补知识库（先提案，确认后写入） |
| 派单 / `ASSIGNMENT-*` | 写给执行人的独占输入文件（TASK / REVIEW / FIX / RESEARCH / HANDOFF）；执行人只读派单，不读聊天 |
| 派遣 / 执行人 | 「派遣…」是派单前的可见宣告；执行人是被指名的子代理（`jj-implementer` / `jj-reviewer` 等），指名规则见 `skills/jj/references/assignment-spawn.md` |
| `resume_from` | 同一人设、同一目录的后续派单用于续接已有子代理，不冷启动；规则见 `skills/jj/references/assignment-spawn.md` |
| 记忆热层 | `~/.jj-flow/memory/<project_key>.md`；归档晋升、你确认后置顶、注入有条数上限 |
| sandbox attestation（沙箱证明） | 运行时沙箱留下的执行证明；算数证据之一 |
| Mode W / Mode P | Mode W：隔离工作区 + 命名分支；Mode P：一任务一真实子会话；都只是拓扑，不算无人值守升级依据 |
| evaluated | 离线评估 / 复盘：用真实对话导出评估 jj-same、jj-ralph、jj-dispatch |

更深入的架构词见 [架构](architecture.md)。
