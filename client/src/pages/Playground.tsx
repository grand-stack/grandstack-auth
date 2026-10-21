import { useState } from "react";
import { getAccessToken } from "../auth/AuthProvider";
import { useAuth } from "../auth/AuthProvider";
import { can, isModerator, type Identity } from "../auth/claims";
import { GRAPHQL_URL } from "../auth/config";
import { Button } from "../ui";

interface Step { label: string; status: number; body: unknown }
type Outcome = "allowed" | "refused" | "no effect";
interface Probe {
  key: string;
  title: string;
  explain: string;
  run: (me: Identity | undefined) => Promise<Step[]>;
  expected: (me: Identity | undefined) => { outcome: Outcome; why: string };
}

async function call(label: string, query: string, variables?: Record<string, unknown>): Promise<Step> {
  const token = getAccessToken();
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  return { label, status: res.status, body };
}

const data = (s: Step | undefined) => (s?.body as { data?: Record<string, unknown> } | undefined)?.data;
const errors = (s: Step | undefined) => (s?.body as { errors?: { message: string }[] } | undefined)?.errors ?? [];

/** What actually happened, judged from the last step. */
function outcomeOf(steps: Step[]): Outcome {
  const last = steps[steps.length - 1];
  if (!last) return "refused";
  if (last.status === 401 || last.status === 403) return "refused";
  if (errors(last).some((e) => /unauthenticated|forbidden|unauthori[sz]ed/i.test(e.message))) return "refused";
  const d = data(last) ?? {};
  const first = Object.values(d)[0] as Record<string, unknown> | null | undefined;
  if (first && typeof first === "object") {
    if (first.nodesDeleted === 0) return "no effect";
    if (Array.isArray(first.reviews) && first.reviews.length === 0) return "no effect";
  }
  return errors(last).length > 0 ? "refused" : "allowed";
}

const tag = `Playground ${Math.random().toString(36).slice(2, 7)}`;

const PROBES: Probe[] = [
  {
    key: "read",
    title: "Read the movies",
    explain: "Reads are public: this works with or without logging in.",
    run: async () => [await call("movies", `{ moviesConnection { totalCount } }`)],
    expected: () => ({ outcome: "allowed", why: "reading is public" }),
  },
  {
    key: "review",
    title: "Write a review, then delete it again",
    explain: "createReview takes the author from your token. Needs the reviews:write permission (every logged-in user has it).",
    run: async () => {
      const created = await call("createReview", `mutation($t:String!){ createReview(movie:"Inception", rating:7, text:$t){ id author{ name } } }`, { t: tag });
      const id = (data(created)?.createReview as { id?: string } | null)?.id;
      if (!id) return [created];
      return [created, await call("deleteReviews (my own)", `mutation($id:ID!){ deleteReviews(where:{id:{eq:$id}}){ nodesDeleted } }`, { id })];
    },
    expected: (me) => (can(me, "reviews:write") ? { outcome: "allowed", why: "you have reviews:write" } : { outcome: "refused", why: me ? "your role has no reviews:write" : "you are not logged in" }),
  },
  {
    key: "create-movie",
    title: "Create a movie, then delete it",
    explain: "Changing the catalogue needs catalog:write (editors and moderators). The gateway checks the permission and the server checks the role again.",
    run: async () => {
      const created = await call("createMovies", `mutation($t:String!){ createMovies(input:[{title:$t}]){ movies{ title } } }`, { t: tag });
      if (!data(created)?.createMovies) return [created];
      return [created, await call("deleteMovies", `mutation($t:String!){ deleteMovies(where:{title:{eq:$t}}){ nodesDeleted } }`, { t: tag })];
    },
    expected: (me) => (can(me, "catalog:write") ? { outcome: "allowed", why: "you have catalog:write" } : { outcome: "refused", why: me ? "needs catalog:write (editor or moderator)" : "you are not logged in" }),
  },
  {
    key: "delete-missing",
    title: "Delete a movie that does not exist",
    explain: "A safe way to see the permission check on its own: with catalog:write it succeeds and deletes nothing; without it, it is refused.",
    run: async () => [await call("deleteMovies", `mutation{ deleteMovies(where:{title:{eq:"No such movie (playground)"}}){ nodesDeleted } }`)],
    expected: (me) => (can(me, "catalog:write") ? { outcome: "no effect", why: "allowed, but there is nothing to delete" } : { outcome: "refused", why: me ? "needs catalog:write" : "you are not logged in" }),
  },
  {
    key: "foreign-review",
    title: "Edit someone else's review (with the same text)",
    explain: "Row-level rule: only a review's author or a moderator can change it. For everyone else the review simply is not matched, so nothing changes. The text is sent unchanged, so even a moderator does no harm.",
    run: async (me) => {
      const list = await call("reviews by other people", `{ reviews(limit: 50){ id text author{ sub } } }`);
      const all = ((data(list)?.reviews ?? []) as { id: string; text: string | null; author: { sub: string } | null }[]);
      const foreign = all.find((r) => r.author?.sub !== me?.sub);
      if (!foreign) return [list, { label: "no review by another user yet", status: 0, body: { note: "Log in as another user, write a review, then come back." } }];
      return [list, await call("updateReviews (not mine)", `mutation($id:ID!,$x:String){ updateReviews(where:{id:{eq:$id}}, update:{text:{set:$x}}){ reviews{ id } } }`, { id: foreign.id, x: foreign.text })];
    },
    expected: (me) => !can(me, "reviews:write")
      ? { outcome: "refused", why: me ? "your role has no reviews:write" : "you are not logged in" }
      : isModerator(me) ? { outcome: "allowed", why: "moderators may change any review" } : { outcome: "no effect", why: "not your review, so it is not matched" },
  },
  {
    key: "spoof",
    title: "Look for a way to write a review as someone else",
    explain: "There is no generated createReviews mutation and createReview has no author argument, so the author can only come from the token.",
    run: async () => [await call("schema", `{ __type(name:"Mutation"){ fields{ name args{ name } } } }`)],
    expected: () => ({ outcome: "allowed", why: "introspection is public; look at the fields it returns" }),
  },
];

