# Auth0 (written, not tested)

> **Untested.** This guide follows from how Auth0 works and from the provider-agnostic settings in this repository, but nobody has run it against a real Auth0 tenant yet. Treat it as a starting point and expect to adjust. If you try it, please fix this page with what you learn.

You need an Auth0 developer tenant. Everything below is configuration; no code changes.

## 1. Auth0 setup

1. **API.** Create an API (Applications > APIs). Its *Identifier* is your audience, for example `grandstack-api`. Set *Allow Offline Access* if you want refresh tokens.
2. **Permissions and RBAC.** In the API, enable *RBAC* and *Add Permissions in the Access Token*. Add the permissions `catalog:write` and `reviews:write`. The gateway reads a `permissions` claim natively, so no role mapping is needed there.
3. **Roles.** Create roles `user`, `editor` and `moderator` (User Management > Roles) and attach permissions: `user` gets `reviews:write`; `editor` gets both; `moderator` gets both. Assign roles to test users.
4. **Application.** Create a *Single Page Application*. Allowed Callback URLs: `http://localhost:3001/callback`. Allowed Logout URLs and Allowed Web Origins: `http://localhost:3001`. Note the Domain and Client ID.
5. **A `roles` claim for the server's row rules.** Auth0 does not put roles in access tokens by default. Add a post-login Action that adds a namespaced claim, for example:
   ```js
   exports.onExecutePostLogin = async (event, api) => {
     api.accessToken.setCustomClaim("https://grandstack.example/roles", event.authorization?.roles ?? []);
   };
   ```
   Then point the schema at it: in `schema/auth.graphql` change `@jwtClaim(path: "roles")` to `@jwtClaim(path: "https://grandstack\\.example/roles")` (dots in a claim name are escaped), and make `permissionsFromClaims` in `gateway/rules.ts` read the same claim if you also want role-based permissions.

## 2. Stack settings

Replace the Keycloak values in `compose.auth.yaml` (in the `grandstack` repo):

| Setting | Auth0 value |
| --- | --- |
| `AUTH_JWKS_URL` (server and gateway) | `https://YOUR_TENANT.auth0.com/.well-known/jwks.json` |
| `AUTH_ISSUER` (server and gateway) | `https://YOUR_TENANT.auth0.com/` (note the trailing slash) |
| `AUTH_AUDIENCE` (server and gateway) | the API identifier from step 1 |
| `VITE_OIDC_AUTHORITY` (client build arg) | `https://YOUR_TENANT.auth0.com` |
| `VITE_OIDC_CLIENT_ID` (client build arg) | the Client ID from step 4 |
| `VITE_OIDC_SCOPE` | `openid profile email` |
| `VITE_OIDC_AUDIENCE` | the API identifier |

The Keycloak service is not needed; remove it and the `depends_on` entries that name it. `GATEWAY CORS_ORIGIN` stays `http://localhost:3001` (and 3000 if you add login to `grandstack-web`).

## 3. What to check

- Log in through the Auth0 Universal Login page and come back to the demo client.
- The playground shows the permissions from your token; try a user with and without `catalog:write`.
- Anything refused for the wrong reason: decode the token and compare `iss`, `aud` and the claims with the values above ([troubleshooting](troubleshooting.md#tokens-are-rejected-though-they-look-fine)).
- The smoke script uses Keycloak's password grant, so it does not apply as is; see [swapping providers](swapping-providers.md).
