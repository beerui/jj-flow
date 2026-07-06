# jj-flow

`jj-flow` 让你在 Codex 里用一句 `$jj delivery ...` 启动一次真实交付：把需求、PRD、接口文档、设计图、日志和必须拍板的决定放进对话，Codex 会按“先找资料、再计划、再实现、再验证”的顺序推进。

它适合这种场景：

- 你有一个真实需求，不想手动拆成分析、计划、开发、测试、复盘好几段提示词。
- 你手上有 PRD、YApi、MasterGo、ARMS/SLS、Codex 历史线程等资料，希望 Codex 先整理清楚再动代码。
- 你希望证据不足时先停下来问，而不是让模型猜。

它不是一个新的开发框架，也不是让你在终端里跑完整流水线的工具。普通使用入口是 Codex 对话里的 `$jj`。

## 快速使用

先安装：

```bash
npx @shendu-sdt/jj-flow@beta install-skill
```

只想给当前项目安装：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --project
```

然后打开你的项目，在 Codex 里直接发：

```text
$jj delivery 按 PRD、接口文档和设计图完成这个需求
```

也可以把资料和边界直接写进去：

```text
$jj delivery
需求：实现 AI 获客列表和详情。
资料：PRD 在 docs/v17.1，接口看 YApi 链接，设计图是 MasterGo 链接。
范围：本期不做导出。
验收：页面还原设计，接口字段真实，测试通过。
```

## 继续阅读

完整文档在：

[https://beerui.github.io/jj-flow/index.html](https://beerui.github.io/jj-flow/index.html)

- 第一次用：看 [安装](https://beerui.github.io/jj-flow/installation.html) 和 [使用说明](https://beerui.github.io/jj-flow/usage.html)。
- 想知道该用哪个命令：看 [命令参考](https://beerui.github.io/jj-flow/commands.html)。
- 看到不懂的缩写：看 [术语与缩写](https://beerui.github.io/jj-flow/glossary.html)。

## 维护者

维护、发布和文档站构建规则见 [维护说明](https://beerui.github.io/jj-flow/maintenance.html)。README 不再承载完整命令表，避免和文档站重复维护。
