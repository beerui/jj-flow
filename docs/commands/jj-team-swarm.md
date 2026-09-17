# team-swarm — 用多假设搜索选方案

**可选入口：** 只帮你搜索和比较方案，单独跑完不算验收通过；验收仍看 [ralph](jj-ralph.md) / [dispatch](jj-dispatch.md) 的记录。针对架构路径或实现策略生成多个候选，经过探索、评分、收敛后给出一份推荐方案。

## 写法

| 工具 | 写法 |
|------|------|
| Codex / Grok / Qoder | `$jj-team-swarm …` |
| Claude | `/jj-team-swarm …` |

## 适用与边界

**用得当：**

- 架构路径或方案不确定，需要多轮比较
- 希望候选之间有明确的评分和反方意见
- 你明确说"蚁群"、"ACO"、"对抗搜索"或"多假设搜索"

**别用在：** 小改动用 [ralph](jj-ralph.md)；普通多角色实现用 [coordinate](jj-team-coordinate.md)；固定规格链用 [lifecycle](jj-team-lifecycle.md)。

## 开始前

1. 说清搜索目标、候选空间和你关心的评分标准；不清楚时会先问
2. 确认本机有 Python 3.10 或更高版本（标准库即可）；缺少时会报告并降级，不伪造评分
3. 搜索成本可能较高；嵌在主流程时，开始重型搜索前会给一行提示

## 第一次这样用

**你说：**

```text
$jj-team-swarm 比较三种缓存失效方案并收敛推荐
```

**Agent 会做：**

1. 先保存搜索目标和评分设置
2. 初始化搜索控制器，循环执行探索、评分、更新和收敛；候选全部失败或长期不收敛时会停下来说明
3. 收敛后综合出 `best-solution.md`，列出推荐、依据和限制

**你会看到：**

```text
搜索目标：缓存失效方案
当前轮次：探索 → 评分 → 收敛
推荐方案：.workflow/.team/TAS-…/artifacts/best-solution.md
下一步：归档 / 保留继续 / 再搜索一轮
```

**怎样算做完：** 推荐方案和搜索过程产物可查；要把方案实现并验收，仍回到 ralph 或 dispatch。

## 常用说法

```text
$jj-team-swarm 搜索登录改造的架构路径
$jj-team-swarm 比较三种缓存方案，重点看一致性和迁移成本
$jj-team-swarm resume
```

## 做完之后

| 你想做什么 | 下一步 |
|------------|--------|
| 采用推荐方案实现 | 在 [ralph](jj-ralph.md) 里引用 `best-solution.md` |
| 继续下一轮搜索 | 说 `resume` 或调整目标后再运行 |
| 只保存结果 | 选择归档，不把它当作验收凭证 |

## 边界细则

宿主能力不同：有 Workflow 能力的优先用 Workflow；其余走 agent 降级路径，Python ACO 控制器仍负责搜索状态。直接调用没有强制长提示；嵌在 ralph、review 或 dispatch 中只在重型工作前提示一次。

## 记录在哪

```text
.workflow/.team/TAS-<简述>-<日期>/
  swarm-config.json
  workflows/
  scores/
  artifacts/best-solution.md
```

## 相关

[coordinate](jj-team-coordinate.md)、[lifecycle](jj-team-lifecycle.md)、[ralph](jj-ralph.md)、[命令总览](../commands.md)
