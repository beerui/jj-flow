---
title: 可交付的项目级 AI 实践工程 Demo Kit
description: 用真实项目命令演示 YApi、Maestro、ARMS 和经验沉淀如何组成项目级 AI 交付闭环。
---

# 可交付的项目级 AI 实践工程 Demo Kit

这个页面不是文章，而是演讲时可以照着跑的演示稿。

它服务于一个目标：让“项目级 AI 实践工程”不是概念，而是能现场展示、能复盘、能讨论的工作流。

## 一、演讲前置准备

演示前先确认 3 件事：

```powershell
node -v
npm -v
maestro --help
```

如果要演示真实项目链路，建议准备两个目录：

```text
D:/2025/seo-daji-web
D:/daji-docs/daji-docs-site
```

`seo-daji-web` 用来演示真实工作流。  
`daji-docs-site` 用来展示这份文档和 Demo Kit。

启动文档站：

```powershell
cd D:/daji-docs/daji-docs-site
npm run dev
```

如果只做分享，不想现场跑长流程，就提前打开：

```text
/other/project-ai-delivery-flow
/other/project-ai-delivery-flow-demo-kit
```

## 二、演示 1：接口不能靠猜，要从 YApi 拉真实契约

### 演示目标

证明 AI 写接口代码前，必须先拿真实接口参数和返回值，而不是根据 PRD 或字段名猜。

### 真实输入

AI 获客任务分页查询接口：

```text
http://yapi.sdpjw.com/project/1437/interface/api/100591
```

### 可跑命令

如果在 Codex 中使用技能：

```bash
/yapi http://yapi.sdpjw.com/project/1437/interface/api/100591 --base-path /gateway/api/business-service-web
```

如果直接使用 npm 工具：

```powershell
yapi-tool fetch "http://yapi.sdpjw.com/project/1437/interface/api/100591" --format md --base-path "/gateway/api/business-service-web"
```

如果提示未登录：

```powershell
yapi-tool login
```

### 现场讲法

这里不要讲“我有一个工具能拉接口”。

要讲的是：AI 最容易犯的错，是把“看起来合理的字段”当成“真实存在的字段”。YApi 的作用是把接口契约变成证据。

### 观众应该看到的价值

```text
接口路径来自真实 YApi
请求参数来自真实 YApi
返回结构来自真实 YApi
计划阶段就能把接口文档写进 read_first
执行阶段不允许 AI 自己补字段
```

### 本案例的关键 guard

在 AI 获客的真实工作中，YApi 里出现过：

```text
currentUserId
currentUserName
```

但 `seo-daji-web` 的项目习惯是：前端默认不显式传用户和租户字段，而是通过 token / header 透传。

所以演示时要强调：真实接口文档不是让 AI 盲目照抄，而是让 AI 发现冲突并写入 guard。

```text
YApi 中存在 currentUserId / currentUserName
但前端默认不主动传用户身份字段
执行阶段需要确认后端是否强依赖
未确认前，不让 AI 自己猜
```

## 三、演示 2：从 PRD 到 phase，不要让 AI 散聊式开发

### 演示目标

证明需求进入后，不能直接让 AI 写代码，而是先变成可追踪的 blueprint、roadmap、phase、plan。

### 可跑命令

进入真实项目：

```powershell
cd D:/2025/seo-daji-web
```

先做知识系统 gate：

```powershell
maestro search "AI获客" --type spec
maestro load --type spec --category coding
```

生成规格包：

```bash
/maestro-blueprint "读取 @docs/v17.1/接口文档.md @docs/v17.1/prd.md，生成完整规格包：需求边界、业务流程、接口依赖、数据流、架构说明、模块拆分、Epics 和开发阶段拆分" -y
```

生成路线图：

```bash
/maestro-roadmap "基于 @docs/v17.1/接口文档.md @docs/v17.1/prd.md 和 blueprint 结果，拆分 milestone、phase、优先级、依赖关系" -y
```

推进 Phase 1：

