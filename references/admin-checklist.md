# Admin Checklist

这份文档给 agent 在需要管理员配合时引用。

## 管理员侧需要确认的事

1. 用户 Atlassian 账号已能访问目标 Confluence site
2. 用户 Atlassian 账号已开通 Confluence 产品访问
3. 目标 Confluence space 已给用户或用户所在组授权
4. 组织允许使用 Atlassian Rovo MCP
5. 所需的 Confluence / Rovo scopes 已放行
6. 如果组织有限制，还要确认：
   - 域名 allowlist
   - IP allowlist
   - 指定认证方式（OAuth / API token）
   - 是否需要额外的 app approval

## 给管理员的最小请求模板

如果普通同事需要向管理员转发请求，agent 应该帮他整理成类似下面这段：

```text
我正在接一个基于 Atlassian Rovo MCP 的内部 Confluence skill。
请帮我确认：
1. 我的 Atlassian 账号是否已开通 Confluence 产品访问
2. 我的账号是否有目标 Confluence site / space 的访问权限
3. 当前组织是否已允许使用 Atlassian Rovo MCP
4. 所需的 Confluence / Rovo scopes 是否已经放行
5. 如果公司有统一认证或白名单要求，请告诉我应该走 OAuth 还是 API token，以及是否还有额外限制
```

## 管理员不在场时，agent 不要做的事

- 不要凭猜测告诉用户“公司这边已经开好了”
- 不要把“看不到 space”直接归因成用户自己没装好
- 不要把管理员动作和用户本地动作混在一起
- 不要把“产品权限没开”误说成“只是 OAuth 没登”
