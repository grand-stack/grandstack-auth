// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
/** Reading what a token says about the user. The browser only decodes the token to show and gate UI; the gateway and server verify it. */
export interface Identity {
  sub: string;
  name: string;
  roles: string[];
  permissions: string[];
}

/** The gateway's default role -> permission map (gateway/rules.ts). Keep the two in step, or read permissions from the token. */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  user: ["reviews:write"],
  editor: ["reviews:write", "catalog:write"],
  moderator: ["reviews:write", "catalog:write"],
};

export function decodePayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (!part) throw new Error("Not a JWT");
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function identityFromToken(token: string): Identity {
  const claims = decodePayload(token);
  const roles = strings(claims.roles);
  const permissions = new Set<string>(strings(claims.permissions));
  for (const role of roles) for (const p of ROLE_PERMISSIONS[role] ?? []) permissions.add(p);
  const name = [claims.name, claims.preferred_username, claims.email, claims.sub].find((v): v is string => typeof v === "string" && v.length > 0) ?? "Unknown";
  return { sub: String(claims.sub ?? ""), name, roles, permissions: [...permissions].sort() };
}

export const can = (identity: Identity | undefined, permission: string): boolean => !!identity?.permissions.includes(permission);
export const isModerator = (identity: Identity | undefined): boolean => !!identity?.roles.includes("moderator");
