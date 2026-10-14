# 命令总览与选型指南

日常开发中，你只需要在**业务项目的对话窗口**里直接输入以下对话命令，无需记忆底层 CLI 参数。

::: tip 第一次接触？
如果你刚装好 `jj-flow`，建议先花 5 分钟走完 [第一次使用（完整实战）](usage.md)。如果你已经熟悉基本概念，直接按下方场景选型即可。
:::

## 一、核心交付工作流（日常必用）

这 7 个入口构成了从“认识项目 → 单仓开发 → 审查 → 跨仓迁移/调度 → Git 收工”的完整闭环：

| 命令入口 | 核心职责 | 典型适用场景 | 产物与状态落盘位置 |
| :--- | :--- | :--- | :--- |
| **[init](commands/jj-init.md)** | 登记项目地图、导入跨仓知识 | 新克隆了一个仓库，想把它加入 `~/.jj-flow/map.md` 或提取历史经验 | `~/.jj-flow/map.md`、`~/.jj-flow/knowledge/` |
| **[ralph](commands/jj-ralph.md)** | 当前仓库的五步任务闭环 | 只在**当前这一个仓库**开发新功能、修 Bug、改样式，并留存验收记录 | `.workflow/ralph/task-…/`（归档后迁入 `completed/`） |
| **[review](commands/jj-review.md)** | 独立只读代码审查 | 对当前任务或工作区改动发起审查，输出 `[OK]`、`[WARN]` 或 `[BLOCK]` | `.workflow/ralph/task-…/.state/reviews/` |
| **[same](commands/jj-same.md)** | 跨仓同源适配迁移 | 项目A 已完成并提交，要把同一能力按项目B、项目C 的代码规范迁过去 | 各目标仓的 `.workflow/ralph/task-…/` |
| **[dispatch](commands/jj-dispatch.md)** | 多项目统筹预览与调度 | 一次改动横跨多个仓库，需要先看分支预览表、统一批准后再分派跟踪 | `~/.jj-flow/`（统筹账本）+ 各仓 `.workflow/ralph/` |
| **[end](commands/jj-end.md)** | Git 提交、推送与合并收尾 | 代码验收完毕，自动提交本任务文件、推送工作分支并安全合入 `dev` | Git 提交历史与远端分支 |
| **[jj](commands/jj.md)** | 意图识别与命令分流 | 拿不准该用上面哪一个命令时，直接描述目的，由它推荐并转入对应入口 | 不直接写文件，转交目标命令处理 |

## 二、可选辅助引擎（按需调用，不替代验收）

当你面对复杂跨模块分析、标准化文档流水线或多方案比选时，可以显式调用以下 4 个辅助引擎。**注意：它们只负责组织本轮分析或方案探索，单独跑完不代表业务需求已验收通过。**

| 辅助引擎 | 核心职责 | 何时调用 | 产物位置 |
| :--- | :--- | :--- | :--- |
| **[team-coordinate](commands/jj-team-coordinate.md)** | 动态拆分多角色协同 | 需求横跨多个模块，希望按安全、性能、实现等不同视角并行分析或开发 | `.workflow/.team/TC-…/` |
| **[team-lifecycle](commands/jj-team-lifecycle.md)** | 固定角色 SDLC 流水线 | 希望严格按“写规格（PRD）→ 计划 → 实现 → 测试 → 审查”标准化推进 | `.workflow/.team/TLV4-…/` |
| **[team-swarm](commands/jj-team-swarm.md)** | 多假设方案搜索与收敛 | 架构方案未定，希望生成多个候选方案并经过对抗评分选出最佳路径 | `.workflow/.team/TAS-…/artifacts/best-solution.md` |
| **[evaluated](commands/jj-evaluated.md)** | 真实交付记录离线复盘 | 导出真实对话与 Git 记录，分析跨仓迁移耗时、返工原因并改进工作流 | `.workflow/evaluated/EP-…/report.md` |

## 三、不同宿主工具的调用前缀

所有命令在不同 AI 编程工具中共享同一套逻辑，仅触发前缀略有不同：

| 宿主工具 | 触发前缀 | 调用示例 | 详细说明 |
| :--- | :--- | :--- | :--- |
| **Codex** | `$` | `$jj-ralph 登录成功后密码过期提醒` | 使用 `$` 符号唤醒技能 |
| **Claude Code** | `/` | `/jj-ralph 登录成功后密码过期提醒` | 使用斜杠命令唤醒，支持菜单自动补全 |
| **Grok / Qoder** | `/` | `/jj-dispatch 预览分发到项目A和项目B` | 使用斜杠命令唤醒，Grok 自动兼容 Claude 资产 |

详细宿主机制（如单会话 Mode S、隔离工作区 Mode W）请参阅 [宿主平台与工作模式](concepts-hosts.md)。

## 四、高频对话模板速查

### 1. 日常一句话极简写法

```text
# 1. 把当前仓库加入全局项目地图
$jj-init 当前仓加入全局地图，中文名「项目A」

# 2. 在当前仓库做一个需求
$jj-ralph 票面预览弹窗的关闭按钮点击没反应，修一下

# 3. 审一下刚改好的代码
$jj-review 审一下刚才的改动

# 4. 把做好的能力迁移到项目B 和项目C
$jj-same 交接到 项目B 项目C

# 5. 多项目先看预览表再派发
$jj-dispatch 把 README 的依赖安装命令改成 pnpm，先预览项目A、项目B、项目C

# 6. 提交代码并合并到 dev 分支
$jj-end
```

### 2. 结构化四要素写法（适合复杂需求）

当需求边界较复杂时，可以在命令后附上 **目标、资料、范围、验收** 四项，Agent 会直接据此生成精准合同：

```text
$jj-ralph
目标：登录成功后如果接口返回 password_expired=true，弹出改密引导框
资料：参考 src/views/login/LoginForm.vue 与现有弹窗组件
范围：只改登录成功回调路径，不动全局路由守卫与注册页
验收：1. 过期时弹窗展示；2. 点击确认跳转 /account/password；3. 单测全绿
```

## 相关阅读

* [第一次使用（完整实战）](usage.md)
* [常见避坑与自检清单](pitfalls.md)
* [证据门禁：什么算做完](concepts-evidence.md)
* [CLI 命令行参考（供维护者调试）](commands/cli.md)
