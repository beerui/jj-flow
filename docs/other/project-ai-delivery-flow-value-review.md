---
title: 可交付的项目级 AI 实践工程：价值审稿与可用性检查
description: 从分享价值、受众收获、演示可跑性和自有 Maestro 工作流可用性角度审视当前内容。
---

# 可交付的项目级 AI 实践工程：价值审稿与可用性检查

这页是给自己看的审稿表。

它回答 3 个问题：

```text
当前分享内容有没有价值？
演示 demo 是否能让别人看懂并跑起来？
自有 maestro 工作流是否已经从想法变成可用骨架？
```

## 一、当前结论

当前内容已经从“经验文章”升级成了“可演讲 + 可演示 + 可继续二开”的材料。

最有价值的点是：

```text
它不是讲 AI 工具清单，而是讲项目级交付闭环。
它不是只讲想法，而是有 seo-daji-web、YApi、ARMS/SLS 的真实案例。
它不是只讲流程，而是补了 Demo Kit 和 .workflow/daji-ai-delivery 骨架。
它不是只讲成功，而是保留 guard、pending、UAT、后端边界这些真实问题。
```

但要注意：当前自有 workflow 达到的是“可验证 MVP”状态，还不是已经深度改造 `maestro-flow` core 的最终形态。

更准确的定位是：

```text
已经可用于分享、演示、讨论和下一步二开。
已经有 evidence schema、examples、recipes 和 validate gate。
下一步要把 evidence manifest 自动接进 maestro-plan / maestro-execute / quality-review。
```

## 二、分享内容的价值分析

### 1. 原始问题有共鸣

“AI 写得太快，但不一定能交付”是一个很多人都会遇到的问题。

它比“AI 能不能替代程序员”更具体，也更容易引发讨论。

听众能马上联想到：

```text
AI 猜接口字段
AI 忽略项目已有写法
AI 自己写完自己说 PASS
AI 改了代码但没有验证
AI 解决了当前问题但没有留下经验
```

### 2. 价值主线清楚

主线现在已经能讲成一句话：

```text
把 AI 从一次性代码生成，变成真实项目里的可交付工作流。
```

展开就是：

```text
任务进入
  ↓
真实证据
  ↓
计划拆解
  ↓
代码执行
  ↓
验证审查
  ↓
线上反馈
  ↓
经验沉淀
```

这条路径足够清楚，适合演讲。

### 3. 真实案例够硬

当前案例不是虚构 demo，而是来自真实项目：

| 案例 | 价值 |
| --- | --- |
| AI 获客 | 展示 PRD、YApi、phase、前后端边界怎么进入工作流 |
| YApi | 展示接口字段不能猜，必须拉真实契约 |
| ARMS / SLS | 展示线上流量和异常如何反推代码瓶颈 |
| spec / knowhow | 展示一次交付如何变成下一次的规则 |
| harness 讨论 | 把主题上升到未来工作流形态 |

这比单纯讲 prompt 技巧更有长期价值。

## 三、Demo Kit 的有用性分析

Demo Kit 当前有 4 个优点：

```text
有前置检查，知道演示环境是否可用。
有真实命令，不只是截图或描述。
有预期输出，观众知道应该看到什么。
有失败兜底，现场不会被登录态、内网、凭证卡死。
```

最适合现场跑的 5 个 demo 是：

```text
npm run workflow:validate
npm run workflow:play -- feature-delivery
npm run workflow:gate -- --evidence .workflow/daji-ai-delivery/examples/yapi-contract.evidence.json
YApi 拉接口契约
ARMS/SLS Node 小脚本复盘 goods-detail 流量形态
```

不建议现场完整跑的内容：

```text
完整 maestro-blueprint / roadmap / execute 链路
需要登录态的 seller-center 页面
需要真实 ARMS 凭证的端到端修复
```

这些可以展示产物和命令，不要把分享时间押在外部系统稳定性上。

## 四、自有 Maestro 工作流可用性分析

当前已经有一个可验证的自有 workflow kit：

```text
.workflow/daji-ai-delivery/workflow.json
.workflow/daji-ai-delivery/schemas/evidence.schema.json
.workflow/daji-ai-delivery/examples/*.evidence.json
.workflow/daji-ai-delivery/recipes/*.md
scripts/validate-ai-delivery-workflow.mjs
scripts/play-ai-delivery-workflow.mjs
scripts/check-ai-delivery-gates.mjs
scripts/create-ai-delivery-evidence.mjs
```

验证命令：

```powershell
npm run workflow:validate
npm run workflow:play -- feature-delivery
npm run workflow:gate -- --evidence .workflow/daji-ai-delivery/examples/yapi-contract.evidence.json
npm run test:workflow
```

当前通过标准：

```text
workflow.json 可解析
5 个 evidence example 可解析
每个 evidence example 的 path 都能追到本地产物
3 条 recipe 存在且有 chain
必填字段完整
recipe 能自动加载匹配 evidence
recipe 能和 evidence 组合成可执行 runbook
guard 能输出 PASS / BLOCK / PENDING
adapter 能把工具输出生成统一 evidence
```

这说明自有工作流已经不是纯文字方案，而是有了“生成 evidence → 播放 recipe → 检查 guard → 自动测试”的最小闭环。

## 五、距离“完全可用”的差距

如果把“完全可用”定义成能指导分享、手动执行、日常试跑、复盘和继续接入真实工具，现在已经基本满足。

如果把“完全可用”定义成发布级深度二开 `maestro-flow`，让它自动接管外部工具登录态、远程接口、分支创建、真实代码修改和线上回写，那还差 3 步：

```text
1. real adapter bridge
   让 yapi-tool、arms-inspector、sd-zentao-cli 在真实运行后直接写 runtime evidence。

2. maestro-flow core integration
   让 maestro-plan / quality-review 不只是接受 runbook，而是直接消费 evidence loader。

3. remote-state writeback
   让禅道状态、工时、ARMS resolution 和 knowhow 沉淀能回写到真实系统。
```

其中本仓库已经补齐了 evidence loader、adapter manifest 生成、recipe player 和 guard gate。下一步不是继续写更多概念，而是把这些能力接进真实 Maestro 命令和外部工具。

所以当前定位应该说清楚：

```text
分享和演示：可用。
手动工作流执行：可用。
作为 maestro-flow 二开 MVP：可用。
本仓库自有 workflow：可日常试跑。
发布级插件化接入：下一阶段。
```

## 六、下一步最短路径

不要继续堆更多概念。

下一步最值得做的是把 evidence manifest 接进真实命令链。

推荐顺序：

```text
1. yapi-tool fetch 后直接调用 workflow:evidence 写 runtime/yapi-*.evidence.json
2. arms-fix 完成后直接写 runtime/arms-*.evidence.json 和 resolution evidence
3. maestro-plan 消费 workflow:play 的 JSON 输出
4. quality-review 消费 workflow:gate 的 guard checks
5. maestro-learn 从 completion evidence 生成 spec-add 建议
```

做到第 2 步，这套自有工作流就能真正进入日常开发。

做到第 5 步，它就从“可演示”进入“可长期用”。
