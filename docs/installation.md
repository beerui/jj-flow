# 安装

装的是 **对话入口**（skill / 斜杠命令），不是后台服务。  
装好后：日常只在对话里用 `$jj-…` 或 `/jj-…`，**不用学命令行**。

包名：`@brewer/jj-flow`（旧包名 `@shendu-sdt/jj-flow` 已弃用）。

## 推荐：在当前项目装全套

在项目根目录执行：

```bash
npx @brewer/jj-flow@latest install-skill --platform all --project
```

会装进本项目的 Codex / Claude / Grok / Qoder 配置目录。

| 平台 | 装到哪里 |
| --- | --- |
| Codex | `.codex/skills` + `agents` |
| **Claude** | **`.claude/skills`（完整 skill）** + `.claude/commands`（薄入口） |
| Grok | `.grok/skills` |
| Qoder | `.qoder/skills` |

skill 正文在 npm 包顶层的 `skills/`；Claude 的薄斜杠命令在 `claude-commands/`。

## 只装某一个工具

```bash
npx @brewer/jj-flow@latest install-skill
npx @brewer/jj-flow@latest install-skill --platform claude
npx @brewer/jj-flow@latest install-skill --platform grok
npx @brewer/jj-flow@latest install-skill --platform qoder
```

不加 `--project` 时，装到用户全局目录（Claude：`~/.claude/skills` + `~/.claude/commands`）。

## 卸载（先预览）

```bash
npx @brewer/jj-flow@latest uninstall-skill --platform all --dry-run --json
```

只删本工具登记过的文件；你本地改过的默认不会乱删。

## 装好后怎么喊

| 你用的工具 | 写法 | 例子 |
|------------|------|------|
| Codex | `$jj-…` | `$jj-ralph 修一下登录提示` |
| Claude | `/jj-…` | `/jj-same 交接到项目B`（**没有** dispatch） |
| Grok / Qoder | `/jj-…` | `/jj-dispatch 分发到项目A和项目C` |

下一步 → [五分钟上手](usage.md)

## 本机目录（可选）

`install-skill` 会在 **`~/.jj-flow`** 生成空结构（已有文件不覆盖）：调度状态、`map.md`、`knowledge/`。  
新项目默认不进全局索引；要写入地图或补知识库，在对话里用 `$jj-init` / `/jj-init`。

| 配置项 | 默认 | 干什么 |
|--------|------|--------|
| 调度状态目录 | `~/.jj-flow` | 多项目调度记录 |
| 项目地图 | `~/.jj-flow/map.md` | 全局项目索引（须你同意才加行） |
| 知识库目录 | `~/.jj-flow/knowledge` | 跨项目知识（须你同意才投喂） |
| 项目族根目录 | 可选 | 本机多个仓库的根；公司另有路径可在 `naming.json` 改 |

维护者改 skill 源码：见 [维护说明](maintenance.md)。

## 旧名字（已不用）

不要再找：`$jj-delivery` / `$jj-validate` / `$jj-evolve`。  
调度记录里的 `delivery_id` 只是 **任务编号**，不是要你输入的命令。
