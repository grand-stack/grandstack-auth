// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { describe, expect, it } from "vitest";
import { can, decodePayload, identityFromToken, isModerator } from "./claims";

function token(claims: Record<string, unknown>): string {
  // Real tokens are UTF-8 bytes, base64url encoded (btoa alone mangles non-Latin1 text)
  const b64 = (o: unknown) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "none" })}.${b64(claims)}.sig`;
}

describe("claims", () => {
  it("decodes a base64url payload, including non-ASCII names", () => {
    expect(decodePayload(token({ name: "Zoë Müller", n: 1 }))).toEqual({ name: "Zoë Müller", n: 1 });
  });
  it("rejects something that is not a JWT", () => {
    expect(() => decodePayload("nope")).toThrow(/Not a JWT/);
  });
  it("derives permissions from roles", () => {
    const id = identityFromToken(token({ sub: "1", name: "Alice", roles: ["user"] }));
    expect(id).toEqual({ sub: "1", name: "Alice", roles: ["user"], permissions: ["reviews:write"] });
    expect(can(id, "reviews:write")).toBe(true);
    expect(can(id, "catalog:write")).toBe(false);
  });
  it("adds permissions the token carries itself (Auth0 RBAC style)", () => {
    const id = identityFromToken(token({ sub: "2", permissions: ["catalog:write"] }));
    expect(id.permissions).toEqual(["catalog:write"]);
  });
  it("editors can write the catalogue and moderators are flagged", () => {
    expect(can(identityFromToken(token({ sub: "3", roles: ["editor"] })), "catalog:write")).toBe(true);
    expect(isModerator(identityFromToken(token({ sub: "4", roles: ["moderator", "editor", "user"] })))).toBe(true);
    expect(isModerator(identityFromToken(token({ sub: "5", roles: ["editor"] })))).toBe(false);
  });
  it("falls back through name, username, email and sub", () => {
    expect(identityFromToken(token({ sub: "9", preferred_username: "zed" })).name).toBe("zed");
    expect(identityFromToken(token({ sub: "9" })).name).toBe("9");
  });
  it("treats an absent identity as having no permissions", () => {
    expect(can(undefined, "reviews:write")).toBe(false);
    expect(isModerator(undefined)).toBe(false);
  });
});
