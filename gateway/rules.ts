// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
// Pure authorization rules for the gateway. No gateway imports, so they are unit-tested on their own.
import { Kind, getOperationAST, type DocumentNode, type SelectionSetNode, type FragmentDefinitionNode } from "graphql";

export type Claims = Record<string, unknown>;

/** What each role may do. Override with the ROLE_PERMISSIONS environment variable (JSON). */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  user: ["reviews:write"],
  editor: ["reviews:write", "catalog:write"],
  moderator: ["reviews:write", "catalog:write"],
};

/** Which permission each mutation field needs. A mutation field that is not listed here is refused (default deny). */
export const MUTATION_PERMISSIONS: Record<string, string> = {
  createMovies: "catalog:write", updateMovies: "catalog:write", deleteMovies: "catalog:write",
  createPeople: "catalog:write", updatePeople: "catalog:write", deletePeople: "catalog:write",
  createGenres: "catalog:write", updateGenres: "catalog:write", deleteGenres: "catalog:write",
  createReview: "reviews:write", updateReviews: "reviews:write", deleteReviews: "reviews:write",
};

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/**
 * Permissions of a token: those implied by its `roles` (Keycloak realm roles), plus any in a `permissions` array
 * (Auth0 RBAC) and in the space-separated OAuth `scope` claim.
 */
export function permissionsFromClaims(claims: Claims | undefined, roleMap: Record<string, string[]> = DEFAULT_ROLE_PERMISSIONS): Set<string> {
  const out = new Set<string>();
  if (!claims) return out;
  for (const role of strings(claims.roles)) for (const p of roleMap[role] ?? []) out.add(p);
  for (const p of strings(claims.permissions)) out.add(p);
  if (typeof claims.scope === "string") for (const p of claims.scope.split(/\s+/).filter(Boolean)) out.add(p);
  return out;
}

function collectRootFields(selection: SelectionSetNode, fragments: Map<string, FragmentDefinitionNode>, out: Set<string>, seen = new Set<string>()): void {
  for (const sel of selection.selections) {
    if (sel.kind === Kind.FIELD) out.add(sel.name.value);
    else if (sel.kind === Kind.INLINE_FRAGMENT) collectRootFields(sel.selectionSet, fragments, out, seen);
    else if (sel.kind === Kind.FRAGMENT_SPREAD && !seen.has(sel.name.value)) {
      seen.add(sel.name.value);
      const frag = fragments.get(sel.name.value);
      if (frag) collectRootFields(frag.selectionSet, fragments, out, seen);
    }
  }
}

/** Root fields of the mutation being executed, or [] if the operation is not a mutation. `__typename` is ignored. */
export function mutationRootFields(document: DocumentNode, operationName?: string | null): string[] {
  const op = getOperationAST(document, operationName ?? undefined);
  if (!op || op.operation !== "mutation") return [];
  const fragments = new Map(document.definitions.filter((d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION).map((d) => [d.name.value, d]));
  const out = new Set<string>();
  collectRootFields(op.selectionSet, fragments, out);
  out.delete("__typename");
  return [...out];
}

export type Decision = { ok: true } | { ok: false; status: 401 | 403; code: "UNAUTHENTICATED" | "FORBIDDEN"; message: string };

/** Decides whether a mutation may run. Queries are not checked here: reads are public. */
export function authorizeMutation(claims: Claims | undefined, rootFields: string[], roleMap = DEFAULT_ROLE_PERMISSIONS): Decision {
  if (rootFields.length === 0) return { ok: true };
  if (!claims) return { ok: false, status: 401, code: "UNAUTHENTICATED", message: "Unauthenticated: log in to change data" };
  const granted = permissionsFromClaims(claims, roleMap);
  for (const field of rootFields) {
    const needed = MUTATION_PERMISSIONS[field];
    if (!needed) return { ok: false, status: 403, code: "FORBIDDEN", message: `Forbidden: mutation "${field}" is not allowed through the gateway` };
    if (!granted.has(needed)) return { ok: false, status: 403, code: "FORBIDDEN", message: `Forbidden: "${field}" needs the "${needed}" permission` };
  }
  return { ok: true };
}

/** Parses ROLE_PERMISSIONS (JSON object of role -> permissions) or falls back to the defaults. */
export function parseRolePermissions(raw: string | undefined): Record<string, string[]> {
  if (!raw) return DEFAULT_ROLE_PERMISSIONS;
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed) || !Object.values(parsed).every((v) => Array.isArray(v) && v.every((x) => typeof x === "string"))) {
    throw new Error("ROLE_PERMISSIONS must be a JSON object mapping each role to an array of permission strings");
  }
  return parsed as Record<string, string[]>;
}
