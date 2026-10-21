# Troubleshooting

Problems we actually hit, with causes and fixes.

## Setup and startup

| Symptom | Cause and fix |
| --- | --- |
| Gateway container exits right after starting, log says `connect ECONNREFUSED ...:4000` while "Loading schema" | The gateway reads the server's schema at startup and the server was not ready. `compose.auth.yaml` makes the gateway wait for the server's healthcheck; if you start it by hand, start the server first. |
| Changes to `keycloak/grandstack-realm.json` have no effect | Keycloak imports the realm only when it does not exist. Recreate the container: `docker compose -f compose.yaml -f compose.auth.yaml rm -sf keycloak` then `up -d keycloak`. |
| Tokens have no `sub` | The client lacks the `basic` client scope. The realm file includes it; check any custom client you add. |
| Keycloak takes a while | First start imports the realm and takes about 20 seconds; other services wait for its healthcheck. |
| Nothing listens on 3001 / 4000 / 8081 | Another process owns the port. Check with `lsof -nP -iTCP:4000 -sTCP:LISTEN` and change the left side of the port mapping. On the machine this was built on, a local Neo4j also owned `127.0.0.1:7687`. |
| Gateway fails at startup `Missing required environment variable AUTH_...` | Set `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE` and `UPSTREAM_URL` on the gateway. |
| Gateway fails at startup `ROLE_PERMISSIONS must be a JSON object...` | The variable must be a JSON object of role to an array of permission strings. |

## Tokens are rejected though they look fine

1. **Compare the claims with the settings.** Decode the token (`cut -d. -f2 | base64 -d`, or jwt.io) and compare `iss` and `aud` with `AUTH_ISSUER` and `AUTH_AUDIENCE`, character for character.
2. **Issuer versus key address.** `AUTH_ISSUER` is the address in the token (`http://localhost:8081/realms/grandstack`); `AUTH_JWKS_URL` is where the *services* fetch keys (`http://keycloak:8080/...`). Using `localhost:8081` as the JWKS URL inside a container fails because `localhost` is the container itself.
3. **Clock or expiry.** Access tokens last 5 minutes in the dev realm. An expired token gets `Unauthenticated`.
4. **Unknown key id.** A token signed by a key that is not in the JWKS (forged, or from before a key rotation) gets a clean 401. (By default the gateway library answers 500 "Authentication is not available" for this; `gateway.config.ts` converts that case to 401.)

## Responses that surprise people

| Symptom | Explanation |
| --- | --- |
| Editing or deleting someone else's review "succeeds" but nothing changes | Intended: row-level rules are filters, so the row is not matched (`nodesDeleted: 0`). It is not an error. |
| The unchanged web app shows an error on every create, edit and delete | Intended: it has no login, so through the gateway it is an anonymous client. Reading works. See the [exercise](exercise-add-auth-to-grandstack-web.md). |
| `Forbidden: "x" needs the "catalog:write" permission` | The token's roles do not give that permission. Check the role (`/playground` shows your permissions). |
| `Forbidden: mutation "x" is not allowed through the gateway` | The mutation is not in `MUTATION_PERMISSIONS` in `gateway/rules.ts`; unknown mutations are refused. |
| `createReview` returns `null` | The rating is not 1 to 10, or the movie title does not exist. The mutation returns null instead of an error. |

## Server and schema errors (from the Neo4j GraphQL library)

| Symptom | Cause and fix |
| --- | --- |
| `There is no procedure with the name apoc.util.validate` | An `@authorization` `validate` rule needs the APOC plugin. This repo uses `filter` rules instead. |
| `Unknown function 'apoc.date.convertFormat'` | Reading a `DateTime` field needs APOC. `Review.createdAt` is stored as an ISO string for this reason. |
| Startup `Invalid argument: validate, error: Expected type to be an object` | Rule `where` clauses must use operators: `sub: { eq: "$jwt.sub" }`. |
| More in the server's `docs/troubleshooting.md` and `docs/schema-guide.md` | `@unique`, `extend type Mutation`, nullable relationship fields. |

## The demo client and Keycloak login

| Symptom | Cause and fix |
| --- | --- |
| Keycloak page says `Invalid parameter: redirect_uri` | The client's redirect URI is not registered. The realm allows `http://localhost:3001/*` and `http://localhost:3000/*`; the app must be served from one of those origins. |
| `Login failed: No matching state found in storage` | You reloaded `/callback` or opened it in another tab. The code is single-use and the state lives in `sessionStorage` of the original tab. Go to `/` and log in again. |
| Browser console: CORS error from the gateway | The page's origin is not in the gateway's `CORS_ORIGIN` (default `http://localhost:3000,http://localhost:3001`). |
| Logged out unexpectedly | The access token lasted 5 minutes and silent renewal did not succeed; log in again. (Renewal over long sessions is not covered by the tests.) |
| After login the playground shows no permissions | The token has no `roles` claim: the client must use a client that has the roles mapper (`grandstack-auth-client` does). |
