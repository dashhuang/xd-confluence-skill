import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { marked } from "marked";
import TurndownService from "turndown";
import { Static, Type } from "@sinclair/typebox";
import type {
  AnyAgentTool,
  OpenClawPluginApi,
  OpenClawPluginToolContext,
} from "openclaw/plugin-sdk";

type ConfluencePluginConfig = {
  baseUrl?: string;
  email?: string;
  apiToken?: string;
  defaultSpaceKey?: string;
  cacheDir?: string;
};

type ResolvedPluginConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  defaultSpaceKey?: string;
  cacheRoot: string;
};

type SpaceSummary = {
  id: string;
  key: string;
  name: string;
  type?: string;
  status?: string;
  homepageId?: string;
};

type PageSummary = {
  id: string;
  title: string;
  status?: string;
  spaceId?: string;
  spaceKey?: string;
  parentId?: string;
  parentType?: string;
  position?: number;
  authorId?: string;
  createdAt?: string;
  version?: {
    number?: number;
    message?: string;
    createdAt?: string;
    authorId?: string;
  };
  webui?: string;
};

type PageDetail = PageSummary & {
  bodyStorage: string;
  markdown: string;
};

type MirrorIndexV1 = {
  version: 1;
  generatedAt: string;
  spaces: Record<
    string,
    {
      spaceId: string;
      name: string;
      rootDir: string;
      pageCount: number;
    }
  >;
  pages: Record<
    string,
    {
      spaceKey: string;
      title: string;
      relDir: string;
      parentId?: string;
      localMarkdownPath?: string;
      localStoragePath?: string;
    }
  >;
};

const MIRROR_INDEX_VERSION = 1;
const DEFAULT_CACHE_DIR = "confluence";
const DEFAULT_SYNC_PAGE_LIMIT = 400;
const MAX_SYNC_PAGE_LIMIT = 2000;
const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_SPACE_LIMIT = 50;
const PAGE_FETCH_CONCURRENCY = 4;

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

turndown.remove(["style", "script"]);

const SpacesToolSchema = Type.Object(
  {
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 200 })),
  },
  { additionalProperties: false },
);

const SyncSpaceToolSchema = Type.Object(
  {
    spaceKey: Type.String({ minLength: 1 }),
    includeBodies: Type.Optional(Type.Boolean()),
    maxPages: Type.Optional(Type.Number({ minimum: 1, maximum: MAX_SYNC_PAGE_LIMIT })),
  },
  { additionalProperties: false },
);

const LsToolSchema = Type.Object(
  {
    spaceKey: Type.String({ minLength: 1 }),
    pageId: Type.Optional(Type.String({ minLength: 1 })),
    autoSync: Type.Optional(Type.Boolean()),
    maxPages: Type.Optional(Type.Number({ minimum: 1, maximum: MAX_SYNC_PAGE_LIMIT })),
  },
  { additionalProperties: false },
);

const SearchToolSchema = Type.Object(
  {
    query: Type.String({ minLength: 1 }),
    spaceKey: Type.Optional(Type.String({ minLength: 1 })),
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
  },
  { additionalProperties: false },
);

