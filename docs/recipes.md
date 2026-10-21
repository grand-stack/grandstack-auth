# Recipes

Step-by-step changes. Commands run from the root of `grandstack-auth` with the auth stack up (`docker compose -f compose.yaml -f compose.auth.yaml up --build` in the `grandstack` repo) unless stated. Each recipe ends with how to check it.

## Add a role that can delete any review

Example: a `critic` role, like a moderator but only for reviews.

1. **Keycloak.** In `keycloak/grandstack-realm.json` add a realm role `critic` that includes `user`, and a user for it:
   ```json
   { "name": "critic", "description": "Can delete any review", "composite": true, "composites": { "realm": ["user"] } }
   ```
   Add a user in the `users` array with `"realmRoles": ["critic"]` and a password credential like the others. Add the role to the demo users' list in [keycloak.md](keycloak.md).
2. **Recreate Keycloak** so it imports the change ([how](keycloak.md#changing-the-realm)). On a first start there is nothing to recreate: the realm file is imported automatically.
3. **Gateway.** Nothing to change: the `critic` token also carries `user` (the role is composite), and that already grants `reviews:write`. If a role should *not* include `user`, add it to the map instead: set `ROLE_PERMISSIONS` on the gateway, or edit `DEFAULT_ROLE_PERMISSIONS` in `gateway/rules.ts` and its tests.
4. **Server rule.** The `Review` rule in `schema/auth.graphql` is **one filter shared by update and delete**, so adding the role to its `OR` would also let critics *edit* anyone's review. To allow only deleting, split it into one rule per operation and add the role to the delete rule only:
   ```graphql
   @authorization(
     filter: [
       { operations: [UPDATE], where: { OR: [{ node: { author: { sub: { eq: "$jwt.sub" } } } }, { jwt: { roles: { includes: "moderator" } } }] } }
       { operations: [DELETE], where: { OR: [{ node: { author: { sub: { eq: "$jwt.sub" } } } }, { jwt: { roles: { includes: "moderator" } } }, { jwt: { roles: { includes: "critic" } } }] } }
     ]
   )
   ```
   (If you do want critics to edit too, just add the role to the existing single rule.)
5. **Apply:** restart the server (it reads `auth.graphql` at startup): `docker compose -f compose.yaml -f compose.auth.yaml restart server`, then the gateway (it reads the server's schema at startup).
6. **Test:**
   - In `scripts/auth-smoke.mjs` add the new user next to the others (the line `const [alice, bob, carol] = await Promise.all([...].map((u) => login(u)))`) and write checks: the critic can write a review, **cannot edit** alice's review (assert the text is unchanged), **can delete** it, and cannot create, update or delete a movie, person or genre. Then `npm run smoke`.
   - Optionally add a critic case to `gateway/test/rules.test.ts` (a critic token is allowed `createReview` and refused `createMovies`; no gateway code changes, because the role includes `user`).
   - If the client should show a delete button for critics, do **not** reuse `isModerator` (critics are not moderators, and the playground uses it to predict editing). Add a separate helper such as `canDeleteAnyReview` in `client/src/auth/claims.ts` with tests, and use it in `client/src/pages/MovieDetail.tsx` only.
7. **Docs:** update the role tables in [how-it-works.md](how-it-works.md) and [role-and-scope-model.md](role-and-scope-model.md), and the demo users in [keycloak.md](keycloak.md).

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