```bash
/maestro-analyze 1
/maestro-plan 1
/maestro-execute 1
```

### 预期产物

```text
.workflow/blueprint/BLP-ai-acquire-customer-2026-07-01/
.workflow/roadmap.md
.workflow/scratch/20260701-plan-P1-contract-list-create/plan.json
.workflow/scratch/20260701-plan-P1-contract-list-create/.task/
.workflow/state.json
```

### 现场讲法

这里要讲“结构化交付”，不要只讲命令。

同一句需求，散聊式开发会变成：

```text
你帮我做一下
AI 写一点
我发现不对
AI 再改一点
最后谁也说不清楚边界
```

工作流开发会变成：

```text
需求边界
接口依赖
业务流程
phase 拆解
任务计划
执行证据
验证报告
```

这就是项目级交付和一次性生成的区别。

## 四、演示 3：phase 编号不能猜，要回到状态文件

### 演示目标

证明 `maestro-analyze 1` 里的 `1` 不是随便猜的，它必须回到 `.workflow/state.json` 和 `phase_slugs` 反查。

### 可跑命令

```powershell
cd D:/2025/seo-daji-web
Select-String -Path ".workflow/state.json" -Pattern "phase_slugs","PH-002-001","PH-002-002"
```

也可以直接打开：

```powershell
Get-Content ".workflow/state.json"
```

### 观众应该看到的价值

```text
数字 1 对应真实 phase
phase 对应 milestone
milestone 对应 roadmap
plan 和 execute 都能追到 phase
```

这说明 AI 不是在凭感觉执行“第 1 步”，而是在当前项目状态里找到真实目标。

## 五、演示 4：验证不能只说 PASS，要有命令证据

### 演示目标

证明 AI 完成代码后，必须拿目标化验证命令证明，而不是说“看起来完成了”。

### 真实命令

AI 获客 Phase 2 曾经使用过这组目标化验证：

```powershell
cd D:/2025/seo-daji-web
node --test pages/merchants/seller-center/busuness/ai-acquire-customer.helper.test.mjs pages/merchants/seller-center/busuness/ai-acquire-customer.contract.test.mjs
```

目标化 lint：

```powershell
npx eslint constants/ai-acquire-customer.ts apis/ai-acquire-customer.ts pages/merchants/seller-center/busuness/ai-acquire-customer.helper.ts pages/merchants/seller-center/busuness/ai-acquire-customer.helper.test.mjs pages/merchants/seller-center/busuness/ai-acquire-customer.contract.test.mjs pages/merchants/seller-center/busuness/ai-acquire-customer.vue
```

diff 检查：

```powershell
git diff --check
```

### 现场讲法

这里要讲清楚一个原则：

```text
验证不是为了显得流程完整。
验证是为了回答：这次改动有没有真的影响正确的地方。
```

如果项目已有大范围 typecheck 历史问题，就不要强行把它当作本次完成标准。更合理的是：目标化 test、目标化 lint、diff 检查和人工 UAT 状态分别说明。

## 六、演示 5：线上流量问题不能靠感觉，要用 ARMS / SLS 反推

### 演示目标

证明线上问题进入后，AI 不能直接猜代码瓶颈，必须先看真实流量数据。

### 真实案例数据

来自 `goods-detail` 访问暴涨分析：

```text
2026-07-02 09:30-10:00
goods-detail view：370
session：191
distinct detail URL：约 211
resource：8270
referrer 为空：324/370
initial_load：215/370
top 商品页最高 view：7
```

相邻窗口：

```text
09:00-09:30：429 次 goods-detail view
10:00-10:30：637 次 goods-detail view
```

现场可以直接运行这个小脚本复盘判断：

```powershell
node -e "const d={views:370,sessions:191,urls:211,emptyRef:324,top:7,prev:429,next:637}; console.log({emptyRefRate:(d.emptyRef/d.views).toFixed(2),viewsPerUrl:(d.views/d.urls).toFixed(2),shape:d.top<10&&d.urls>200?'many-url direct traffic':'single hot item',window:d.prev>d.views||d.next>d.views?'sustained high traffic':'single spike'});"
```

