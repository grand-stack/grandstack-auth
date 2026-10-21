import { parse } from "graphql";
import { describe, expect, it } from "vitest";
import { authorizeMutation, mutationRootFields, parseRolePermissions, permissionsFromClaims } from "../rules";

const fields = (q: string, name?: string) => mutationRootFields(parse(q), name);

describe("mutationRootFields", () => {
  it("returns nothing for queries and subscriptions-free documents", () => {
    expect(fields("query { movies { title } }")).toEqual([]);
  });
  it("lists mutation root fields, ignoring aliases and __typename", () => {
    expect(fields("mutation { a: createMovies(input: []) { movies { title } } __typename deleteMovies(where: {}) { nodesDeleted } }").sort()).toEqual(["createMovies", "deleteMovies"]);
  });
  it("follows fragments and inline fragments at the root", () => {
    expect(fields("mutation { ...F ... on Mutation { createReview(movie:\"x\", rating: 1) { id } } } fragment F on Mutation { deleteMovies(where: {}) { nodesDeleted } }").sort()).toEqual(["createReview", "deleteMovies"]);
  });
  it("picks the named operation when a document has several", () => {
    const q = "query Q { movies { title } } mutation M { createReview(movie:\"x\", rating: 1) { id } }";
    expect(fields(q, "Q")).toEqual([]);
    expect(fields(q, "M")).toEqual(["createReview"]);
  });
});

describe("permissionsFromClaims", () => {
  it("maps roles, and reads Auth0-style permissions and the scope string", () => {
    expect([...permissionsFromClaims({ roles: ["editor"] })].sort()).toEqual(["catalog:write", "reviews:write"]);
    expect([...permissionsFromClaims({ permissions: ["catalog:write"], scope: "openid reviews:write" })].sort()).toEqual(["catalog:write", "openid", "reviews:write"]);
  });
  it("ignores unknown roles and junk", () => {
    expect(permissionsFromClaims({ roles: ["wizard", 5], permissions: "no" })).toEqual(new Set());
    expect(permissionsFromClaims(undefined)).toEqual(new Set());
  });
});

describe("authorizeMutation", () => {
  const user = { roles: ["user"] };
  const editor = { roles: ["user", "editor"] };
  it("allows anything that is not a mutation", () => {
    expect(authorizeMutation(undefined, [])).toEqual({ ok: true });
  });
  it("answers 401 for an anonymous mutation", () => {
    expect(authorizeMutation(undefined, ["createReview"])).toMatchObject({ ok: false, status: 401, code: "UNAUTHENTICATED" });
  });
  it("lets a user review but not touch the catalogue", () => {
    expect(authorizeMutation(user, ["createReview"])).toEqual({ ok: true });
    expect(authorizeMutation(user, ["updateMovies"])).toMatchObject({ ok: false, status: 403, code: "FORBIDDEN" });
  });
  it("lets an editor change the catalogue", () => {
    expect(authorizeMutation(editor, ["createMovies", "deleteGenres"])).toEqual({ ok: true });
  });
  it("refuses the whole operation if any field is not allowed", () => {
    expect(authorizeMutation(user, ["createReview", "deleteMovies"])).toMatchObject({ ok: false, status: 403 });
  });
  it("denies mutation fields it does not know about", () => {
    expect(authorizeMutation(editor, ["dropEverything"])).toMatchObject({ ok: false, status: 403 });
  });
  it("honours a custom role map", () => {
    expect(authorizeMutation({ roles: ["critic"] }, ["deleteReviews"], { critic: ["reviews:write"] })).toEqual({ ok: true });
  });
});

describe("parseRolePermissions", () => {
  it("uses defaults when unset and validates the JSON shape", () => {
    expect(parseRolePermissions(undefined).editor).toContain("catalog:write");
    expect(parseRolePermissions('{"critic":["reviews:write"]}')).toEqual({ critic: ["reviews:write"] });
    expect(() => parseRolePermissions('{"critic":"reviews:write"}')).toThrow(/ROLE_PERMISSIONS/);
    expect(() => parseRolePermissions("[]")).toThrow(/ROLE_PERMISSIONS/);
  });
});