export function Playground() {
  const { identity, loading } = useAuth();
  const [results, setResults] = useState<Record<string, { steps: Step[]; ran: Date }>>({});
  const [busy, setBusy] = useState<string>();

  const run = async (p: Probe) => {
    setBusy(p.key);
    try {
      const steps = await p.run(identity);
      setResults((r) => ({ ...r, [p.key]: { steps, ran: new Date() } }));
    } finally { setBusy(undefined); }
  };

  return (
    <section>
      <h1>Permissions playground</h1>
      <p className="muted">
        Each button tries something as <strong>{loading ? "…" : identity ? `${identity.name} (${identity.roles.filter((r) => ["user", "editor", "moderator"].includes(r)).join(", ") || "no role"})` : "an anonymous visitor"}</strong> and
        shows what the gateway and server did. Log in as different users to compare. The first line of each card says what the rules predict.
      </p>
      <p className="muted">Permissions in your token: {identity?.permissions.length ? identity.permissions.map((p) => <code key={p} className="perm">{p}</code>) : "none"}</p>
      {PROBES.map((p) => {
        const expectation = p.expected(identity);
        const result = results[p.key];
        const actual = result ? outcomeOf(result.steps) : undefined;
        const matches = actual === undefined ? undefined : p.key === "spoof" ? true : actual === expectation.outcome;
        return (
          <article className="probe" key={p.key} data-testid={`probe-${p.key}`}>
            <h2>{p.title}</h2>
            <p>{p.explain}</p>
            <p className="muted">Expected for you: <strong>{expectation.outcome}</strong> ({expectation.why})</p>
            <Button variant="primary" disabled={busy !== undefined || loading} onClick={() => void run(p)}>{busy === p.key ? "Running…" : "Try it"}</Button>
            {result && (
              <div className="probe-result" data-testid={`result-${p.key}`}>
                <p>Result: <strong data-testid={`outcome-${p.key}`}>{actual}</strong> {matches ? <span className="rating rating-great">as expected</span> : <span className="rating rating-ok">different from the prediction</span>}</p>
                {result.steps.map((s, i) => (
                  <details key={i} open={i === result.steps.length - 1}>
                    <summary>{s.label}: HTTP {s.status || "n/a"}</summary>
                    <pre>{JSON.stringify(s.body, null, 2)}</pre>
                  </details>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