### 真实工作流命令

有 ARMS 凭证和 task 时：

```bash
$arms-fix task=<task-id>
```

从 ARMS 控制台 URL 进入时：

```bash
$arms-fix "https://arms.console.aliyun.com/#/rum/rum-explorer/..."
```

### 现场讲法

这里的重点是让观众看到：线上问题不是一句“可能被刷了”。

正确分析顺序是：

```text
确认精确 app.id
比较目标窗口和相邻窗口
看 referrer / initial_load / distinct URL
回到代码看 SSR 和客户端请求放大
确认配置是否真的被运行时消费
最后决定限流、缓存、降级和压测方案
```

`arms-fix` 的价值是把这条链路变成任务：findings、fix 分支、验证、commit、resolution，而不是只在聊天窗口里分析一下。

## 七、演示 6：经验要沉淀成下一次的老师

### 演示目标

证明一次修复或一次功能交付结束后，必须把经验沉淀成规则，否则下次 AI 还是会重新猜。

### 可跑命令

例如项目里不希望 AI 无意义使用 `localePath`：

```bash
/spec-add coding "避免无必要 localePath" "在 seo-daji-web 中，除非现有链路明确需要 locale 前缀路由，不要新增 useLocalePath() 或无意义包 localePath(...)" --keywords localePath,i18n,routing --description "避免无 localePath 包装"
```

加载规则：

```powershell
maestro load --type spec --category coding
```

### 现场讲法

这一步要回到“老师和学生”的比喻。

如果没有规则沉淀，这次改对只是运气。  
有了规则沉淀，下次换模型也能先读到项目边界。

## 八、演示 7：二开 maestro-flow 的最小闭环

### 演示目标

证明二开不是为了炫命令，而是为了把这些真实链路统一成一套可交付系统。

### 当前可跑骨架

我已经把自有 workflow overlay 放到仓库里：

```text
.workflow/daji-ai-delivery/
```

现场先跑一次校验：

```powershell
cd D:/daji-docs/daji-docs-site
npm run workflow:validate
```

预期输出：

```text
Daji AI delivery workflow validation passed
examples=5
recipes=3
```

再播放一条真实 recipe：

```powershell
npm run workflow:play -- feature-delivery
```

预期输出的关键部分：

```text
Workflow: daji-ai-delivery
Recipe: feature-delivery - Feature delivery from task and API contract
Evidence:
- EV-YAPI-100591 (yapi/contract)
- EV-ZENTAO-TASK (zentao/task)
Runbook:
1. /maestro-blueprint "读取 PRD、接口文档和 evidence，生成完整规格包" -y
2. /maestro-roadmap "基于 blueprint 拆分 milestone、phase、优先级、依赖关系" -y
3. /maestro-analyze <phase>
4. /maestro-plan <phase> --evidence .workflow/daji-ai-delivery/examples/yapi-contract.evidence.json,...
```

这一步的价值是：它不只证明 JSON 能校验，还证明 evidence 可以驱动一条人和 agent 都看得懂的执行链。

再跑一次 guard gate：

```powershell
npm run workflow:gate -- --evidence .workflow/daji-ai-delivery/examples/yapi-contract.evidence.json
```

这里如果出现 `PENDING`，不是失败，而是说明还有计划、联调或 UAT 证据没完成。这个点很重要：项目级 AI 交付不能把“还没验证”包装成“已通过”。

也可以演示工具适配器出口：

```powershell
npm run workflow:evidence -- --preset yapi --id EV-RUNTIME-YAPI-100591 --path .workflow/contracts/yapi-100591.md --summary "AI 获客接口契约" --evidence "yapi-tool fetch 输出" --out .workflow/daji-ai-delivery/runtime/yapi-100591.evidence.json
```

它证明 `yapi-tool`、`arms-inspector`、`sd-zentao-cli` 后续不需要各讲各的格式，只要统一输出 evidence manifest，workflow 就能继续往下走。

