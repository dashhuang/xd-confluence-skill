# OpenClaw Extension

这是 `xd-confluence` 的可选高级增强层，只给 OpenClaw 用。

默认团队安装路径仍然是：

- skill + Atlassian Rovo MCP

也就是说，普通同事不需要先理解这个 extension。即使使用 OpenClaw，也优先尝试 Rovo MCP + OAuth。

这个 extension 不是默认接入路径。它是 fallback / advanced path：

- 当前 OpenClaw runtime 确认无法使用 remote HTTP MCP
- 运行环境确实无法完成 OAuth
- 用户明确需要本地 mirror / cache
- 用户明确需要 section 级写入增强

## 这个增强层提供什么

- list spaces
- sync Confluence space 到本地 workspace mirror
- browse synced tree like local directories
- search pages with CQL
- read pages and cache markdown locally
- create pages
- update pages
- append or replace sections in existing pages

## 什么时候才建议启用

只有在下面场景才建议：

- 你明确在用 OpenClaw
- Rovo MCP + OAuth 当前不可用，或你确实需要 REST API 能力
- 你需要本地 mirror / cache
- 你需要 section 级写入增强
- 你接受这条路径走 Confluence REST + API token，而不是默认的 Rovo MCP/OAuth

## 配置方式

配置来自 `openclaw.plugin.json` 定义的字段或环境变量：

- `baseUrl`
- `email`
- `apiToken`
- `defaultSpaceKey`
- `cacheDir`

API token 比 OAuth 更敏感。只放在用户本地环境变量、secret store 或部署配置里，不要写进 repo、聊天记录、截图或公开文档。

## 重要区别

- 默认 skill 路径走：Atlassian Rovo MCP
- 这个 extension 走：Confluence REST API

所以它是增强层，不是默认入口。

如果你只是想让同事“能装、能查、能被一步一步带着开通”，请优先用 repo 根目录的 skill，不要先上这个 extension。
