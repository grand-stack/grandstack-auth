// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import type { CombinedError } from "urql";

/** Turns an API error into something a person can act on. */
export function describeError(error: CombinedError | undefined): string | undefined {
  if (!error) return undefined;
  const status = error.response && (error.response as { status?: number }).status;
  const text = [error.message, ...error.graphQLErrors.map((e) => e.message)].join(" ");
  if (status === 401 || /unauthenticated/i.test(text)) return "You need to log in (or your session expired) to do that.";
  if (status === 403 || /forbidden/i.test(text)) return "Your role does not allow that.";
  if (/failed to fetch|network/i.test(text)) return "Could not reach the server. Is the stack running?";
  return error.graphQLErrors[0]?.message ?? error.message.replace(/^\[(GraphQL|Network)\]\s*/, "");
}

export function validateReview(rating: string, text: string): string | undefined {
  const n = Number(rating);
  if (!Number.isInteger(n) || n < 1 || n > 10) return "Rating must be a whole number from 1 to 10";
  if (text.length > 2000) return "Review text is limited to 2000 characters";
  return undefined;
}