const ReadPageToolSchema = Type.Object(
  {
    pageId: Type.Optional(Type.String({ minLength: 1 })),
    title: Type.Optional(Type.String({ minLength: 1 })),
    spaceKey: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

const CreatePageToolSchema = Type.Object(
  {
    title: Type.String({ minLength: 1 }),
    markdown: Type.String({ minLength: 1 }),
    spaceKey: Type.Optional(Type.String({ minLength: 1 })),
    parentPageId: Type.Optional(Type.String({ minLength: 1 })),
    parentTitle: Type.Optional(Type.String({ minLength: 1 })),
    versionMessage: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const WritePageToolSchema = Type.Object(
  {
    pageId: Type.String({ minLength: 1 }),
    mode: Type.Optional(
      Type.Union([
        Type.Literal("replace"),
        Type.Literal("append"),
        Type.Literal("replace_section"),
        Type.Literal("append_section"),
      ]),
    ),
    markdown: Type.String({ minLength: 1 }),
    title: Type.Optional(Type.String({ minLength: 1 })),
    sectionHeading: Type.Optional(Type.String({ minLength: 1 })),
    versionMessage: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

type SpacesToolParams = Static<typeof SpacesToolSchema>;
type SyncSpaceToolParams = Static<typeof SyncSpaceToolSchema>;
type LsToolParams = Static<typeof LsToolSchema>;
type SearchToolParams = Static<typeof SearchToolSchema>;
type ReadPageToolParams = Static<typeof ReadPageToolSchema>;
type CreatePageToolParams = Static<typeof CreatePageToolSchema>;
type WritePageToolParams = Static<typeof WritePageToolSchema>;

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

function parsePluginConfig(input: unknown): ConfluencePluginConfig {
  if (!input || typeof input !== "object") {
    return {};
  }
  const value = input as Record<string, unknown>;
  const out: ConfluencePluginConfig = {};
  for (const key of ["baseUrl", "email", "apiToken", "defaultSpaceKey", "cacheDir"] as const) {
    const raw = value[key];
    if (typeof raw === "string" && raw.trim()) {
      out[key] = raw.trim();
    }
  }
  return out;
}

function normalizeSecretLikeString(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const value = raw.trim();
  if (!value) {
    return undefined;
  }
  if (value.startsWith("${") && value.endsWith("}")) {
    return undefined;
  }
  return value;
}

function normalizeBaseUrl(raw: string | undefined): string | undefined {
  const value = normalizeSecretLikeString(raw);
  if (!value) {
    return undefined;
  }
  try {
    const parsed = new URL(value);
    return `${parsed.origin}/wiki`;
  } catch {
    return undefined;
  }
}

function resolveCacheRoot(workspaceDir: string, cacheDir?: string): string {
  const raw = normalizeSecretLikeString(cacheDir) ?? DEFAULT_CACHE_DIR;
  return path.isAbsolute(raw) ? raw : path.join(workspaceDir, raw);
}

function resolveRuntimeConfig(
  api: OpenClawPluginApi,
  workspaceDir: string,
): ResolvedPluginConfig | { error: string } {
  const cfg = parsePluginConfig(api.pluginConfig);
  const baseUrl = normalizeBaseUrl(cfg.baseUrl ?? process.env.CONFLUENCE_BASE_URL);
  const email = normalizeSecretLikeString(cfg.email ?? process.env.CONFLUENCE_EMAIL);
  const apiToken = normalizeSecretLikeString(cfg.apiToken ?? process.env.CONFLUENCE_API_TOKEN);
  const defaultSpaceKey = normalizeSecretLikeString(
    cfg.defaultSpaceKey ?? process.env.CONFLUENCE_DEFAULT_SPACE_KEY,
  );

  if (!baseUrl) {
    return {
      error:
        "Confluence is not configured. Set plugins.entries.confluence.config.baseUrl or CONFLUENCE_BASE_URL.",
    };
  }
  if (!email || !apiToken) {
    return {
      error:
        "Missing Confluence credentials. Set CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN, or put email/apiToken in plugins.entries.confluence.config.",
    };
  }

  return {
    baseUrl,
    email,
    apiToken,
    defaultSpaceKey: defaultSpaceKey || undefined,
    cacheRoot: resolveCacheRoot(workspaceDir, cfg.cacheDir ?? process.env.CONFLUENCE_CACHE_DIR),
  };
}

function basicAuthHeader(email: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
}

function isAbsoluteUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

function buildConfluenceUrl(baseUrl: string, apiPath: string): string {
  if (isAbsoluteUrl(apiPath)) {
    return apiPath;
  }
  if (apiPath.startsWith("/wiki/")) {
    return `${new URL(baseUrl).origin}${apiPath}`;
  }
  if (apiPath.startsWith("/")) {
    return `${baseUrl}${apiPath}`;
  }
  return `${baseUrl}/${apiPath}`;
}

function buildWebUrl(baseUrl: string, webui?: string): string | undefined {
  const value = normalizeSecretLikeString(webui);
  if (!value) {
    return undefined;
  }
  return buildConfluenceUrl(baseUrl, value.startsWith("/") ? value : `/${value}`);
}

async function requestJson<T>(
  cfg: ResolvedPluginConfig,
  apiPath: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set("Accept", "application/json");
  headers.set("Authorization", basicAuthHeader(cfg.email, cfg.apiToken));
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildConfluenceUrl(cfg.baseUrl, apiPath), {
    ...init,
    headers,
  });
  const rawText = await response.text();
  let parsed: unknown = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = rawText;
  }

  if (!response.ok) {
    const errorMessage =
      (parsed &&
        typeof parsed === "object" &&
        "message" in parsed &&
        typeof (parsed as Record<string, unknown>).message === "string" &&
        (parsed as Record<string, string>).message) ||
      (typeof parsed === "string" && parsed) ||
      `${response.status} ${response.statusText}`;
    throw new Error(`Confluence API error: ${response.status} ${errorMessage}`);
  }

  return parsed as T;
}

function readNextLink(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const links = (data as Record<string, unknown>)._links;
  if (!links || typeof links !== "object") {
    return undefined;
  }
  const next = (links as Record<string, unknown>).next;
  return typeof next === "string" && next ? next : undefined;
}

async function fetchPagedResults<T>(
  cfg: ResolvedPluginConfig,
  initialPath: string,
  maxItems: number,
): Promise<T[]> {
  const results: T[] = [];
  let nextPath: string | undefined = initialPath;

  while (nextPath && results.length < maxItems) {
    const data = await requestJson<Record<string, unknown>>(cfg, nextPath);
    const chunk = Array.isArray(data.results)
      ? (data.results as T[])
      : Array.isArray(data.items)
        ? (data.items as T[])
        : [];
    for (const item of chunk) {
      results.push(item);
      if (results.length >= maxItems) {
        break;
      }
    }
    nextPath = readNextLink(data);
  }

  return results;
}

function escapeCqlLiteral(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function slugify(input: string): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "untitled";
}

function pageDirSegment(title: string, pageId: string): string {
  return `${slugify(title)}--${pageId}`;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function writeTextFile(filePath: string, data: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, data, "utf8");
}

async function loadMirrorIndex(cacheRoot: string): Promise<MirrorIndexV1> {
  const indexPath = path.join(cacheRoot, ".index.json");
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as MirrorIndexV1;
    if (parsed.version === MIRROR_INDEX_VERSION && parsed.spaces && parsed.pages) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return {
    version: MIRROR_INDEX_VERSION,
    generatedAt: new Date(0).toISOString(),
    spaces: {},
    pages: {},
  };
}

async function saveMirrorIndex(cacheRoot: string, index: MirrorIndexV1): Promise<void> {
  const next: MirrorIndexV1 = {
    ...index,
    version: MIRROR_INDEX_VERSION,
    generatedAt: new Date().toISOString(),
  };
  await writeJsonFile(path.join(cacheRoot, ".index.json"), next);
}

function normalizeSpaceSummary(raw: Record<string, unknown>): SpaceSummary {
  return {
    id: String(raw.id ?? ""),
    key: String(raw.key ?? ""),
    name: String(raw.name ?? raw.key ?? raw.id ?? ""),
    type: typeof raw.type === "string" ? raw.type : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    homepageId: typeof raw.homepageId === "string" ? raw.homepageId : undefined,
  };
}

function extractWebui(raw: Record<string, unknown>): string | undefined {
  const links = raw._links;
  if (!links || typeof links !== "object") {
    return undefined;
  }
  const webui = (links as Record<string, unknown>).webui;
  return typeof webui === "string" ? webui : undefined;
}

function normalizePageSummary(raw: Record<string, unknown>, spaceKey?: string): PageSummary {
  const versionRaw = raw.version;
  const version =
    versionRaw && typeof versionRaw === "object"
      ? {
          number:
            typeof (versionRaw as Record<string, unknown>).number === "number"
              ? ((versionRaw as Record<string, unknown>).number as number)
              : undefined,
          message:
            typeof (versionRaw as Record<string, unknown>).message === "string"
              ? ((versionRaw as Record<string, unknown>).message as string)
              : undefined,
          createdAt:
            typeof (versionRaw as Record<string, unknown>).createdAt === "string"
              ? ((versionRaw as Record<string, unknown>).createdAt as string)
              : undefined,
          authorId:
            typeof (versionRaw as Record<string, unknown>).authorId === "string"
              ? ((versionRaw as Record<string, unknown>).authorId as string)
              : undefined,
        }
      : undefined;

  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? raw.id ?? ""),
    status: typeof raw.status === "string" ? raw.status : undefined,
    spaceId: raw.spaceId != null ? String(raw.spaceId) : undefined,
    spaceKey,
    parentId: raw.parentId != null ? String(raw.parentId) : undefined,
    parentType: typeof raw.parentType === "string" ? raw.parentType : undefined,
    position: typeof raw.position === "number" ? raw.position : undefined,
    authorId: typeof raw.authorId === "string" ? raw.authorId : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    version,
    webui: extractWebui(raw),
  };
}

function readBodyStorage(raw: Record<string, unknown>): string {
  const body = raw.body;
  if (!body || typeof body !== "object") {
    return "";
  }
  const storage = (body as Record<string, unknown>).storage;
  if (!storage || typeof storage !== "object") {
    return "";
  }
  const value = (storage as Record<string, unknown>).value;
  return typeof value === "string" ? value : "";
}

function storageToMarkdown(storage: string): string {
  if (!storage.trim()) {
    return "";
  }
  const normalized = storage
    .replace(/<ac:structured-macro[\s\S]*?<\/ac:structured-macro>/g, "\n\n[Confluence macro omitted]\n\n")
    .replace(/<ac:task-list>/g, "<ul>")
    .replace(/<\/ac:task-list>/g, "</ul>")
    .replace(/<ac:task>/g, "<li>")
    .replace(/<\/ac:task>/g, "</li>")
    .replace(/<ri:[^>]+\/>/g, "");
  return turndown.turndown(normalized).trim();
}

function markdownToStorage(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  return html.trim() || "<p></p>";
}

function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined || value === null || value === "") {
    throw new Error(message);
  }
  return value;
}

