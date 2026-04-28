# Install And Permissions

这份文档给 agent 用，不是给人直接读的说明书。

当用户想安装这份 Confluence skill，或者已经安装但无法访问公司 Confluence 时，按下面顺序带用户走。

## 一句话目标

把用户带到这个最小成功状态：

1. agent 已加载 skill
2. agent 已连上 Atlassian Rovo MCP
3. 用户已完成 OAuth 或公司要求的认证方式
4. `getConfluenceSpaces` 成功返回空间列表

## 步骤 1：确认安装入口

当前发布仓库本身就是 installable skill repo。

如果用户是通过 GitHub URL 安装：

- 优先把 **repo 根目录 URL** 交给 agent
- 如果 agent 能读取仓库说明，让它同时参考：
  - `AGENTS.md`
  - `INSTALL_WITH_AGENT.md`
- 如果 agent 不能直接从 GitHub 装 skill，再让它把整个 repo 根目录复制到本地 skill 目录，并命名为 `xd-confluence`

常见安装目标：

- Codex: `~/.codex/skills/xd-confluence`
- Claude Code: `~/.claude/skills/xd-confluence`
- OpenClaw: `<workspace>/skills/xd-confluence`、`~/.agents/skills/xd-confluence` 或 `~/.openclaw/skills/xd-confluence`

## 步骤 2：确认 MCP 是否可见

默认优先走 Atlassian Rovo MCP + OAuth。不要因为当前第一次调用失败就直接切到 API token。

先检查客户端是否已经看得到预期的 Confluence 工具。

预期工具至少包括这些之一：

- `getConfluenceSpaces`
- `searchConfluenceUsingCql`
- `getConfluencePage`

如果完全看不到：

- 判断为“还没接上 Atlassian Rovo MCP”
- 先指导用户让客户端加载 repo 根目录的 `.mcp.json`
- 如果客户端不吃 repo 里的 `.mcp.json`，让用户在自己的本地 MCP 配置里手动添加同一个 endpoint：

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

如果客户端或 runtime 明确不支持 remote HTTP / streamable HTTP MCP：

- 先建议升级或开启兼容的 Rovo MCP 配置
- 不要把 API token 当成普通默认路径
- 只有在用户确认当前环境短期无法支持 Rovo MCP，或者公司明确要求 API token 时，才考虑 REST API fallback

## 步骤 3：显式触发 OAuth

MCP 工具出现不代表 OAuth 链接一定会自动弹出。很多客户端只有在 agent 显式调用认证工具或登录命令时，才会返回授权链接。

如果用户还没认证：

- 先让 agent 显式触发 Atlassian Rovo MCP 的认证 / login 流程
- 如果客户端暴露了 `authenticate` 类 MCP 工具，优先调用它
- 如果客户端提供 CLI 登录命令，按该客户端方式登录，例如 `mcp login atlassian-rovo`
- 明确提醒用户使用公司 Atlassian 账号，而不是个人账号
- 如果浏览器授权后跳到 `localhost` callback 报错，按客户端提示把完整 callback URL 交回 agent 继续完成认证
- OAuth 完成后，再回到 `getConfluenceSpaces`

如果用户明确说公司统一走 API token，或当前 runtime 确认无法支持 Rovo MCP：

- 说明这是 fallback，不是默认路径
- 指导用户只在自己的本地环境变量、secret store 或部署配置里保存 token
- 不要让用户把 token 写回 repo
- 不要在聊天、截图、文档或 GitHub issue 里贴完整 token

## 步骤 4：用 `getConfluenceSpaces` 做最小自检

这是默认第一条探测命令。

成功标准：

- 能返回至少一个 space

如果这里失败，按下面分类：

### A. 连工具都调用不了

判断：

- MCP 没连通
- 客户端没加载 `.mcp.json`
- 客户端本身不支持 remote HTTP MCP

下一步：

- 回到“步骤 2：确认 MCP 是否可见”

### B. 工具能调，但要求登录 / 未授权

判断：

- OAuth 没完成
- token 无效

下一步：

- 回到“步骤 3：优先走 OAuth”

### C. 工具能调，但看不到预期站点或空间

判断：

- 用户 Atlassian 账号本身没权限
- Confluence 产品访问未开通
- site / app scope 没放行
- 目标 space 没授权

下一步：

- 先区分是“完全看不到任何 space”，还是“只能看到部分 space”
- 再读 `admin-checklist.md`
- 把最小请求整理给管理员或 space owner

## 用户该怎么向管理员提需求

如果确定需要管理员动作，替用户整理成下面这种明确请求：

1. 请确认我的 Atlassian 账号有目标 Confluence site 的访问权限
2. 请确认我的账号已经开通 Confluence 产品访问
3. 请确认当前组织允许使用 Atlassian Rovo MCP
4. 请确认相关 Confluence / Rovo scopes 已放行
5. 如果公司统一要求 token、allowlist 或特殊白名单，请告诉我应该走哪条标准路径

## 什么时候才算安装完成

只有在以下条件同时满足时，才算真正完成：

1. skill 已加载
2. MCP 可见
3. 认证完成
4. `getConfluenceSpaces` 成功

在此之前，不要对用户说“已经装好了”。
