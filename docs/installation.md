# 安装

装的是 **对话入口**（skill / 斜杠命令），不是再装一个后台服务。  
装好后：日常只在对话里用 `$jj-…` 或 `/jj-…`，**不用学命令行**。

## 推荐：在当前项目装全套

在项目根目录执行：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform all --project
```

会装到本项目的 Codex / Claude / Grok / Qoder 配置目录里。

## 只装某一个工具

```bash
npx @shendu-sdt/jj-flow@beta install-skill
npx @shendu-sdt/jj-flow@beta install-skill --platform claude
npx @shendu-sdt/jj-flow@beta install-skill --platform grok
npx @shendu-sdt/jj-flow@beta install-skill --platform qoder
```

不要 `--project` 时，会装到用户全局目录。

## 卸载（先预览）

```bash
npx @shendu-sdt/jj-flow@beta uninstall-skill --platform all --dry-run --json
```

只删本工具登记过的文件。你本地改过的默认不会乱删。

## 装好后怎么喊

| 你用的工具 | 写法 | 例子 |
|------------|------|------|
| Codex | `$jj-…` | `$jj-ralph 修一下登录提示` |
| Claude | `/jj-…` | `/jj-same 交接到兑接`（**没有** dispatch） |
| Grok / Qoder | `/jj-…` | `/jj-dispatch 分发到承接和承载` |

下一步 → [五分钟上手](usage.html)

## 本机路径（可选）

多项目调度状态默认写在用户目录 **`~/.jj-flow`**。  
若公司本机还有 portfolio / 知识库路径，可在配置文件里改（Agent 会读；你一般不用管）。

| 配置项 | 默认 | 干什么 |
|--------|------|--------|
| 调度状态目录 | `~/.jj-flow` | 多项目调度记录 |
| 项目族根目录 | 可选 | 本机多个仓库的根 |
| 知识库目录 | 可选 | 跨项目知识 |

维护者改 skill 源码：见 [维护说明](maintenance.html)。

## 旧名字（已不用）

不要再找：`$jj-delivery` / `$jj-validate` / `$jj-evolve`。  
调度记录里的 `delivery_id` 只是 **任务编号**，不是要你输入的命令。
