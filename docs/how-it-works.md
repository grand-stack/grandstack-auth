# How authentication and authorization work

This repository adds login and access rules to GRANDstack without changing `grandstack-web`. It is opt-in: the default stack stays open, and `compose.auth.yaml` in the `grandstack` repository turns auth on.

Applies to grandstack-auth v0.1.0 with grandstack-server v0.7.0, Keycloak 26.8, Hive Gateway 2.15.

## The pieces

```
 Browser (demo client :3001, or any client)
   |  OIDC login (authorization code + PKCE)         Authorization: Bearer <access token>
   v                                                   |
 Keycloak :8081  ----------------------------+         v
 (dev realm, demo users)                     |     Gateway :4000   (Hive Gateway, proxy mode)
   ^                                         |       - validates the token (JWKS, exp, iss, aud)
   | JWKS (public keys)                      |       - refuses mutations the token has no permission for
   +---------------------+-------------------+       - forwards the Authorization header
                         |                                    |
                         v                                    v
                   Server (not published to the host)  <------+
                   - verifies the token again (JWKS)
                   - applies row-level rules from schema/auth.graphql
                         |
                         v
                      Neo4j
```

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
