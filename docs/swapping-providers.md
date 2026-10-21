# Using a different OpenID Connect provider

Nothing in the gateway, server or demo client is specific to Keycloak: they use standard OpenID Connect and JWTs. To use another provider (Auth0, Okta, Entra ID, ...), change configuration, not code. Checklist:

| What | Setting | Notes |
| --- | --- | --- |
| Issuer | `AUTH_ISSUER` (gateway **and** server) | Exactly the token's `iss`, including any trailing slash (Auth0 issuers end with `/`). |
| Audience | `AUTH_AUDIENCE` (gateway and server) | The API identifier the token is issued for. The client must request it (`VITE_OIDC_AUDIENCE` for Auth0). |
| Public keys | `AUTH_JWKS_URL` (gateway and server) | The provider's JWKS URL, reachable from the containers. |
| Where roles are | `@jwtClaim(path: "roles")` in `schema/auth.graphql`, and `roles` in `gateway/rules.ts` | Providers name or namespace the claim differently (Auth0 requires a namespaced custom claim added by an Action). Change the claim path in the schema and, if needed, read your claim in `permissionsFromClaims`. |
| Permissions | the gateway reads `permissions` and `scope` claims too | If your provider emits `catalog:write` and `reviews:write` as permissions, you do not need roles at the gateway. |
| Client | `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`, `VITE_OIDC_SCOPE`, `VITE_OIDC_AUDIENCE` | Register the app as a single-page app (public client, authorization code with PKCE). Allowed callback URLs: `<origin>/callback`; allowed logout URL and web origin: the origin. |
| CORS | `CORS_ORIGIN` on the gateway | List every browser origin that calls it. |

Then run `npm run smoke` (token-level checks) against your setup. The smoke script gets its tokens from Keycloak's password grant, so for another provider replace the `login` function in `scripts/auth-smoke.mjs` with how you get test tokens (a test user and a client that allows it), and keep the assertions.

The Auth0 version of this checklist, written but **not tested**, is in [auth0.md](auth0.md).
