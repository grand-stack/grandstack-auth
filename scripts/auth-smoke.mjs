#!/usr/bin/env node
// Token-level integration tests for the auth setup. No browser needed.
//   GRAPHQL_URL   endpoint under test (the gateway in the auth stack)           default http://localhost:4000/graphql
//   SERVER_URL    optional: the GraphQL server itself, to prove it refuses unauthenticated writes when bypassing the gateway
//   KEYCLOAK_URL  Keycloak base URL used to get tokens                          default http://localhost:8081
//   AUTH_ISSUER   the issuer (iss) the services expect, used to forge tokens    default http://localhost:8081/realms/grandstack
// Creates data named "ZZ Auth ..." and removes it at the end. Uses demo users from keycloak/grandstack-realm.json.
import { SignJWT, generateKeyPair } from "jose";

const GRAPHQL = process.env.GRAPHQL_URL ?? "http://localhost:4000/graphql";
const SERVER = process.env.SERVER_URL;
const KEYCLOAK = process.env.KEYCLOAK_URL ?? "http://localhost:8081";
const REALM_URL = `${KEYCLOAK}/realms/grandstack`;
const ISSUER = process.env.AUTH_ISSUER ?? "http://localhost:8081/realms/grandstack";

const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " " + extra : ""}`); };

async function login(user, client = "grandstack-smoke") {
  const res = await fetch(`${REALM_URL}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", client_id: client, username: user, password: `${user}-pass`, scope: "openid" }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`Could not log in as ${user}: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function gql(query, variables, token, url = GRAPHQL) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  let body = {};
  try { body = await res.json(); } catch { /* non-JSON body */ }
  return { status: res.status, data: body.data, errors: body.errors, text: JSON.stringify(body.errors ?? "") };
}

/** True when a request was refused with a real auth error: HTTP 401/403 or a GraphQL Unauthenticated/Forbidden error. */
const AUTH_ERROR = /unauthenticated|unauthori[sz]ed|forbidden|not allowed|permission|jwt|token/i;
const refused = (r) => r.status === 401 || r.status === 403 || (r.errors?.some((e) => AUTH_ERROR.test(e.message)) && !r.data?.[Object.keys(r.data ?? {})[0]]);

const [alice, bob, carol] = await Promise.all(["alice", "bob", "carol"].map((u) => login(u)));
const TITLE = "ZZ Auth Movie";

const UPDATE_MOVIE = `mutation($t:String!,$tag:String){ updateMovies(where:{title:{eq:$t}}, update:{tagline:{set:$tag}}){ movies{ title tagline } } }`;
const CREATE_MOVIE = `mutation($t:String!){ createMovies(input:[{title:$t}]){ movies{ title } } }`;
const DELETE_MOVIE = `mutation($t:String!){ deleteMovies(where:{title:{eq:$t}}){ nodesDeleted } }`;
const CREATE_REVIEW = `mutation($m:String!,$r:Int!,$x:String){ createReview(movie:$m, rating:$r, text:$x){ id rating text author{ sub name } movie{ title } } }`;
const UPDATE_REVIEW = `mutation($id:ID!,$x:String){ updateReviews(where:{id:{eq:$id}}, update:{text:{set:$x}}){ reviews{ id text } } }`;
const DELETE_REVIEW = `mutation($id:ID!){ deleteReviews(where:{id:{eq:$id}}){ nodesDeleted } }`;

