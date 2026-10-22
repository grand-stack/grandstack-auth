# Testing

Four layers. The first two need nothing running; the last two need the auth stack (`docker compose -f compose.yaml -f compose.auth.yaml up --build` in the `grandstack` repo).

> **Where to run this.** Commands on this page that start with `npm`, `node` or `docker build` run inside a clone of this repository: `git clone https://github.com/grand-stack/grandstack-auth`, then `cd grandstack-auth` (Node 22 or later; run `npm ci` once). Commands that need the running stack use the `grandstack` repository's compose files: see the [quickstart](https://grandstack.ai/quickstart/).

## 1. Unit tests

| Where | Command | Covers |
| --- | --- | --- |
| `gateway/` | `npm ci && npm test` (and `npm run typecheck`) | The permission rules: mutation root fields (aliases, fragments, named operations), permissions from roles, `permissions` and `scope` claims, default deny, custom role maps, `ROLE_PERMISSIONS` validation |
| `client/` | `npm ci && npm test` | Token decoding (UTF-8 names), permission derivation, OIDC config validation, error messages, review validation |

## 2. Server config tests

In `grandstack-server`: `npm test` covers the `AUTH_*` all-or-nothing validation, `SCHEMA_EXTRA_PATHS` and `SETUP_CYPHER_PATHS`.

## 3. Token-level smoke test: `scripts/auth-smoke.mjs`

No browser. It logs in as the demo users alice, bob and carol with the password grant and calls the API, checking the whole rule matrix (add a user to the `const [alice, bob, carol] = ...` line to test another role):

- anonymous reads work; anonymous writes are refused;
- a user can write and edit their own review but cannot change the catalogue;
- **a non-author cannot edit or delete a review and nothing changes** (it checks the state, not just the response), and the author link cannot be edited through a review;
- the generated `createReviews` does not exist, and an invalid rating or unknown movie creates nothing;
- an editor can create, update and delete movies; a moderator can delete anyone's review;
- a token signed by another key, a tampered payload, garbage, and an **expired** token (from a client whose tokens last 5 seconds) are all refused;
- with `SERVER_URL`, the **server called directly** (bypassing the gateway) refuses anonymous and forged writes and still applies the rules.

```sh
npm ci
npm run smoke                      # through the gateway
```

To include the direct-to-server checks, the script must run where it can reach the (unpublished) server, so run it inside the compose network (this adds a few checks):

```sh
docker run --rm --network grandstack_default -v "$PWD:/app" -w /app \
  -e GRAPHQL_URL=http://gateway:4000/graphql -e SERVER_URL=http://server:4000/graphql \
  -e KEYCLOAK_URL=http://keycloak:8080 docker.io/library/node:24-slim node scripts/auth-smoke.mjs
```

(`grandstack_default` is the network compose creates for a project named `grandstack`, which is the name of the folder you run compose from. Find yours with `docker network ls | grep _default`, or start compose with `COMPOSE_PROJECT_NAME=grandstack`.) Variables: `GRAPHQL_URL`, `SERVER_URL`, `KEYCLOAK_URL` (where to get tokens), `AUTH_ISSUER` (the `iss` the services expect, used to forge tokens). The script creates data named `ZZ Auth ...` and removes it. It exits non-zero on any failure.

## 4. Browser end-to-end: `e2e/run.mjs`

Drives real Chrome through the demo client, including the **real Keycloak login page**:

- anonymous: movies visible, "log in to review" shown, playground refuses writes;
- alice: logs in (name and role shown, session in `sessionStorage` only), writes and edits a review, playground matches her role, logs out;
- bob: editor playground results, no delete button on alice's review;
- carol: deletes alice's review as a moderator;
- the **unchanged `grandstack-web`** against the gateway: reads work, a create fails with a readable error, nothing is created.

```sh
npm ci
OUT=/tmp/shots npm run e2e     # OUT is optional: screenshots go there
```

Variables: `CLIENT_URL` (default `http://localhost:3001`), `WEB_URL` (`http://localhost:3000`), `GRAPHQL_URL`, `CHROME_PATH` (set it on Linux), `OUT`. Each scenario starts a fresh browser: in the environment this was built in, headless Chrome died after about 14 page loads in one session. It exits non-zero on failure.

## What is not tested

- **Silent token renewal over a long session** is configured (`automaticSilentRenew`) but the browser checks run well inside the 5-minute token lifetime. Expiry is covered at the token level by the smoke script, not in the browser.
- **Auth0** ([auth0.md](auth0.md)) has not been run against a real tenant.
- CI runs the unit tests, builds and the link check; it does not start the stack.
