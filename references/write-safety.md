# Write Safety

Use this guide before creating or updating any company Confluence page.

## Pre-write gates

Do not write unless all of these are true:

- the destination is clear enough to identify a target space or page
- the requested change can be summarized in one sentence
- the page body format expected by the backend is known
- you have read the latest source page when updating an existing page

If any gate fails, draft the content in chat and ask for the missing detail only if needed.

## Create flow

For new pages:

1. confirm or infer the target space
2. confirm or infer the parent page if hierarchy matters
3. propose the title
4. draft the initial body
5. create the page only after the target looks unambiguous

Prefer creating a child page or draft-like page over overwriting a canonical page when the request is exploratory.

## Update flow

For existing pages:

1. fetch the latest page body and metadata
2. identify the narrowest possible edit
3. preserve content that the user did not ask to change
4. send the update using the backend's latest-state or version mechanism

If the backend exposes page versions, use the newest version available immediately before the write.

## Conflict handling

If an update fails because the page changed:

1. refetch the latest page
2. compare the new content with the intended edit
3. retry once only if the change can still be applied safely

If the page diverged materially, stop and explain that a human review is safer.

## Safe defaults

Default to these behaviors:

- narrow edits over full rewrites
- create over overwrite when the destination is unclear
- draft in chat over direct publish when the write is high-risk
- preserve unknown macros, embeds, and structured blocks when possible

## Do not do these without explicit user intent

- delete or archive pages
- move pages
- change permissions
- rewrite many pages in one batch
- replace entire pages when only one section needs to change
