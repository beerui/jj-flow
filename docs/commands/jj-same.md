# same — 将能力同源迁移到兄弟仓库

当你在 **项目A** 用 `ralph` 把一个需求做完并提交后，`same` 负责把这项能力**按项目B、项目C 各自的代码规范与架构写法**迁移过去。

核心原则：**迁的是“业务需求与验收标准”，绝不是把项目A 的文件硬拷过去覆盖项目B**。每个目标仓库都会独立核对分支、独立调研目录结构、独立修改验证并单独汇报结果。

| 宿主工具 | 调用写法 |
| :--- | :--- |
| **Codex** | `$jj-same …` |
| **Claude Code / Grok / Qoder** | `/jj-same …` |

## 一、适用场景与边界

**什么时候用 `same`：**
* **项目A** 的改动已经完成并 `git commit`，现在要把同一功能同步到同源的 **项目B** 或 **项目C**。
* 手头有明确的源仓库凭据（刚归档的 `ralph` 交接包、源仓库 commit 哈希或当前会话记录）。

**什么时候别用 `same`：**

| 你想做的事 | 应该去哪个入口 | 原因说明 |
| :--- | :--- | :--- |
| 在当前这一个仓库从零开发需求 | [ralph · 单仓任务闭环](jj-ralph.md) | `same` 需要源仓库改动作参考，不用于单仓从头开发 |
| 涉及三四个以上项目，想先看完整预览表、统一审批后再分派 | [dispatch · 多仓统筹调度](jj-dispatch.md) | `dispatch` 提供专门的只读分支预览表与审批控制面 |
| 迁移代码已经写完，想提交并合入 `dev` 分支 | [end · Git 提交与合并](jj-end.md) | `same` 只负责迁移代码与跑测试，不主动 `git commit` / `push` |

## 二、开始前 3 项必查（避坑关键）

1. **源仓库（项目A）必须已经 `git commit`**：如果源仓库还有未提交的脏改动，交接状态会标记为“未就绪”，`same` 会先停下来请你提交源仓库代码。
2. **确认目标仓库（项目B、项目C）的分支正确**：在开始迁移前，确认目标仓库切在预期功能分支上。如果分支不对，`same` 会在动手前停下来询问你。
3. **目标仓库名称明确**：使用项目地图（`~/.jj-flow/map.md`）中的名称（如“项目B、项目C”）。如果只含糊说一句“迁到三端”而没点名具体是哪几个仓，Agent 会先问清楚再动手。

## 三、标准执行流程（5 步同源适配）

当你在对话里说出 `$jj-same 交接到 项目B 项目C` 后，Agent 按以下 5 步执行：

| 步骤 | 阶段说明 | Agent 具体做什么 |
| :--- | :--- | :--- |
| **1. 锁定本轮源增量** | 确定迁什么 | 读取源仓库（项目A）刚刚提交的 commit 与本轮 `ralph` 任务增量，只迁移本轮改动的业务规则，不翻炒陈年旧账。 |
| **2. 核对目标仓与分支** | 确定往哪迁 | 检查项目B、项目C 的本地路径与当前 Git 分支；若分支不匹配或有冲突脏文件，立即停下询问你。 |
| **3. 派发目标仓只读调研** | 摸清目标仓写法 | 为每个目标仓库写一份只读调研派单（`ASSIGNMENT-RESEARCH`），派调研子代理摸清项目B、项目C 里对应的组件路径与写法差异。 |
| **4. 派发目标仓代码适配** | 按目标仓写法落地 | 根据调研结论写实施派单（`ASSIGNMENT-HANDOFF`），派实现子代理按目标仓自己的框架与组件风格完成修改（不同目标仓库可并行推进，同一仓库内保持串行）。 |
| **5. 逐仓验证与独立小结** | 真实核验不虚报 | 在各目标仓库运行相关测试，并为每个仓库输出一份结构化小结。**如果项目B 成功、项目C 卡住，会如实报告“项目B 完成、项目C 阻塞”，绝不笼统声称“全部搞定”。** |

## 四、完整端到端实战示例

假设你刚在 **项目A**（PC 端，使用 Element Plus）完成了“登录密码过期提醒弹窗”并已执行 `git commit`，现在要把它迁到 **项目B**（H5 端，使用 Vant）和 **项目C**（管理后台）：