async function listSpaces(cfg: ResolvedPluginConfig, limit: number): Promise<SpaceSummary[]> {
  const items = await fetchPagedResults<Record<string, unknown>>(
    cfg,
    `/api/v2/spaces?limit=${Math.min(limit, 250)}`,
    limit,
  );
  return items.map((item) => normalizeSpaceSummary(item));
}

async function resolveSpaceByKey(cfg: ResolvedPluginConfig, spaceKey: string): Promise<SpaceSummary> {
  const items = await fetchPagedResults<Record<string, unknown>>(
    cfg,
    `/api/v2/spaces?keys=${encodeURIComponent(spaceKey)}&limit=10`,
    10,
  );
  const match = items
    .map((item) => normalizeSpaceSummary(item))
    .find((item) => item.key.toLowerCase() === spaceKey.toLowerCase());
  if (!match) {
    throw new Error(`Confluence space not found: ${spaceKey}`);
  }
  return match;
}

async function listPagesInSpace(
  cfg: ResolvedPluginConfig,
  space: SpaceSummary,
  maxPages: number,
): Promise<PageSummary[]> {
  const items = await fetchPagedResults<Record<string, unknown>>(
    cfg,
    `/api/v2/spaces/${space.id}/pages?limit=250`,
    maxPages,
  );
  return items.map((item) => normalizePageSummary(item, space.key));
}

