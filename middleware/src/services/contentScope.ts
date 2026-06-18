export type SearchTarget =
  | { type: "bucket"; bucketId: string | number }
  | { type: "group"; groupId: string | number }
  | { type: "documents"; documentIds: string[] };

export interface ContentScope {
  searchTarget: SearchTarget;
  portfolioId?: string;
  projectId?: string;
  folderId?: string;
}

export interface ServerDerivedContentConstraints {
  roles?: string[];
  access?: string[];
  status?: string;
  version?: string | number;
}

export interface GroundXSearchOptions {
  resultCount?: number;
  verbosity?: 0 | 1 | 2;
  relevance?: number;
  nextToken?: string;
}

export interface NormalizedContentScope extends ContentScope {
  searchTarget: SearchTarget;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidNumericId(value: unknown): boolean {
  if (typeof value === "number") return Number.isInteger(value) && value > 0;
  return typeof value === "string" && /^[1-9]\d*$/.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeResultCount(value: number | undefined): number {
  if (value == null) return 10;
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("GroundX search resultCount must be an integer between 1 and 100");
  }
  return value;
}

function normalizeVerbosity(value: GroundXSearchOptions["verbosity"]): 0 | 1 | 2 {
  return value ?? 2;
}

function normalizeRelevance(value: number | undefined): number {
  if (value == null) return 10;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("GroundX search relevance must be a non-negative number");
  }
  return value;
}

function searchParams(options: GroundXSearchOptions = {}): string {
  const params = new URLSearchParams({
    n: String(normalizeResultCount(options.resultCount)),
    verbosity: String(normalizeVerbosity(options.verbosity)),
  });
  if (options.nextToken) params.set("nextToken", options.nextToken);
  return params.toString();
}

export function normalizeContentScope(input: unknown): NormalizedContentScope {
  if (!isObject(input) || !isObject(input.searchTarget)) {
    throw new Error("A bucket, group, or document search target is required");
  }
  if ("filter" in input) {
    throw new Error("Raw GroundX filters are server-derived and cannot be supplied by the browser");
  }
  const target = input.searchTarget;
  let searchTarget: SearchTarget;
  if (target.type === "bucket" && isValidNumericId(target.bucketId)) {
    searchTarget = { type: "bucket", bucketId: target.bucketId as string | number };
  } else if (target.type === "group" && isValidNumericId(target.groupId)) {
    searchTarget = { type: "group", groupId: target.groupId as string | number };
  } else if (
    target.type === "documents" &&
    Array.isArray(target.documentIds) &&
    target.documentIds.length > 0 &&
    target.documentIds.every(isUuid)
  ) {
    searchTarget = { type: "documents", documentIds: target.documentIds.map((id) => id.trim()) };
  } else {
    throw new Error("A bucket, group, or document search target is required");
  }

  return {
    searchTarget,
    portfolioId: cleanString(input.portfolioId),
    projectId: cleanString(input.projectId),
    folderId: cleanString(input.folderId),
  };
}

export function buildGroundXFilter(
  contentScope: ContentScope,
  constraints: ServerDerivedContentConstraints = {}
): Record<string, unknown> | undefined {
  const clauses: Record<string, unknown>[] = [];
  if (contentScope.portfolioId) clauses.push({ portfolio: contentScope.portfolioId });
  if (contentScope.projectId) clauses.push({ project: contentScope.projectId });
  if (contentScope.folderId) clauses.push({ folder: contentScope.folderId });
  if (constraints.roles?.length) clauses.push({ roles: { $in: constraints.roles } });
  if (constraints.access?.length) clauses.push({ access: { $in: constraints.access } });
  if (constraints.status) clauses.push({ status: constraints.status });
  if (constraints.version != null) clauses.push({ version: constraints.version });
  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

export function groundXSearchPath(contentScope: ContentScope, options: GroundXSearchOptions = {}): string {
  const target = contentScope.searchTarget;
  const params = searchParams(options);
  if (target.type === "bucket") return `/search/${encodeURIComponent(String(target.bucketId))}?${params}`;
  if (target.type === "group") return `/search/${encodeURIComponent(String(target.groupId))}?${params}`;
  return `/search/documents?${params}`;
}

export function searchBody(
  contentScope: ContentScope,
  query: string,
  constraints?: ServerDerivedContentConstraints,
  options: GroundXSearchOptions = {}
): Record<string, unknown> {
  const target = contentScope.searchTarget;
  const filter = buildGroundXFilter(contentScope, constraints);
  return {
    ...(target.type === "documents" ? { documentIds: target.documentIds } : {}),
    query,
    relevance: normalizeRelevance(options.relevance),
    ...(filter ? { filter } : {}),
  };
}
