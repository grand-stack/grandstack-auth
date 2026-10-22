// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { describe, expect, it } from "vitest";
import { CombinedError } from "urql";
import { describeError, validateReview } from "./errors";

const err = (message: string, status?: number) => new CombinedError({ graphQLErrors: [message], response: status ? { status } : undefined });

describe("describeError", () => {
  it("maps 401 and unauthenticated to a login hint", () => {
    expect(describeError(err("Unauthenticated", 401))).toMatch(/log in/i);
    expect(describeError(err("Unauthenticated"))).toMatch(/log in/i);
  });
  it("maps 403 and forbidden to a role message", () => {
    expect(describeError(err("Forbidden: x", 403))).toMatch(/role/i);
  });
  it("passes other messages through and handles no error", () => {
    expect(describeError(err("Something else"))).toBe("Something else");
    expect(describeError(undefined)).toBeUndefined();
  });
});

describe("validateReview", () => {
  it("accepts 1 to 10 and rejects the rest", () => {
    expect(validateReview("1", "")).toBeUndefined();
    expect(validateReview("10", "fine")).toBeUndefined();
    expect(validateReview("0", "")).toMatch(/1 to 10/);
    expect(validateReview("11", "")).toMatch(/1 to 10/);
    expect(validateReview("7.5", "")).toMatch(/whole/);
    expect(validateReview("abc", "")).toMatch(/whole/);
  });
  it("limits the text length", () => {
    expect(validateReview("5", "x".repeat(2001))).toMatch(/2000/);
  });
});