async function resolvePageByTitle(
  cfg: ResolvedPluginConfig,
  space: SpaceSummary,
  title: string,
): Promise<PageSummary> {
  const items = await fetchPagedResults<Record<string, unknown>>(
    cfg,
    `/api/v2/pages?space-id=${encodeURIComponent(space.id)}&title=${encodeURIComponent(title)}&limit=25`,
    25,
  );
  const match = items
    .map((item) => normalizePageSummary(item, space.key))
    .find((item) => item.title.trim().toLowerCase() === title.trim().toLowerCase());
  if (!match) {
    throw new Error(`Confluence page not found by title in ${space.key}: ${title}`);
  }
  return match;
}

async function getPageById(
  cfg: ResolvedPluginConfig,
  pageId: string,
  spaceKey?: string,
): Promise<PageDetail> {
  const raw = await requestJson<Record<string, unknown>>(
    cfg,
    `/api/v2/pages/${encodeURIComponent(pageId)}?body-format=storage`,
  );
  const summary = normalizePageSummary(raw, spaceKey);
  const bodyStorage = readBodyStorage(raw);
  return {
    ...summary,
    bodyStorage,
    markdown: storageToMarkdown(bodyStorage),
  };
}

async function searchPages(
  cfg: ResolvedPluginConfig,
  query: string,
  spaceKey: string | undefined,
  limit: number,
): Promise<
  Array<{
    id: string;
    title: string;
    type?: string;
    spaceKey?: string;
    excerpt?: string;
    webUrl?: string;
  }>
> {
  const cql = [
    `type = page`,
    spaceKey ? `space = "${escapeCqlLiteral(spaceKey)}"` : "",
    `text ~ "${escapeCqlLiteral(query)}"`,
  ]
    .filter(Boolean)
    .join(" AND ");

  const raw = await requestJson<Record<string, unknown>>(
    cfg,
    `/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=${Math.min(limit, 50)}`,
  );
  const results = Array.isArray(raw.results) ? raw.results : [];
  return results.map((item) => {
    const record = (item ?? {}) as Record<string, unknown>;
    const links = record._links;
    const space = record.space;
    return {
      id: String(record.id ?? ""),
      title: String(record.title ?? record.id ?? ""),
      type: typeof record.type === "string" ? record.type : undefined,
      spaceKey:
        space && typeof space === "object" && typeof (space as Record<string, unknown>).key === "string"
          ? ((space as Record<string, unknown>).key as string)
          : undefined,
      excerpt:
        typeof record.excerpt === "string"
          ? record.excerpt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
          : undefined,
      webUrl:
        links && typeof links === "object" && typeof (links as Record<string, unknown>).webui === "string"
          ? buildWebUrl(cfg.baseUrl, (links as Record<string, unknown>).webui as string)
          : undefined,
    };
  });
}

function stripTrailingSlash(input: string): string {
  return input.replace(/\/+$/, "");
}

function mirrorIndexSpaceRoot(spaceKey: string): string {
  return spaceKey.toUpperCase();
}

async function writeSpaceReadme(
  spaceDir: string,
  space: SpaceSummary,
  pageCount: number,
  includeBodies: boolean,
): Promise<void> {
  const content = [
    `# Confluence Mirror: ${space.key}`,
    ``,
    `- Space: ${space.name}`,
    `- Space Key: ${space.key}`,
    `- Space ID: ${space.id}`,
    `- Pages synced: ${pageCount}`,
    `- Bodies synced: ${includeBodies ? "yes" : "metadata only"}`,
    ``,
    `This tree is generated by the OpenClaw Confluence plugin.`,
    `Each page directory contains \`_meta.json\` and, when fetched, \`page.md\` plus \`page.storage.xhtml\`.`,
  ].join("\n");
  await writeTextFile(path.join(spaceDir, "README.md"), `${content}\n`);
}

function removeSpaceEntriesFromIndex(index: MirrorIndexV1, spaceKey: string): void {
  delete index.spaces[spaceKey];
  for (const [pageId, page] of Object.entries(index.pages)) {
    if (page.spaceKey === spaceKey) {
      delete index.pages[pageId];
    }
  }
}

function computePageRelDir(
  spaceKey: string,
  pagesById: Map<string, PageSummary>,
  pageId: string,
  memo: Map<string, string>,
  stack: Set<string>,
): string {
  const cached = memo.get(pageId);
  if (cached) {
    return cached;
  }
  const page = pagesById.get(pageId);
  if (!page) {
    const fallback = path.join(mirrorIndexSpaceRoot(spaceKey), pageId);
    memo.set(pageId, fallback);
    return fallback;
  }
  if (stack.has(pageId)) {
    const cyclePath = path.join(mirrorIndexSpaceRoot(spaceKey), pageDirSegment(page.title, page.id));
    memo.set(pageId, cyclePath);
    return cyclePath;
  }
  stack.add(pageId);
  const segment = pageDirSegment(page.title, page.id);
  let relDir = path.join(mirrorIndexSpaceRoot(spaceKey), segment);
  if (page.parentId && pagesById.has(page.parentId)) {
    relDir = path.join(computePageRelDir(spaceKey, pagesById, page.parentId, memo, stack), segment);
  }
  stack.delete(pageId);
  memo.set(pageId, relDir);
  return relDir;
}

async function mapLimit<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runOne() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index] as T, index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => runOne()),
  );
  return results;
}