### 最小闭环

```text
输入：禅道 / PRD / YApi / ARMS
  ↓
适配：转成统一 evidence manifest
  ↓
编排：maestro analyze / plan / execute / review / test
  ↓
产物：plan、task、verification、resolution
  ↓
沉淀：spec / knowhow / workflow
```

### 建议演示文件

```json
{
  "source": "yapi",
  "artifact_type": "contract",
  "path": ".workflow/contracts/yapi-100591.md",
  "summary": "AI 获客任务分页查询接口",
  "guards": [
    "接口字段以 YApi 为准",
    "前端默认不显式传 currentUserId/currentUserName"
  ],
  "evidence": [
    "yapi-tool fetch 成功输出",
    "plan.json read_first 包含该接口文档"
  ]
}
```

这份 JSON 不是示意图，现在已经在 `.workflow/daji-ai-delivery/examples/yapi-contract.evidence.json` 里有可校验版本。

### 观众应该看到的价值

```text
每个工具都有位置
每个产物都能被下一个环节读取
每个结论都有证据
每次交付都能给下一次留下规则
```

### 二开是否可用的现场判断

```text
workflow.json 能声明原则、recipe 和 overlay guards
evidence example 能覆盖 YApi、ARMS、禅道、spec
recipe 能覆盖功能交付、线上修复、经验沉淀
npm run workflow:validate 能作为最小 gate
npm run workflow:play 能把 recipe + evidence 播放成 runbook
npm run workflow:gate 能把 guards 显式判成 PASS / BLOCK / PENDING
npm run workflow:evidence 能把工具输出转成统一 evidence
```

做到这一步，二开就不是“我想做一个工作流”，而是“已经有一条可以日常试跑、可以继续接入 maestro 的工作流契约”。

## 九、演讲节奏建议

如果是 30 分钟分享：

```text
0-5 分钟：讲 AI 太快带来的错觉
5-10 分钟：老师和学生，比喻项目知识体系
10-18 分钟：讲 AI 获客、YApi、ARMS 三个真实案例
18-25 分钟：演示 YApi + phase + ARMS 复盘
25-30 分钟：讲 maestro-flow 二开计划和讨论问题
```

如果是 60 分钟分享：

```text
0-10 分钟：问题背景
10-20 分钟：真实项目踩坑
20-35 分钟：现场跑 Demo 1-5
35-50 分钟：二开计划和实施方案
50-60 分钟：讨论如何迁移到其它项目
```

## 十、演示失败兜底

现场演示最怕外部依赖失败，所以每个演示都要有兜底。

| 演示 | 可能失败 | 兜底方式 |
| --- | --- | --- |
| YApi | 未登录、内网不可达 | 展示已拉取的 Markdown 或截图，并讲 guard |
| Maestro | 目标项目不在本机 | 展示 `.workflow` 产物路径和状态文件 |
| ARMS | 无凭证、控制台 URL 不可用 | 用本页的真实数据脚本做复盘演示 |
| 测试 | 依赖没安装 | 展示之前 verification 产物和命令 |
| spec | 项目没有初始化知识库 | 只演示命令和写入内容 |

兜底不是造假，而是把“外部系统不可用”和“方法不可用”分开。分享讨论的是方法，不应该被现场网络或登录态拖死。

## 十一、原文 12 个案例的演示覆盖矩阵

主文档第 5 节里有 12 个真实案例。分享时不一定每个都现场跑，但每个都应该有可演示内容。

