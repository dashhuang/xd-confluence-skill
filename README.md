# XD Confluence Skill V2

这是一个面向心动内部的 Confluence skill 发布仓库。

现在这个仓库本身就是 installable skill repo。也就是说，对支持 GitHub skill 安装的 agent，**repo 根目录 URL 就应该是安装入口**。

默认能力路径：

- skill
- Atlassian 官方 Rovo MCP
- OAuth

可选高级增强层：

- OpenClaw extension
- Confluence REST API
- 本地 mirror / cache / section 级写入

## 这是什么

这是一个 **skill-first** 的内部工具包，不是一个以 plugin 为核心的仓库。

默认给同事交付的是：

- 一个可安装的 skill
- 一套安装与权限排查引导
- 一套可复制给 agent 的安装提示

只有 OpenClaw 高级用户，才需要进入 `extras/openclaw-extension/` 这条增强路径。

## 仓库结构

```text
.
├── SKILL.md
├── .mcp.json
├── agents/
├── references/
├── AGENTS.md
├── INSTALL_WITH_AGENT.md
├── adapters/
├── extras/
│   └── openclaw-extension/
├── scripts/
└── tests/
```

## 默认工作方式

同事的理想使用流程是：

1. 把这个 GitHub 仓库 URL 交给自己的 agent
2. agent 将 repo 根目录安装为 `xd-confluence`
3. agent 读取 `AGENTS.md` 和 `references/install-and-permissions.md`
4. agent 一步一步带同事完成：
   - skill 安装
   - Rovo MCP 接入
   - Atlassian OAuth 登录
   - Confluence 访问权限确认
   - 首次只读 smoke test
5. 在读路径通过前，不进入正式写路径

## 快速分发

### 给 agent 的最直接说法

把仓库 URL 给 agent，再配合 [INSTALL_WITH_AGENT.md](./INSTALL_WITH_AGENT.md) 里的提示词使用。

最通用的一句是：

```text
Open <repo-url>. Install this repository root as the xd-confluence skill, then guide me step by step through company Confluence setup. Use AGENTS.md and references/install-and-permissions.md.
```

### 本地手工安装

```bash
./scripts/install-skill.sh --target-dir "${CODEX_HOME:-$HOME/.codex}/skills"
./scripts/install-skill.sh --target-dir "$HOME/.claude/skills"
./scripts/install-skill.sh --target-dir "$HOME/.agents/skills"
```

本机可直接跑：

```bash
./scripts/setup-local-clients.sh
```

## MCP 入口

repo 根目录自带项目级 [.mcp.json](./.mcp.json)，指向：

- `https://mcp.atlassian.com/v1/mcp`

默认建议：

- 先走 OAuth
- 不要把 token 写进 repo
- 如果公司后续统一要求 API token，只在用户本地 override 配置里加 header

## 关键文档

- [SKILL.md](./SKILL.md)
  真正给 agent 使用的核心 skill
- [references/install-and-permissions.md](./references/install-and-permissions.md)
  安装、开通、OAuth、自检与权限排查主流程
- [references/admin-checklist.md](./references/admin-checklist.md)
  需要管理员介入时给 agent 的最小检查模板
- [AGENTS.md](./AGENTS.md)
  给外部 agent 的 repo 安装说明
- [INSTALL_WITH_AGENT.md](./INSTALL_WITH_AGENT.md)
  直接复制给同事的安装提示
- [extras/openclaw-extension/README.md](./extras/openclaw-extension/README.md)
  OpenClaw 可选高级增强层说明

## 当前质量标准

V2 的目标不是“能搜到页面”就算完成，而是要满足：

1. 仓库根目录可以作为 skill 分发入口
2. agent 能一步一步完成安装与开通
3. 能清楚区分：
   - MCP 未接入
   - OAuth 未完成
   - 无 Confluence 产品权限
   - 无目标 space 权限
4. 默认读路径真实可验证
5. 写路径默认保守，不直接改正式页面

## 验证方式

结构校验：

```bash
./scripts/validate-mvp.sh
```

手工 smoke test：

- [tests/smoke/prompts.md](./tests/smoke/prompts.md)
- [tests/smoke/checklist.md](./tests/smoke/checklist.md)

## 发布前检查

发布到 GitHub 前建议确认：

1. repo URL 已替换 README 里的占位符
2. 安装提示词里的 `<repo-url>` 已有真实示例
3. 公司管理员或 IT 联系方式是否要补进 `admin-checklist.md`
4. 至少完成一次真实只读 smoke test
5. 如果要开放写路径测试，先准备专用测试页或测试 space
