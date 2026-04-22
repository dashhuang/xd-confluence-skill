# Content Format

Confluence page bodies may arrive in different representations depending on the backend.

Common cases:

- rendered rich text
- storage format
- Atlassian document format
- normalized markdown returned by an MCP helper

## Reading guidance

When reading a page:

- extract semantic structure first
- preserve heading hierarchy
- preserve bullet and numbered lists
- preserve tables when they carry key facts
- note macros, embeds, or unsupported blocks instead of hallucinating their contents

If the body is noisy markup, reduce it to a clean semantic outline before summarizing.

## Writing guidance

When preparing content for creation or update:

- prefer plain, structured prose
- use short headings and stable section names
- use bullet lists for action items and decisions
- use tables only when the source material is truly tabular

Avoid introducing markup that the current backend cannot safely round-trip.

## Preservation rules

When updating an existing page:

- preserve untouched sections
- preserve unknown macros and embeds when possible
- avoid converting the entire page to a different format unless the backend requires it

If the backend already abstracts the page format for you, follow the MCP tool contract rather than forcing raw storage markup.