async function syncSpaceMirror(params: {
  cfg: ResolvedPluginConfig;
  workspaceDir: string;
  space: SpaceSummary;
  maxPages: number;
  includeBodies: boolean;
}): Promise<{
  spaceDir: string;
  pageCount: number;
  truncated: boolean;
}> {
  const { cfg, workspaceDir, space, maxPages, includeBodies } = params;
  const pages = await listPagesInSpace(cfg, space, maxPages);
  const truncated = pages.length >= maxPages;
  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const relDirMemo = new Map<string, string>();
  const cacheRoot = cfg.cacheRoot;
  const spaceDir = path.join(cacheRoot, mirrorIndexSpaceRoot(space.key));

  await fs.rm(spaceDir, { recursive: true, force: true });
  await ensureDir(spaceDir);
  await writeSpaceReadme(spaceDir, space, pages.length, includeBodies);

  const index = await loadMirrorIndex(cacheRoot);
  removeSpaceEntriesFromIndex(index, space.key);
  index.spaces[space.key] = {
    spaceId: space.id,
    name: space.name,
    rootDir: mirrorIndexSpaceRoot(space.key),
    pageCount: pages.length,
  };

  const detailsById = includeBodies
    ? new Map(
        (
          await mapLimit(pages, PAGE_FETCH_CONCURRENCY, async (page) => {
            const detail = await getPageById(cfg, page.id, space.key);
            return [page.id, detail] as const;
          })
        ).map(([pageId, detail]) => [pageId, detail]),
      )
    : new Map<string, PageDetail>();

  for (const page of pages) {
    const relDir = computePageRelDir(space.key, pagesById, page.id, relDirMemo, new Set<string>());
    const absDir = path.join(cacheRoot, relDir);
    const detail = detailsById.get(page.id);
    const meta = {
      id: page.id,
      title: page.title,
      status: page.status,
      spaceKey: space.key,
      spaceId: page.spaceId,
      parentId: page.parentId,
      version: page.version,
      webUrl: buildWebUrl(cfg.baseUrl, page.webui),
      localDir: absDir,
    };
    await writeJsonFile(path.join(absDir, "_meta.json"), meta);
    if (detail) {
      await writeTextFile(path.join(absDir, "page.md"), `${detail.markdown}\n`);
      await writeTextFile(path.join(absDir, "page.storage.xhtml"), `${detail.bodyStorage}\n`);
    }
    index.pages[page.id] = {
      spaceKey: space.key,
      title: page.title,
      relDir,
      parentId: page.parentId,
      localMarkdownPath: detail ? path.join(relDir, "page.md") : undefined,
      localStoragePath: detail ? path.join(relDir, "page.storage.xhtml") : undefined,
    };
  }

  await saveMirrorIndex(cacheRoot, index);
  return {
    spaceDir,
    pageCount: pages.length,
    truncated,
  };
}

async function upsertPageMirror(params: {
  cfg: ResolvedPluginConfig;
  page: PageDetail;
  spaceKey: string;
  workspaceDir: string;
}): Promise<{ localDir: string; markdownPath: string; storagePath: string }> {
  const { cfg, page, spaceKey } = params;
  const cacheRoot = cfg.cacheRoot;
  const index = await loadMirrorIndex(cacheRoot);
  const existing = index.pages[page.id];
  let relDir = existing?.relDir;

  if (!relDir) {
    const parent = page.parentId ? index.pages[page.parentId] : undefined;
    relDir = parent
      ? path.join(parent.relDir, pageDirSegment(page.title, page.id))
      : path.join(mirrorIndexSpaceRoot(spaceKey), pageDirSegment(page.title, page.id));
  }

  const localDir = path.join(cacheRoot, relDir);
  const markdownPath = path.join(localDir, "page.md");
  const storagePath = path.join(localDir, "page.storage.xhtml");

  await writeJsonFile(path.join(localDir, "_meta.json"), {
    id: page.id,
    title: page.title,
    status: page.status,
    spaceKey,
    spaceId: page.spaceId,
    parentId: page.parentId,
    version: page.version,
    webUrl: buildWebUrl(cfg.baseUrl, page.webui),
    localDir,
  });
  await writeTextFile(markdownPath, `${page.markdown}\n`);
  await writeTextFile(storagePath, `${page.bodyStorage}\n`);

  index.pages[page.id] = {
    spaceKey,
    title: page.title,
    relDir,
    parentId: page.parentId,
    localMarkdownPath: path.relative(cacheRoot, markdownPath),
    localStoragePath: path.relative(cacheRoot, storagePath),
  };
  if (!index.spaces[spaceKey]) {
    index.spaces[spaceKey] = {
      spaceId: page.spaceId ?? "",
      name: spaceKey,
      rootDir: mirrorIndexSpaceRoot(spaceKey),
      pageCount: 0,
    };
  }
  await saveMirrorIndex(cacheRoot, index);
  return { localDir, markdownPath, storagePath };
}

