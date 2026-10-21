# Recipes

Step-by-step changes. Commands run from the root of `grandstack-auth` with the auth stack up (`docker compose -f compose.yaml -f compose.auth.yaml up --build` in the `grandstack` repo) unless stated. Each recipe ends with how to check it.

## Add a role that can delete any review

Example: a `critic` role, like a moderator but only for reviews.

1. **Keycloak.** In `keycloak/grandstack-realm.json` add a realm role `critic` that includes `user`, and a user for it:
   ```json
   { "name": "critic", "description": "Can delete any review", "composite": true, "composites": { "realm": ["user"] } }
   ```
   Add a user in the `users` array with `"realmRoles": ["critic"]` and a password credential like the others. Add the role to the demo users' list in [keycloak.md](keycloak.md).
2. **Recreate Keycloak** so it imports the change ([how](keycloak.md#changing-the-realm)).
3. **Gateway.** Nothing to change: the `critic` token also carries `user` (the role is composite), and that already grants `reviews:write`. If a role should *not* include `user`, add it to the map instead: set `ROLE_PERMISSIONS` on the gateway, or edit `DEFAULT_ROLE_PERMISSIONS` in `gateway/rules.ts` and its tests.
4. **Server rule.** In `schema/auth.graphql`, add the role to the `Review` filter's `OR`:
   ```graphql
   { jwt: { roles: { includes: "critic" } } }
   ```
5. **Apply:** restart the server (it reads `auth.graphql` at startup): `docker compose -f compose.yaml -f compose.auth.yaml restart server`, then the gateway (it reads the server's schema at startup).
6. **Test:** add the new user to the `login` list and write checks in `scripts/auth-smoke.mjs` (the critic can delete a review written by alice; the critic still cannot create a movie), then `npm run smoke`. If the client should show a delete button for critics, update `isModerator` in `client/src/auth/claims.ts` and its tests.
7. **Docs:** update the table in [how-it-works.md](how-it-works.md) and [role-and-scope-model.md](role-and-scope-model.md).

## Protect a new mutation

1. Add the mutation to the server schema (or an extension file) and, if it changes data, a row rule in `schema/auth.graphql`.
2. Add its field name to `MUTATION_PERMISSIONS` in `gateway/rules.ts` with the permission it needs. **Without this the gateway refuses it** (default deny).
3. Add a unit test in `gateway/test/rules.test.ts` and checks in `scripts/auth-smoke.mjs`.
4. Rebuild the gateway: `docker compose -f compose.yaml -f compose.auth.yaml up -d --build gateway`.

## Change who can do what at the gateway

Permissions per role are `DEFAULT_ROLE_PERMISSIONS` in `gateway/rules.ts`. To change them without editing code, set the gateway's `ROLE_PERMISSIONS` environment variable in `compose.auth.yaml` (JSON, role to array of permissions). The permission needed by each mutation is `MUTATION_PERMISSIONS`. Keep `client/src/auth/claims.ts` in step if you want the client's buttons to match.

## Add a demo user

Add an entry to `users` in `keycloak/grandstack-realm.json` (copy `alice`), then recreate Keycloak ([how](keycloak.md#changing-the-realm)). For a quick, non-permanent user use the admin console at http://localhost:8081 (`admin` / `admin`); it is lost when the container is recreated.

## Change the token lifetime

In `keycloak/grandstack-realm.json`, `accessTokenLifespan` (seconds) sets it for the realm; a client can override with the attribute `access.token.lifespan` (the `grandstack-smoke-expiring` client does this with 5). Recreate Keycloak to apply.

## Before you commit

```sh
(cd gateway && npm test && npm run typecheck)
(cd client && npm test && npm run typecheck)
npm run docs:check
# with the stack running:
npm run smoke && npm run e2e
```