| 案例 | 演示命令或演示材料 | 现场重点 |
| --- | --- | --- |
| UI 设计图还原不准确 | `maestro-impeccable build "根据设计稿还原页面并输出截图验证"` | 不只看生成结果，要看截图验证和还原报告 |
| 本地环境问题会干扰 AI 开发 | `chcp 65001`、`node -v`、`maestro --help` | 先排环境，再评价 AI 能力 |
| 已有项目修 Bug 容易反复 | `/maestro-analyze "<bug 描述>"` → `/maestro-plan --from analyze:<ANL>` | 先定位根因，再计划修复 |
| 简单问题也需要留痕 | `maestro-quick MarketOverviewSection.vue:239 这里所有推荐都放开` | quick 也要留下需求、边界和状态 |
| 单会话自我证明 | `quality-review 2`、`quality-auto-test 2` | 实现、review、test 分角色，避免自己给自己判卷 |
| 不希望 AI 继续某种写法 | `/spec-add coding "避免无必要 localePath" ...` | 把偏好变成规则，不靠一次 prompt 记忆 |
| 高风险 Bug 长周期修复 | `odyssey-debug "<必须根因确认、验证通过、同类扫描>"` | 复杂问题追求闭环，不追求快 |
| PRD + 接口设计落地 | `/maestro-blueprint` → `/maestro-roadmap` → `/maestro-analyze 1` | 需求先变成规格、路线和 phase |
| 完成功能后让 AI 下次照做 | `/maestro-learn "提取 AI 获客实现规则"` | 产物不只代码，还有下次的教学材料 |
| ARMS / SLS 线上反馈 | `$arms-fix task=<task-id>` 或本页 Node 复盘脚本 | 线上事实反推代码瓶颈 |
| YApi 真实接口契约 | `/yapi http://yapi.sdpjw.com/project/1437/interface/api/100591 --base-path /gateway/api/business-service-web` | 接口字段不能猜 |
| 完整研发链路 | 演示本页“最小闭环” evidence manifest | 所有工具都回到同一条交付链路 |

这张表的作用是防止分享散掉。

每个案例最后都要落到同一个问题：

```text
这件事怎么进入工作流？
它产生什么证据？
下一个环节怎么读取它？
它最后沉淀成什么规则？
```

只要能回答这 4 个问题，这个案例就不是零散经验，而是项目级 AI 交付体系的一部分。

## 十二、现场讨论题

最后可以留 10 到 15 分钟做讨论。不要泛泛问“大家怎么看 AI”，问题要尽量具体。

### 1. 团队合作怎么做？

可以从 Claude Code 的 subagent、agent teams 和 worktree 讲起，但不要把它讲成某个公司内部八卦。重点是讨论一种协作模型：

```text
人类 owner 定目标和验收
lead agent 拆任务和汇总
多个 specialist agent 分别探索、实现、测试、review
workflow 负责状态、权限、证据和沉淀
```

可以抛给大家的问题：

```text
你们团队里哪些工作最适合交给智能体并行做？
代码实现、测试、review、文档，哪一环最容易先落地？
如果多个智能体同时改代码，应该用 worktree、分支还是任务隔离？
智能体之间的 review 能不能替代一部分人工 review？
哪些决策必须由人类 owner 兜底？
```

我自己的观点：

```text
短任务：单智能体顺序执行更稳。
中等任务：实现和 review 分开，收益最大。
大任务：lead agent + specialist agents + worktree 隔离更合理。
高风险任务：智能体可以收集证据和提出方案，但最终审批不能省。
```

### 2. Harness 会不会越来越不重要？

先给定义：

```text
harness = 包在模型外面的工程外壳
包括 prompt 模板、任务拆解、工具调用、agent 编排、retry、状态机、评测和权限控制
```

然后把问题拆开：

```text
补模型能力的 harness 会变弱。
管项目交付的 workflow 会变强。
```

可以这样解释：

```text
模型越强，越不需要外部流程一步步教它怎么想。
但模型越能做事，越需要工程系统告诉它哪些能做、哪些不能做、证据在哪里、怎么验收、怎么回滚。
```

适合抛给大家的问题：

```text
我们现在写的 harness，是在补模型能力，还是在管交付风险？
如果模型明年更强，这套流程还有哪些部分仍然有价值？
哪些 prompt 链可以被删掉？
哪些权限、状态、证据和验收机制必须保留？
```

我的结论可以用一句话收束：

```text
大模型越强，补智商的 harness 越不重要；但管边界、管证据、管交付的 workflow 会越来越重要。
```
