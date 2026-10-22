# The demo client

`client/` is a small React app (Vite, urql, `oidc-client-ts`) that shows the auth setup working. It is **separate from `grandstack-web`**, which stays an open, unauthenticated app. It runs on http://localhost:3001 in the auth stack.

> **Where to run this.** Commands on this page that start with `npm`, `node` or `docker build` run inside a clone of this repository: `git clone https://github.com/grand-stack/grandstack-auth`, then `cd grandstack-auth` (Node 22 or later; run `npm ci` once). Commands that need the running stack use the `grandstack` repository's compose files: see the [quickstart](https://www.grandstack.ai/quickstart/).

## What it does

- **Log in and out** through the identity provider (authorization code flow with PKCE). The header shows your name and role.
- **Movies and reviews:** browse movies (public); logged-in users write reviews, edit and delete their own; moderators can delete any review.
- **Permissions playground** (`/playground`): buttons that try protected actions as whoever you are logged in as (create a movie, delete a movie, write a review, edit someone else's review, look for a way to spoof the author). Each card says what the rules predict, runs the request, shows the HTTP status and response, and tells you whether the result matched. Log in as alice, bob and carol to compare.
- Anonymous visitors can read everything and use the playground, where write attempts are refused.

## Configuration (build time)

| Variable | Default in the compose file | Purpose |
| --- | --- | --- |
| `VITE_GRAPHQL_URL` | `http://localhost:4000/graphql` | The gateway, as the browser reaches it |
| `VITE_OIDC_AUTHORITY` | `http://localhost:8081/realms/grandstack` | OIDC issuer URL (discovery is at `/.well-known/openid-configuration`) |
| `VITE_OIDC_CLIENT_ID` | `grandstack-auth-client` | The registered public client |
| `VITE_OIDC_SCOPE` | `openid profile` | Scopes to request |
| `VITE_OIDC_AUDIENCE` | none | Extra `audience` parameter some providers need (Auth0) |

These are baked into the static files, so changing them means rebuilding the image. `src/auth/config.ts` throws a clear error at startup if the authority or client id is missing.

## How login works

1. **Log in** calls `signinRedirect`, remembering the current path. The browser goes to the provider with a PKCE challenge.
2. After login the provider redirects to `/callback?code=...`. `pages/Callback.tsx` calls `signinRedirectCallback`, which exchanges the code for tokens and returns the remembered path. (The code can be used once, so reloading `/callback` fails; go back to `/` and log in again.)
3. The access token is kept by the library in **`sessionStorage`**, so it lasts for the tab and is readable by scripts on the page (a known trade-off for single-page apps; see [Keycloak, not for production](keycloak.md#not-for-production)).
4. `lib/urqlClient.ts` adds `Authorization: Bearer <token>` to every request. `automaticSilentRenew` is on; when the session ends, the app drops to the signed-out state.
5. **Log out** clears the token and redirects through the provider's logout back to `/`.

The client only *decodes* the token (`src/auth/claims.ts`) to show the name and decide which buttons to show. That is for convenience; the gateway and server verify the token and make the real decisions. `ROLE_PERMISSIONS` in `claims.ts` mirrors the gateway's default map; keep them in step, or rely on a `permissions` claim.

## Files

```
src/auth/config.ts         reads the OIDC settings
src/auth/claims.ts         decodes a token, derives permissions   (+ tests)
src/auth/AuthProvider.tsx  oidc-client-ts UserManager, login, logout, callback
src/lib/urqlClient.ts      urql client with the bearer token
src/lib/errors.ts          readable messages for 401/403, review validation   (+ tests)
src/pages/                 Movies, MovieDetail (reviews), Playground, Callback
src/ui, src/poster, src/theme, src/styles.css, src/lib/hash.ts, initials.ts   copied from grandstack-web
src/graphql/generated/     typed operations from codegen
```

The files in the last two groups marked "copied" are **copies** of `grandstack-web` files, not shared packages, so they can drift; the app is small enough that this is acceptable.

## Run and develop

With the auth stack running (`docker compose -f compose.yaml -f compose.auth.yaml up --build` in the `grandstack` repo): open http://localhost:3001.

To work on the client against the running stack:

```sh
cd client
npm ci
npm run codegen   # types from the gateway's schema; needs the stack running
npm run dev       # http://localhost:3001, with the same defaults
npm run typecheck && npm test
```

Use the realm's demo users (`alice`, `bob`, `carol`; password is the name plus `-pass`).

## Adding auth to the other app

`grandstack-web` has none of this on purpose. [exercise-add-auth-to-grandstack-web.md](exercise-add-auth-to-grandstack-web.md) walks through adding it, using this client as the reference.
