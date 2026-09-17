# 安装

装的是**对话入口**（skills、斜杠命令、命名子代理），不是后台服务。装好后在业务项目的对话里用 `$jj-…` / `/jj-…`，不需要先学命令行。

## 推荐：在当前项目装全套

在业务项目根目录执行：

```bash
npx @brewer/jj-flow@latest install-skill --platform all --project
```

| 平台 | 装到哪里 |
|------|----------|
| Codex | `.codex/skills` + `.codex/agents` |
| Claude | `.claude/skills`（完整 skill）+ `.claude/commands`（斜杠命令）+ `.claude/agents`（命名子代理） |
| Grok | `.grok/skills` + `.grok/agents` |
| Qoder | `.qoder/skills` |
| AGENTS | `.agents/skills` + `.agents/commands` |

源文件在 npm 包顶层：`skills/`（对话协议）、`claude-commands/`（Claude 斜杠命令）、`agents/`（命名子代理）。

## 装好后如何调用

| 你用的工具 | 写法 | 例子 |
|------------|------|------|
| Codex | `$jj-…` | `$jj-ralph 修一下登录提示` |
| Claude | `/jj-…` | `/jj-same 交接到项目B` |
| Grok / Qoder | `/jj-…` | `/jj-dispatch 先预览再分发到项目A和项目C` |

试输入前缀确认入口可用（例如 `/jj-ralph` 出现补全）；Claude 侧可确认 `.claude/agents/` 下有 `jj-implementer.md` 等命名子代理——ralph 派单与审查依赖它们。

## 只装某一个平台

```bash
npx @brewer/jj-flow@latest install-skill --platform codex
npx @brewer/jj-flow@latest install-skill --platform claude
npx @brewer/jj-flow@latest install-skill --platform grok
npx @brewer/jj-flow@latest install-skill --platform qoder
npx @brewer/jj-flow@latest install-skill --platform agents
```

不加 `--project` 时，装到各工具的用户全局目录（如 Claude：`~/.claude`；Codex：`~/.codex`；Grok：`~/.grok`；AGENTS：`~/.agents`）。

## 升级与卸载

再次执行安装命令会**补上缺失的 skill**，默认不覆盖已有文件；**覆盖已有安装**请加 `--force`。升级后新开一轮对话，试输入 `/jj` 确认新入口出现。

卸载先预览：

```bash
npx @brewer/jj-flow@latest uninstall-skill --platform all --dry-run --json
```

只删登记过的文件；本地改过的内容默认不会误删。确认预览无误后，去掉 `--dry-run` 再执行。

## 本机目录

`install-skill` 会在 `~/.jj-flow` 生成空结构（已有文件不覆盖）：调度状态、`map.md`、`knowledge/`。新项目默认不进全局索引；要写入地图或补知识库，在对话里用 `$jj-init` / `/jj-init`。

| 配置项 | 默认 | 用途 |
|--------|------|--------|
| 调度状态目录 | `~/.jj-flow` | 多项目调度记录 |
| 项目地图 | `~/.jj-flow/map.md` | 全局项目索引（写入须经你确认） |
| 知识库目录 | `~/.jj-flow/knowledge` | 跨项目知识（写入须经你确认） |
| 项目族根目录 | 可选 | 本机多仓根路径；组织级路径可在 `naming.json` 配置 |

## 相关

[第一次使用](usage.md)、[命令总览](commands.md)、[维护说明](maintenance.md)
