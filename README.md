# XD Confluence Skill

这是一个给 AI agent 使用的心动 Confluence skill。它的目标很简单：让 agent 能一步一步帮你接上公司 Confluence，并在之后按安全流程搜索、读取、整理或更新内部文档。

这个仓库本身就是一个 installable skill repo；支持 GitHub skill 安装的 agent 应该直接安装 repo 根目录。

## 最推荐用法

不要手动读完整个仓库。直接把下面这段复制黏贴给你的 agent：

```text
打开 https://github.com/dashhuang/xd-confluence-skill。
把这个仓库根目录安装成本地 skill：xd-confluence。
如果还没配置 Atlassian Rovo MCP，就帮我配置。
然后按 AGENTS.md 和 references/install-and-permissions.md 一步一步带我接入公司 Confluence。
不要跳过权限检查。
最后用 getConfluenceSpaces 做一次只读自检。
```

## Agent 会做什么

正常流程应该是：

1. 安装这个 repo 根目录作为 `xd-confluence` skill
2. 确认 Atlassian Rovo MCP 已配置到 `https://mcp.atlassian.com/v1/mcp`
3. 引导你用公司 Atlassian 账号完成 OAuth
4. 调用 `getConfluenceSpaces` 做只读自检
5. 确认你至少能看到一个公司 Confluence space
6. 之后才进入搜索、阅读、总结或写文档流程

在第 5 步之前，agent 不应该说“已经接好了”。

## 兼容不同 Agent

你给 agent 的提示词尽量保持上面那一段就够了。不同 agent 的安装细节放在仓库内部处理：

- `AGENTS.md`：通用 agent 安装指引
- `adapters/codex/`：Codex 相关说明
- `adapters/claude/`：Claude Code 相关说明
- `adapters/openclaw/`：OpenClaw 相关说明

如果 agent 需要特殊路径或命令，让它自己读取对应 adapter。

## 这个 Skill 适合做什么

- 接入公司 Confluence
- 排查 OAuth、MCP、产品权限、space 权限问题
- 搜索并读取公司内部页面
- 根据已有页面整理总结、对比方案、起草材料
- 在目标页面明确时，新建或更新 Confluence 页面

写入页面前，agent 应该先读取当前页面、确认目标位置，并避免误改正式规范或多人共用页面。

## 默认接入方式

默认走 Atlassian 官方 Rovo MCP：

```json
{
  "mcpServers": {
    "atlassian-rovo": {
      "type": "http",
      "url": "https://mcp.atlassian.com/v1/mcp"
    }
  }
}
```

默认优先 OAuth。不要把 API token、OAuth token、cookie 或其他凭证写进这个 repo。

## OpenClaw 高级增强

普通使用不需要看这一层。

`extras/openclaw-extension/` 是可选增强，提供：

- Confluence REST API 访问
- 本地 mirror/cache
- section 级写入辅助

只有当你明确需要 OpenClaw、本地镜像或更强写入能力时再启用。mirror/cache 可能包含公司内部文档正文，默认已经在 `.gitignore` 中忽略相关生成文件。

## 关键文件

- `SKILL.md`：agent 实际读取的 skill 指令
- `AGENTS.md`：给外部 agent 的安装和接入说明
- `INSTALL_WITH_AGENT.md`：更多可复制提示词
- `references/install-and-permissions.md`：安装、OAuth、权限、自检流程
- `references/admin-checklist.md`：需要管理员介入时的检查项
- `references/search.md`：搜索和候选页面判断流程
- `references/write-safety.md`：写入 Confluence 前的安全流程

## 验证

结构校验：

```bash
./scripts/validate-mvp.sh
```

手工 smoke test：

- `tests/smoke/prompts.md`
- `tests/smoke/checklist.md`
