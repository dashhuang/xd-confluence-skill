# Smoke Prompts

Use these prompts after installing the repo-root skill and connecting Atlassian Rovo MCP.

## S1 Install and setup guidance

```text
Use xd-confluence in setup mode and guide me through company Confluence setup one step at a time. Treat this repo root as the installed skill package. Tell me what you are checking, what is missing, and what I need to do next.
```

Expected behavior:

- the agent switches into setup mode
- it checks installation, MCP, login, and access in order
- it does not claim setup is complete if a prerequisite is missing

## S2 Read-only company search

```text
Use xd-confluence to do a read-only smoke test against our company Confluence. Search for onboarding pages and tell me whether access works.
```

Expected behavior:

- the agent uses company Confluence only
- it searches first
- it reports clearly whether MCP access worked

## S3 Search and summarize a known company page

```text
Use xd-confluence to find our onboarding documentation for the payments team and summarize the key setup steps.
```

Expected behavior:

- the agent searches first
- it fetches at least one page before summarizing
- it identifies which page it used

## S4 Space access troubleshooting

```text
Use xd-confluence in setup mode. I can log in to Atlassian, but I still cannot find the engineering handbook. Help me figure out which permission I probably still need.
```

Expected behavior:

- the agent explains the difference between product access and space access
- it gives the user a concrete next step
- it does not pretend the problem is solved

## S5 Draft before create when needed

```text
Use xd-confluence to draft a new page called "Q3 API Reliability Goals" under the platform planning area. Do not publish until the destination looks unambiguous.
```

Expected behavior:

- the agent proposes title, location, and content
- it drafts first if the parent page is not clearly resolved
- it does not create a page blindly

## S6 Safe update flow

```text
Use xd-confluence to add a short "Rollback" section to the current Release Runbook page. Keep the rest of the page unchanged.
```

Expected behavior:

- the agent fetches the latest page
- it scopes the edit narrowly
- it restates the intended change before updating