```text
你：
$jj-same 交接到 项目B 项目C

Agent：
已锁定源仓库（项目A）最新提交 `a3f91c2`（任务：`task-login-reminder`）。
目标仓库分支核对通过：
- 项目B：当前在 `feat/password-expired-tip`（干净）
- 项目C：当前在 `feat/password-expired-tip`（干净）

正在并行派发项目B、项目C 的目标仓调研子代理……
- [research] 项目B：登录回调位于 `src/pages/auth/login.vue`，弹窗组件使用 Vant `showConfirmDialog`
- [research] 项目C：登录回调位于 `src/views/system/login.vue`，弹窗组件使用 `ElMessageBox.confirm`

正在并行派发项目B、项目C 的交接实施子代理……

## 项目B 小结
- 做法：适配（将 PC 端弹窗逻辑适配为 H5 端 Vant `showConfirmDialog`）
- 改动：`src/pages/auth/login.vue`、`tests/auth-login.spec.ts`（新增 `password_expired` 判断与跳转）
- 验证：已执行 `npm test -- tests/auth-login.spec.ts`（3 项通过）
- Git：`feat/password-expired-tip @ 8d2e10a`；当前改动未提交
- 下一步：本地预览无误后，可在项目B 执行 `$jj-end` 提交合入 `dev`

## 项目C 小结
- 做法：直接迁移（同为 Element Plus 体系，复用相同判空与路由跳转结构）
- 改动：`src/views/system/login.vue`、`tests/login.spec.js`
- 验证：已执行 `npm test -- tests/login.spec.js`（3 项通过）
- Git：`feat/password-expired-tip @ 5c09b4e`；当前改动未提交
- 下一步：可在项目C 执行 `$jj-end` 提交合入 `dev`
```

## 五、常用说法速查

```text
# 紧接着 ralph 完成后直接交接（最常用）
$jj-same 交接到 项目B 项目C
$jj-same 开始交接

# 只迁移其中一个仓库，或处理完阻塞后接着迁下一个
$jj-same 开始迁移项目B
$jj-same 继续迁项目C

# 迁移时顺带提醒分支或注意事项
$jj-same 把密码过期弹窗迁到项目B，注意只在 feat/password-expired-tip 分支上改

# 源仓库没有 ralph 任务，直接按提交或会话记录迁移（结构化写法）
$jj-same
源=项目A
目标=项目B,项目C
当前需求=登录成功后密码过期弹窗提醒
```

## 六、做完之后怎么衔接？

| 当前情况 | 下一步操作 |
| :--- | :--- |
| 目标仓库已改好且测试通过，准备提交 | 进入对应目标仓库对话，输入 [`$jj-end`](jj-end.md) 完成提交、推送与合分支 |
| 某个目标仓库在小结里显示“卡住 / 阻塞” | 按小结提示处理原因（如切对分支或补齐依赖），然后直接说 `「继续迁项目C」` |
| 源仓库（项目A）后来又补了一刀修改 | 先在项目A 提交新改动，再说一次 `「更新交接并同步到项目B」`，Agent 会基于最新 commit 重新对齐增量 |

## 七、文件记录在哪里？

迁移任务会在每个目标仓库各自的 `.workflow/ralph/task-…/` 下生成或复用对应的任务记录（包含 `task_plan.md`、`progress.md` 与 `assignments/`），不会把单仓业务细节乱塞进本机全局 `~/.jj-flow`。

::: details 内部机制与交接状态词说明（供维护者与高级用户查阅）
* **子代理派单协议**：在对话路径下，主对话作为 `team-lead` 为每个目标仓分别编写 `ASSIGNMENT-RESEARCH-<target>` 与 `ASSIGNMENT-HANDOFF-<target>`，依次调用 `jj-researcher` 与 `jj-implementer` 子代理。派遣宣告、占位与续接规则见 `skills/jj/references/assignment-spawn.md`，本页不再重复。
* **交接生命周期与快照状态**：在底层维护或续接交接包时，你可能会看到「准备交接」「开始迁移」「更新交接」以及 `parent_snapshot` 的四个新鲜度状态词：
  * `REUSE`：现有交接快照依然新鲜，可直接用于目标仓迁移。
  * `REFRESH_SOURCES`：源仓库部分文件发生变更，需先重新读取源资料。
  * `REBASELINE`：源仓库基线 commit 已推进，需重新建立增量对照。
  * `BLOCKED`：源仓库未提交或目标仓分支不合规，暂停写入目标仓。
:::

## 相关阅读

* [ralph · 单仓任务闭环](jj-ralph.md)
* [dispatch · 多仓统筹调度](jj-dispatch.md)
* [end · Git 提交与合并](jj-end.md)
* [证据门禁：什么算做完](../concepts-evidence.md)
* [常见避坑与自检清单](../pitfalls.md)