function replaceMarkdownSection(
  source: string,
  heading: string,
  replacement: string,
): { markdown: string; replaced: boolean } {
  const lines = source.split("\n");
  const normalizedHeading = heading.trim().toLowerCase();
  let startIndex = -1;
  let endIndex = lines.length;
  let headingLevel = 2;

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i]?.match(/^(#{1,6})\s+(.*)$/);
    if (!match) {
      continue;
    }
    const currentHeading = (match[2] ?? "").trim().toLowerCase();
    if (currentHeading === normalizedHeading) {
      startIndex = i;
      headingLevel = (match[1] ?? "##").length;
      for (let j = i + 1; j < lines.length; j += 1) {
        const nextMatch = lines[j]?.match(/^(#{1,6})\s+(.*)$/);
        if (nextMatch && (nextMatch[1] ?? "").length <= headingLevel) {
          endIndex = j;
          break;
        }
      }
      break;
    }
  }

  if (startIndex === -1) {
    return { markdown: source, replaced: false };
  }

  const nextSection = [`${"#".repeat(headingLevel)} ${heading.trim()}`, "", replacement.trim()];
  const merged = [
    ...lines.slice(0, startIndex),
    ...nextSection,
    ...lines.slice(endIndex),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { markdown: `${merged}\n`, replaced: true };
}

async function ensureSpaceForParams(
  cfg: ResolvedPluginConfig,
  requestedSpaceKey?: string,
): Promise<SpaceSummary> {
  const spaceKey = requestedSpaceKey || cfg.defaultSpaceKey;
  if (!spaceKey) {
    throw new Error(
      "No space key provided. Pass spaceKey explicitly or configure defaultSpaceKey / CONFLUENCE_DEFAULT_SPACE_KEY.",
    );
  }
  return await resolveSpaceByKey(cfg, spaceKey);
}

async function autoSyncIfMissing(
  cfg: ResolvedPluginConfig,
  workspaceDir: string,
  spaceKey: string,
  maxPages: number,
): Promise<void> {
  const index = await loadMirrorIndex(cfg.cacheRoot);
  if (index.spaces[spaceKey]) {
    return;
  }
  const space = await resolveSpaceByKey(cfg, spaceKey);
  await syncSpaceMirror({
    cfg,
    workspaceDir,
    space,
    maxPages,
    includeBodies: false,
  });
}

function summarizeChildren(
  index: MirrorIndexV1,
  cacheRoot: string,
  spaceKey: string,
  pageId?: string,
): Array<{
  pageId: string;
  title: string;
  localDir: string;
  localMarkdownPath?: string;
}> {
  const out = Object.entries(index.pages)
    .filter(([, page]) => page.spaceKey === spaceKey && (pageId ? page.parentId === pageId : !page.parentId))
    .sort((a, b) => a[1].title.localeCompare(b[1].title))
    .map(([id, page]) => ({
      pageId: id,
      title: page.title,
      localDir: path.join(cacheRoot, page.relDir),
      localMarkdownPath: page.localMarkdownPath
        ? path.join(cacheRoot, page.localMarkdownPath)
        : undefined,
    }));
  return out;
}

function createConfluenceTools(api: OpenClawPluginApi, ctx: OpenClawPluginToolContext): AnyAgentTool[] | null {
  if (ctx.agentId !== "main" || !ctx.workspaceDir) {
    return null;
  }

  const runtimeCfg = resolveRuntimeConfig(api, ctx.workspaceDir);
  const loadCfg = (): ResolvedPluginConfig => {
    if ("error" in runtimeCfg) {
      throw new Error(runtimeCfg.error);
    }
    return runtimeCfg;
  };

  const tools: AnyAgentTool[] = [
    {
      name: "confluence_spaces",
      label: "Confluence Spaces",
      description:
        "List Confluence spaces visible to the main agent. Useful before syncing or creating pages.",
      parameters: SpacesToolSchema,
      execute: async (_toolCallId, rawParams) => {
        try {
          const cfg = loadCfg();
          const params = rawParams as SpacesToolParams;
          const spaces = await listSpaces(cfg, params.limit ?? DEFAULT_SPACE_LIMIT);
          const index = await loadMirrorIndex(cfg.cacheRoot);
          return jsonResult({
            cacheRoot: cfg.cacheRoot,
            spaces: spaces.map((space) => ({
              ...space,
              localMirrorRoot: index.spaces[space.key]
                ? path.join(cfg.cacheRoot, index.spaces[space.key].rootDir)
                : undefined,
            })),
          });
        } catch (error) {
          return jsonResult({ error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      name: "confluence_sync_space",
      label: "Confluence Sync Space",
      description:
        "Sync a Confluence space into the main workspace as a local mirror. Use this first if you want directory-style browsing with built-in read/ls tools.",
      parameters: SyncSpaceToolSchema,
      execute: async (_toolCallId, rawParams) => {
        try {
          const cfg = loadCfg();
          const params = rawParams as SyncSpaceToolParams;
          const space = await resolveSpaceByKey(cfg, params.spaceKey);
          const result = await syncSpaceMirror({
            cfg,
            workspaceDir: ctx.workspaceDir as string,
            space,
            maxPages: params.maxPages ?? DEFAULT_SYNC_PAGE_LIMIT,
            includeBodies: params.includeBodies ?? false,
          });
          return jsonResult({
            ok: true,
            space,
            pageCount: result.pageCount,
            truncated: result.truncated,
            localMirrorRoot: result.spaceDir,
            note:
              params.includeBodies === true
                ? "Bodies were cached into page.md files."
                : "Metadata-only sync complete. Use confluence_read_page to fetch bodies on demand.",
          });
        } catch (error) {
          return jsonResult({ error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      name: "confluence_ls",
      label: "Confluence LS",
      description:
        "List top-level pages in a synced Confluence space or children of a cached parent page. Auto-syncs metadata when needed.",
      parameters: LsToolSchema,
      execute: async (_toolCallId, rawParams) => {
        try {
          const cfg = loadCfg();
          const params = rawParams as LsToolParams;
          if (params.autoSync ?? true) {
            await autoSyncIfMissing(
              cfg,
              ctx.workspaceDir as string,
              params.spaceKey,
              params.maxPages ?? DEFAULT_SYNC_PAGE_LIMIT,
            );
          }
          const index = await loadMirrorIndex(cfg.cacheRoot);
          if (!index.spaces[params.spaceKey]) {
            throw new Error(
              `No local mirror found for ${params.spaceKey}. Run confluence_sync_space first.`,
            );
          }
          const children = summarizeChildren(index, cfg.cacheRoot, params.spaceKey, params.pageId);
          return jsonResult({
            ok: true,
            spaceKey: params.spaceKey,
            pageId: params.pageId,
            localMirrorRoot: path.join(cfg.cacheRoot, index.spaces[params.spaceKey].rootDir),
            children,
          });
        } catch (error) {
          return jsonResult({ error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      name: "confluence_search",
      label: "Confluence Search",
      description:
        "Search Confluence pages with official CQL text search. Use this when you know the topic but not the page id.",
      parameters: SearchToolSchema,
      execute: async (_toolCallId, rawParams) => {
        try {
          const cfg = loadCfg();
          const params = rawParams as SearchToolParams;
          const results = await searchPages(
            cfg,
            params.query,
            params.spaceKey,
            params.limit ?? DEFAULT_SEARCH_LIMIT,
          );
          return jsonResult({
            ok: true,
            query: params.query,
            spaceKey: params.spaceKey,
            results,
          });
        } catch (error) {
          return jsonResult({ error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      name: "confluence_read_page",
      label: "Confluence Read Page",
      description:
        "Fetch a Confluence page by id or by exact title within a space, convert it to markdown, and cache it locally under the main workspace mirror.",
      parameters: ReadPageToolSchema,
      execute: async (_toolCallId, rawParams) => {
        try {
          const cfg = loadCfg();
          const params = rawParams as ReadPageToolParams;
          let pageId = params.pageId;
          let spaceKey = params.spaceKey;

          if (!pageId) {
            const title = requireValue(params.title, "confluence_read_page requires pageId or title.");
            const space = await ensureSpaceForParams(cfg, spaceKey);
            spaceKey = space.key;
            pageId = (await resolvePageByTitle(cfg, space, title)).id;
          }

          const page = await getPageById(cfg, pageId, spaceKey);
          const resolvedSpaceKey = spaceKey ?? (page.spaceId ? undefined : undefined);
          const fallbackSpaceKey =
            resolvedSpaceKey ??
            (await (async () => {
              const index = await loadMirrorIndex(cfg.cacheRoot);
              return index.pages[page.id]?.spaceKey;
            })()) ??
            cfg.defaultSpaceKey ??
            "UNSORTED";

          const local = await upsertPageMirror({
            cfg,
            page,
            spaceKey: fallbackSpaceKey,
            workspaceDir: ctx.workspaceDir as string,
          });

          return {
            content: [
              {
                type: "text" as const,
                text: page.markdown || "(empty page)",
              },
            ],
            details: {
              ok: true,
              pageId: page.id,
              title: page.title,
              spaceId: page.spaceId,
              spaceKey: fallbackSpaceKey,
              version: page.version?.number,
              webUrl: buildWebUrl(cfg.baseUrl, page.webui),
              localDir: local.localDir,
              localMarkdownPath: local.markdownPath,
              localStoragePath: local.storagePath,
            },
          };
        } catch (error) {
          return jsonResult({ error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      name: "confluence_create_page",
      label: "Confluence Create Page",
      description:
        "Create a new Confluence page from markdown in a space or under a parent page, then cache the new page locally.",
      parameters: CreatePageToolSchema,
      execute: async (_toolCallId, rawParams) => {
        try {
          const cfg = loadCfg();
          const params = rawParams as CreatePageToolParams;
          const space = await ensureSpaceForParams(cfg, params.spaceKey);
          let parentPageId = params.parentPageId;
          if (!parentPageId && params.parentTitle) {
            parentPageId = (await resolvePageByTitle(cfg, space, params.parentTitle)).id;
          }
          const payload: Record<string, unknown> = {
            spaceId: space.id,
            status: "current",
            title: params.title.trim(),
            body: {
              representation: "storage",
              value: markdownToStorage(params.markdown),
            },
          };
          if (parentPageId) {
            payload.parentId = parentPageId;
          }
          const created = await requestJson<Record<string, unknown>>(cfg, `/api/v2/pages`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          const pageId = String(created.id ?? "");
          const detail = await getPageById(cfg, pageId, space.key);
          const local = await upsertPageMirror({
            cfg,
            page: detail,
            spaceKey: space.key,
            workspaceDir: ctx.workspaceDir as string,
          });
          return jsonResult({
            ok: true,
            pageId: detail.id,
            title: detail.title,
            spaceKey: space.key,
            parentPageId,
            version: detail.version?.number,
            webUrl: buildWebUrl(cfg.baseUrl, detail.webui),
            localDir: local.localDir,
            localMarkdownPath: local.markdownPath,
            localStoragePath: local.storagePath,
            versionMessage: params.versionMessage,
          });
        } catch (error) {
          return jsonResult({ error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    {
      name: "confluence_write_page",
      label: "Confluence Write Page",
      description:
        "Replace, append to, or patch sections inside an existing Confluence page using markdown, then update the local mirror.",
      parameters: WritePageToolSchema,
      execute: async (_toolCallId, rawParams) => {
        try {
          const cfg = loadCfg();
          const params = rawParams as WritePageToolParams;
          const current = await getPageById(cfg, params.pageId);
          const mode = params.mode ?? "replace";
          let nextMarkdown = current.markdown;

          if (mode === "replace") {
            nextMarkdown = params.markdown.trim();
          } else if (mode === "append") {
            nextMarkdown = `${current.markdown.trim()}\n\n${params.markdown.trim()}`.trim();
          } else if (mode === "replace_section") {
            const heading = requireValue(
              params.sectionHeading,
              "sectionHeading is required for replace_section.",
            );
            const patched = replaceMarkdownSection(current.markdown, heading, params.markdown);
            if (!patched.replaced) {
              throw new Error(`Section not found: ${heading}`);
            }
            nextMarkdown = patched.markdown.trim();
          } else if (mode === "append_section") {
            const heading = requireValue(
              params.sectionHeading,
              "sectionHeading is required for append_section.",
            );
            nextMarkdown = `${current.markdown.trim()}\n\n## ${heading.trim()}\n\n${params.markdown.trim()}`.trim();
          }

          const payload = {
            id: current.id,
            status: "current",
            title: params.title?.trim() || current.title,
            spaceId: current.spaceId,
            parentId: current.parentId,
            body: {
              representation: "storage",
              value: markdownToStorage(nextMarkdown),
            },
            version: {
              number: (current.version?.number ?? 0) + 1,
              message: params.versionMessage ?? undefined,
            },
          };

          await requestJson<Record<string, unknown>>(cfg, `/api/v2/pages/${encodeURIComponent(current.id)}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });

          const updated = await getPageById(cfg, current.id);
          const index = await loadMirrorIndex(cfg.cacheRoot);
          const resolvedSpaceKey =
            index.pages[current.id]?.spaceKey ?? cfg.defaultSpaceKey ?? "UNSORTED";
          const local = await upsertPageMirror({
            cfg,
            page: updated,
            spaceKey: resolvedSpaceKey,
            workspaceDir: ctx.workspaceDir as string,
          });

          return jsonResult({
            ok: true,
            pageId: updated.id,
            title: updated.title,
            mode,
            version: updated.version?.number,
            webUrl: buildWebUrl(cfg.baseUrl, updated.webui),
            localDir: local.localDir,
            localMarkdownPath: local.markdownPath,
            localStoragePath: local.storagePath,
          });
        } catch (error) {
          return jsonResult({ error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
  ];

  return tools;
}

const plugin = {
  id: "confluence",
  name: "Confluence",
  description: "Main-agent-only Confluence Cloud browser, cache, and editor.",
  configSchema: {
    validate(value: unknown) {
      if (value == null) {
        return { ok: true, value: {} };
      }
      if (typeof value !== "object" || Array.isArray(value)) {
        return { ok: false, errors: ["Confluence plugin config must be an object."] };
      }
      const allowed = new Set(["baseUrl", "email", "apiToken", "defaultSpaceKey", "cacheDir"]);
      const errors: string[] = [];
      for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        if (!allowed.has(key)) {
          errors.push(`Unknown config key: ${key}`);
          continue;
        }
        if (raw != null && typeof raw !== "string") {
          errors.push(`Config key ${key} must be a string.`);
        }
      }
      return errors.length ? { ok: false, errors } : { ok: true, value };
    },
    uiHints: {
      baseUrl: {
        label: "Confluence Base URL",
        help: "Confluence Cloud site root, for example https://xindong.atlassian.net/wiki",
      },
      email: {
        label: "Confluence Email",
        sensitive: true,
      },
      apiToken: {
        label: "Confluence API Token",
        sensitive: true,
      },
      defaultSpaceKey: {
        label: "Default Space Key",
        help: "Optional default space key for create/read operations.",
      },
      cacheDir: {
        label: "Cache Dir",
        help: "Relative path under the main workspace for the local Confluence mirror.",
      },
    },
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        baseUrl: { type: "string" },
        email: { type: "string" },
        apiToken: { type: "string" },
        defaultSpaceKey: { type: "string" },
        cacheDir: { type: "string" },
      },
    },
  },
  register(api: OpenClawPluginApi) {
    api.registerTool((ctx) => createConfluenceTools(api, ctx), {
      names: [
        "confluence_spaces",
        "confluence_sync_space",
        "confluence_ls",
        "confluence_search",
        "confluence_read_page",
        "confluence_create_page",
        "confluence_write_page",
      ],
    });
    api.logger.info("confluence: registered main-agent Confluence tools");
  },
};

export default plugin;
