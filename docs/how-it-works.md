# How authentication and authorization work

This repository adds login and access rules to GRANDstack without changing `grandstack-web`. It is opt-in: the default stack stays open, and `compose.auth.yaml` in the `grandstack` repository turns auth on.

Applies to grandstack-auth v0.1.1 with grandstack-server v0.7.1, Keycloak 26.8, Hive Gateway 2.15.

## The pieces

[![With auth on, the browser logs in at Keycloak, sends tokens to the gateway which validates them and checks permissions, the gateway forwards the header to the server which verifies again and applies row rules, and the server is reachable only through the gateway.](diagrams/auth-architecture.svg)](diagrams/auth-architecture.svg)

*Figure: the auth setup. Every write passes two independent checks, and the server is only reachable through the gateway. Click the image for full size; the numbered notes below carry the same information as text.*

1. **Two addresses.** The token's issuer (`iss`) is the browser-facing `http://localhost:8081/realms/grandstack` because Keycloak runs with `KC_HOSTNAME`; the gateway and server fetch public keys from `http://keycloak:8080/...`, which works inside the compose network. Mixing them up is the most common setup mistake.
2. **Gateway: the coarse check.** Validates signature, expiry, issuer and audience, then checks the permission each mutation needs (`gateway/rules.ts`), refusing anything unknown by default.
3. **Server: the fine check.** Verifies the token again with the same keys, then applies `@authentication` (roles) and `@authorization` (row filters) from `schema/auth.graphql`.
4. **Not published.** The server has no host port in the auth setup. Even a direct call without a valid token is refused.
5. **The unchanged web app.** `grandstack-web` has no login, so through the gateway it is an anonymous client: reads work, writes are refused.
6. **Refusals at the gateway.** 401 for no or bad token on a write (including a token signed with an unknown key id), 403 for a missing permission, and unknown mutations are refused.

| Piece | Where | Job |
| --- | --- | --- |
| Keycloak | `keycloak/grandstack-realm.json`, image `quay.io/keycloak/keycloak` | Logs users in and signs access tokens. Development realm with demo users. |
| Gateway | `gateway/` (`gateway.config.ts`, `rules.ts`) | The public GraphQL endpoint. Validates tokens, enforces coarse permissions per mutation. |
| Server rules | `schema/auth.graphql` | `User` and `Review` types and the row-level `@authentication`/`@authorization` rules. Loaded into `grandstack-server`. |
| Demo client | `client/` | A small app that logs in, writes reviews and lets you try protected actions. |
| Compose override | `compose.auth.yaml` in the `grandstack` repo | Starts Keycloak, the gateway and the client, and stops publishing the server. |

## Two checks on purpose

The **gateway** is the front door: it rejects bad tokens and applies permissions by operation. The **server** verifies the token again and applies rules by row. The server is not published to the host in the auth setup, but even if someone reached it directly it would still refuse unauthenticated writes and still apply the row rules (the smoke script proves this by calling it from inside the network).

## What is allowed

Reads are public. Writes need a token.

| | Anonymous | `user` (alice) | `editor` (bob) | `moderator` (carol) |
| --- | --- | --- | --- | --- |
| Read movies, people, reviews | yes | yes | yes | yes |
| Write a review (`createReview`) | no (401) | yes | yes | yes |
| Edit or delete **your own** review | no | yes | yes | yes |
| Edit or delete **someone else's** review | no | nothing changes | nothing changes | yes |
| Create, edit, delete movies, people, genres | no (401) | no (403) | yes | yes |

"Nothing changes" is deliberate: row-level rules are `filter` rules, so a review that is not yours is simply not matched and the mutation affects zero rows, with no error. Roles are cumulative in Keycloak (moderator includes editor includes user). More detail in [the role and permission model](role-and-scope-model.md).

## A request, step by step

[![A login with PKCE, then bob (editor) creates a movie and it succeeds, alice (user) makes the same call and the gateway answers 403 without calling the server, and alice editing a review she did not write returns an empty result because the row filter matches nothing.](diagrams/login-and-protected-write.svg)](diagrams/login-and-protected-write.svg)

*Figure: login, an allowed write, a write refused at the gateway, and a write filtered out at the server. Click the image for full size; the numbered notes below carry the same information as text.*

1. **Login once.** Authorization code with PKCE at Keycloak; the access token carries `sub`, the name and the `roles`.
2. **Allowed.** Bob's roles imply `catalog:write`, so the gateway forwards the same `Authorization` header; the server verifies it again and requires the `editor` role.
3. **Refused at the gateway.** Alice has no `catalog:write`: 403, and the server is never called.
4. **Filtered at the server.** `updateReviews` is allowed (alice has `reviews:write`), but the review's author is not alice and she is not a moderator, so the row filter matches nothing: 200 with an empty list and no change.

## What the responses look like

| Situation | Where it is decided | Response |
| --- | --- | --- |
| No token, mutation | gateway | HTTP 401, `Unauthenticated: log in to change data` |
| Token without the permission | gateway | HTTP 403, `Forbidden: "createMovies" needs the "catalog:write" permission` |
| Bad signature, wrong issuer or audience, expired, unknown key id | gateway | HTTP 401 `Unauthenticated` |
| Not the review's author | server | HTTP 200, nothing changed (`nodesDeleted: 0` or no reviews returned) |
| A mutation the gateway does not know about | gateway | HTTP 403, refused by default |

## A token, and why the addresses differ

Keycloak puts the user's id (`sub`), name, and a `roles` claim (realm roles) in the access token, and the audience `grandstack-api`. The **issuer** in the token is the browser-facing address, `http://localhost:8081/realms/grandstack`, because Keycloak is started with `KC_HOSTNAME=http://localhost:8081`; that keeps `iss` identical whether a token was requested from your browser or from another container. The **gateway and server fetch the public keys** from `http://keycloak:8080/realms/grandstack/protocol/openid-connect/certs`, the address that works inside the compose network. Those two addresses are different on purpose, and mixing them up is the most common setup mistake (see [troubleshooting](troubleshooting.md)).

## Using the API with a token

```sh
TOKEN=$(curl -s -X POST localhost:8081/realms/grandstack/protocol/openid-connect/token \
  -d grant_type=password -d client_id=grandstack-smoke -d username=alice -d password=alice-pass -d scope=openid \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

curl -s localhost:4000/graphql -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"query":"mutation { createReview(movie:\"Inception\", rating:9, text:\"Great\") { id author { name } } }"}'
```

(The `grandstack-smoke` client allows the password grant for tests. Real apps use the authorization code flow, as the demo client does.)

## The unchanged web app

`grandstack-web` is not modified by this project. In the auth setup it still runs on port 3000 and still calls `http://localhost:4000/graphql`, which is now the gateway, so it behaves as an **anonymous** client: reading works, and any create, edit or delete is refused and shown as an error. That is expected. Adding login to it is a follow-up exercise: [exercise-add-auth-to-grandstack-web.md](exercise-add-auth-to-grandstack-web.md).

## Not for production

Keycloak runs in development mode with known passwords, plain HTTP, no rate limiting and an in-container database. Tokens in the demo client live in `sessionStorage`. See [Keycloak](keycloak.md#not-for-production) for what to change before a real deployment.