try {
  // ---- reads are public ----
  const anonRead = await gql(`{ moviesConnection{ totalCount } }`);
  check("anonymous can read movies", anonRead.data?.moviesConnection?.totalCount > 0, JSON.stringify(anonRead.errors ?? ""));
  const anonReviews = await gql(`{ reviews{ id rating } }`);
  check("anonymous can read reviews", Array.isArray(anonReviews.data?.reviews), JSON.stringify(anonReviews.errors ?? ""));

  // ---- anonymous writes are refused ----
  check("anonymous cannot create a movie", refused(await gql(CREATE_MOVIE, { t: TITLE })));
  check("anonymous cannot create a review", refused(await gql(CREATE_REVIEW, { m: "Inception", r: 8, x: "nope" })));

  // ---- user (alice) ----
  check("user cannot create a movie", refused(await gql(CREATE_MOVIE, { t: TITLE }, alice)));
  const review = await gql(CREATE_REVIEW, { m: "Inception", r: 9, x: "Great film" }, alice);
  const rid = review.data?.createReview?.id;
  check("user can create a review", !!rid && review.data.createReview.rating === 9, review.text);
  check("review author comes from the token", review.data?.createReview?.author?.name === "Alice Reader", JSON.stringify(review.data?.createReview?.author));
  check("review is visible to anonymous readers", (await gql(`query($id:ID!){ reviews(where:{id:{eq:$id}}){ id author{ name } movie{ title } } }`, { id: rid })).data?.reviews?.length === 1);
  check("invalid rating creates nothing", !(await gql(CREATE_REVIEW, { m: "Inception", r: 11, x: "bad" }, alice)).data?.createReview);
  check("review for an unknown movie creates nothing", !(await gql(CREATE_REVIEW, { m: "No Such Movie", r: 5 }, alice)).data?.createReview);
  const own = await gql(UPDATE_REVIEW, { id: rid, x: "Still great" }, alice);
  check("user can edit their own review", own.data?.updateReviews?.reviews?.[0]?.text === "Still great", own.text);

  // ---- someone else's review (bob is an editor, not the author, not a moderator) ----
  const reviewState = async () => (await gql(`query($id:ID!){ reviews(where:{id:{eq:$id}}){ text author{ name } } }`, { id: rid })).data?.reviews?.[0];
  const hijack = await gql(UPDATE_REVIEW, { id: rid, x: "hijack" }, bob);
  check("non-author cannot edit a review (nothing changes)", !hijack.data?.updateReviews?.reviews?.length && (await reviewState())?.text === "Still great", hijack.text);
  const stealDelete = await gql(DELETE_REVIEW, { id: rid }, bob);
  check("non-author cannot delete a review (nothing deleted)", !stealDelete.data?.deleteReviews?.nodesDeleted && !!(await reviewState()), stealDelete.text);
  const reassign = await gql(`mutation($id:ID!){ updateReviews(where:{id:{eq:$id}}, update:{author:{disconnect:{where:{}}, connect:{where:{node:{sub:{eq:"someone-else"}}}}}}){ reviews{ id } } }`, { id: rid }, alice);
  check("author link cannot be edited through a review", !reassign.data?.updateReviews?.reviews?.length && (await reviewState())?.author?.name === "Alice Reader", reassign.text.slice(0, 100));
  check("generated createReviews does not exist (author cannot be spoofed)",
    (await gql(`{ __type(name:"Mutation"){ fields{ name } } }`)).data?.__type?.fields?.every((f) => f.name !== "createReviews"));

  // ---- editor (bob) manages the catalogue ----
  const created = await gql(CREATE_MOVIE, { t: TITLE }, bob);
  check("editor can create a movie", created.data?.createMovies?.movies?.[0]?.title === TITLE, created.text);
  const updated = await gql(UPDATE_MOVIE, { t: TITLE, tag: "edited by bob" }, bob);
  check("editor can update a movie", updated.data?.updateMovies?.movies?.[0]?.tagline === "edited by bob", updated.text);
  check("user cannot update a movie", refused(await gql(UPDATE_MOVIE, { t: TITLE, tag: "hax" }, alice)));
  check("user cannot delete a movie", refused(await gql(DELETE_MOVIE, { t: TITLE }, alice)));
  check("user cannot create a person", refused(await gql(`mutation{ createPeople(input:[{name:"ZZ Auth Person"}]){ people{ name } } }`, undefined, alice)));

  // ---- moderator (carol) ----
  const modDelete = await gql(DELETE_REVIEW, { id: rid }, carol);
  check("moderator can delete anyone's review", modDelete.data?.deleteReviews?.nodesDeleted === 1, modDelete.text);
  check("editor can delete a movie", (await gql(DELETE_MOVIE, { t: TITLE }, bob)).data?.deleteMovies?.nodesDeleted === 1);

  // ---- tokens that must not work ----
  const { privateKey } = await generateKeyPair("RS256");
  const forge = (claims, opts = {}) => new SignJWT({ roles: ["editor", "moderator", "user"], ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "forged" }).setIssuer(opts.issuer ?? ISSUER).setAudience(opts.audience ?? "grandstack-api")
    .setSubject("forger").setIssuedAt().setExpirationTime("5m").sign(privateKey);
  check("token signed by another key is rejected", refused(await gql(CREATE_MOVIE, { t: "ZZ Auth Forged" }, await forge({}))));
  const [, payload] = alice.split(".");
  check("token with a tampered payload is rejected", refused(await gql(CREATE_MOVIE, { t: "ZZ Auth Tampered" }, `${alice.split(".")[0]}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url")), roles: ["editor"] })).toString("base64url")}.${alice.split(".")[2]}`)));
  check("garbage token is rejected", refused(await gql(CREATE_MOVIE, { t: "ZZ Auth Garbage" }, "not-a-jwt")));
  const short = await login("bob", "grandstack-smoke-expiring");
  check("a fresh short-lived token works", (await gql(`{ moviesConnection{ totalCount } }`, undefined, short)).data?.moviesConnection?.totalCount > 0);
  await new Promise((r) => setTimeout(r, 6500));
  const expiredWrite = await gql(CREATE_MOVIE, { t: "ZZ Auth Expired" }, short);
  check("an expired token is rejected", refused(expiredWrite) && !expiredWrite.data?.createMovies, expiredWrite.text.slice(0, 80));

  // ---- the server on its own refuses unauthenticated writes (defence in depth) ----
  if (SERVER) {
    check("server directly: anonymous write refused", refused(await gql(CREATE_MOVIE, { t: "ZZ Auth Direct" }, undefined, SERVER)));
    check("server directly: forged token refused", refused(await gql(CREATE_MOVIE, { t: "ZZ Auth Direct" }, await forge({}), SERVER)));
    check("server directly: user cannot write the catalogue", refused(await gql(CREATE_MOVIE, { t: "ZZ Auth Direct" }, alice, SERVER)));
    check("server directly: editor can", (await gql(CREATE_MOVIE, { t: "ZZ Auth Direct" }, bob, SERVER)).data?.createMovies?.movies?.length === 1);
    await gql(DELETE_MOVIE, { t: "ZZ Auth Direct" }, bob, SERVER);
  } else {
    results.push("SKIP server-direct checks (set SERVER_URL to run them)");
  }
} finally {
  // cleanup anything left behind, as a moderator
  const mod = await login("carol");
  await gql(`mutation{ deleteMovies(where:{title:{startsWith:"ZZ Auth"}}){ nodesDeleted } deletePeople(where:{name:{startsWith:"ZZ Auth"}}){ nodesDeleted } }`, undefined, mod, SERVER ?? GRAPHQL);
}

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.filter((r) => r.startsWith("PASS")).length} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
