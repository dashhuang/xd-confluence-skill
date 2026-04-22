# Search Playbook

Use this guide when the user does not provide a stable page id or URL.

## Search goals

Try to identify:

- the most likely company page
- the most relevant company space
- whether the page is likely canonical, stale, or duplicated

## Query strategy

Start with the narrowest query that preserves user intent:

- exact page title when the title is likely known
- title plus team, product, or project name
- title plus space key when available
- topic plus words like `runbook`, `design`, `spec`, `policy`, or `faq` when the title is unknown

If the first search returns many similar pages:

- add the owning team or system name
- add the likely space key
- prefer the page whose title best matches the user wording

## Candidate ranking

Prefer results in this order:

1. exact title match in the expected space
2. exact title match in a plausible nearby space
3. obvious canonical page with children or strong hierarchy context
4. recently updated page that matches the user topic
5. loose topical matches

## Required follow-up

After choosing a candidate:

- fetch the page body
- verify the title and page context
- only then summarize or quote it

Never answer from metadata alone.

## Ambiguity handling

If two or more pages are plausible:

- summarize the top candidates briefly
- explain the difference in space or purpose
- ask for confirmation only if the wrong choice would materially change the answer or a write target

If the user asked for a write and the target remains ambiguous, stop at a draft and do not mutate Confluence.
