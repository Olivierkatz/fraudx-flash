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

function hasValidNumericId(value: string | number): boolean {
  if (typeof value === "number") return Number.isInteger(value) && value > 0;
  return /^[1-9]\d*$/.test(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export function validateContentScope(scope: ContentScope): ContentScope {
  if ("filter" in (scope as unknown as Record<string, unknown>)) {
    throw new Error("Raw GroundX filters are server-derived and cannot be supplied by the browser");
  }
  const target = scope.searchTarget;
  if (target.type === "bucket" && hasValidNumericId(target.bucketId)) return scope;
  if (target.type === "group" && hasValidNumericId(target.groupId)) return scope;
  if (target.type === "documents" && target.documentIds.length > 0 && target.documentIds.every(isUuid)) return scope;
  throw new Error("A bucket, group, or document search target is required");
}
