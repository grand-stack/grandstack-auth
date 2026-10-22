# Exercise: add authentication to grandstack-web

A follow-up task for a developer, or a coding agent, to do in **their own copy** of `grandstack-web`. `grandstack-web` itself stays an open, unauthenticated app on purpose; this exercise shows how to add login to an app like it, using the gateway, Keycloak and server rules from this repository.

> **Where to run this.** Docker Compose commands run inside a clone of the `grandstack` repository, with the repositories it builds cloned beside it: `git clone https://github.com/grand-stack/grandstack`, and the others the same way. The [quickstart](https://www.grandstack.ai/quickstart/) has the exact steps.

Time: about 2 to 3 hours if you write everything yourself; much less if you borrow from the demo client. The reference solution is about 20 files and 350 lines, which is a good size to aim for. Level: you know React and have read [how it works](how-it-works.md).

## Goal

With the auth stack running, your copy of the web app must:

1. show **Log in** when signed out and **Log out** plus the user's **name and role** when signed in (the name in an element with `data-testid="who-name"`);
2. send the access token to the gateway as `Authorization: Bearer ...`;
3. hide Add, Edit and Delete for users without the `catalog:write` permission, and keep every route that edits data from them: anonymous visitors are sent to the login page, signed-in users without the permission see a clear "you need the editor role" message;
4. show readable messages for 401 (not logged in or session expired) and 403 (role not allowed) instead of raw errors;
5. **still work exactly as before when auth is switched off** (`VITE_AUTH_ENABLED` unset or not `true`): no login controls, everything editable, the open-mode warning banner shown.

Out of scope for the core task: reviews (the [demo client](client.md) has them; a stretch goal below), production hardening.

## Before you start

- The auth stack runs: `docker compose -f compose.yaml -f compose.auth.yaml up --build` in the `grandstack` repo (client :3001, gateway :4000, Keycloak :8081). The realm and the gateway already allow the web app at `http://localhost:3000`: the Keycloak client `grandstack-auth-client` lists `http://localhost:3000/*` as a redirect URI and the gateway's CORS list includes port 3000.
- Do **not** edit `grandstack-web` in place. Make a clean copy next to it and work there:
  ```sh
  git -c advice.detachedHead=false clone --branch v0.5.0 grandstack-web grandstack-web-auth    # from the folder that holds the repos
  cd grandstack-web-auth && npm ci
  ```
- Read these first: [how it works](how-it-works.md), [the demo client](client.md) (it solves the same problem for a different app; you may borrow ideas, and the files in `client/src/auth/` are a good reference), and `src/App.tsx`, `src/main.tsx` and `src/forms/model.ts` in the web app.
- The test users are `alice` (user), `bob` (editor), `carol` (moderator); password is the name plus `-pass`.

## Step 0: see the problem

Open http://localhost:3000 in the running auth stack (the stock web app). Browse: it works. Try to add a movie: the form shows an error such as "Unauthenticated: log in to change data", because the app has no login and the gateway treats it as anonymous. Reading works because reads are public. That is the behaviour you are going to improve.

## Steps

Each step says what to build, a hint, and how to check it. Run `npm run typecheck` and `npm test` as you go.

### 1. Add the OIDC library

Add `oidc-client-ts` (it does the authorization code flow with PKCE).
*Check:* `npm ls oidc-client-ts`.

### 2. Settings from the environment, off by default

Create `src/auth/config.ts` that reads Vite environment variables: `VITE_AUTH_ENABLED` (auth is on only when it is exactly `true`), `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`, optional `VITE_OIDC_SCOPE` (default `openid profile`) and `VITE_OIDC_AUDIENCE` (needed by Auth0, harmless here). Reading the OIDC settings when auth is on but they are missing should throw a clear error.
*Hint:* take the environment as a parameter, defaulting to `import.meta.env`, so you can unit-test it without Vite. Declare the new variables in `src/vite-env.d.ts` so they are typed. The demo client's `client/src/auth/config.ts` is a good starting point, but it has no `VITE_AUTH_ENABLED`; that part is yours.
*Check:* unit tests for: off by default, on only for `"true"`, missing authority or client id, defaults.

### 3. Read the token

Create `src/auth/claims.ts`: decode the access token's payload (base64url, **UTF-8**) into an identity: `sub`, a display `name` (fall back through `name`, `preferred_username`, `email`, `sub`), `roles`, and `permissions`. Derive permissions from roles the way the gateway does ([role model](role-and-scope-model.md)): `user` gives `reviews:write`; `editor` and `moderator` also give `catalog:write`; also accept a `permissions` array in the token.
*Hint:* this is only for showing and hiding things; the server and gateway are what actually enforce access. You may copy `client/src/auth/claims.ts` and its tests from the demo client and adapt them.
*Check:* unit tests, including a non-ASCII name such as "Zoë Müller" (a naive `atob` breaks it).

### 4. Provide the login state

Create `src/auth/AuthProvider.tsx` with a React context and a `useAuth()` hook returning `{ enabled, loading, identity, login, logout, completeLogin, canWriteCatalog }`.
- When auth is **off**, provide a constant "open" value: `enabled: false`, `canWriteCatalog: true`, no-op login and logout.
- When it is **on**, create an `oidc-client-ts` `UserManager`: `redirect_uri` is `<origin>/callback`, `post_logout_redirect_uri` is `<origin>/`, `response_type: "code"`, your scope, and `extraQueryParams: { audience }` if configured. Turn `automaticSilentRenew` on. Keep the user in `sessionStorage` (`WebStorageStateStore`).
- Keep the current access token where the GraphQL client can read it (a module-level variable with a getter is enough). Update it when the user loads, unloads, or the token expires.
- `canWriteCatalog` is true when the token's permissions include `catalog:write` (always true when auth is off).
*Hint:* the demo client's `AuthProvider.tsx` has everything except the open mode and `canWriteCatalog`; writing those is real work. In open mode the provider must not read the OIDC settings or create a `UserManager`, because those variables will not be set.
*Pitfall:* `getUser()` can return an expired user; treat that as signed out.
*Check:* typecheck; you will see it working in step 6.

### 5. The callback route

The identity provider redirects to `/callback?code=...`. Add a `Callback` page and route that calls `signinRedirectCallback()`, then navigates to the path the user was on (store it in the sign-in `state` when you call `signinRedirect`).
*Pitfalls:* the authorization code is single-use and React StrictMode runs effects twice in development, so guard the call with a ref. The route needs the SPA fallback, which the nginx config already has.
*Check:* after login you land back on the page you came from, not on `/callback`.

### 6. Send the token

In `src/main.tsx` wrap the app in your provider, between `BrowserRouter` and `App` (the provider uses router hooks if you navigate from it, and everything below needs the context), and give the urql client a `fetchOptions` function that adds a bearer token when there is one:

```ts
fetchOptions: () => {
  const token = getAccessToken();
  return token ? { headers: { authorization: `Bearer ${token}` } } : {};
},
```
*Check:* once login works (step 7), creating a movie as bob succeeds, and as anonymous it fails.

### 7. Header: log in, log out, who am I

When auth is on and loading has finished, show **Log in** (calls `login()`) when signed out; when signed in show the name (with `data-testid="who-name"`), the roles you care about (`user`, `editor`, `moderator`) and **Log out**. Show nothing when auth is off.
*Check:* log in as alice: header shows "Alice Reader" and `user`; log out returns you to the app signed out.

### 8. Hide what the user cannot do

Use `canWriteCatalog` to hide: the header **Add** menu; **Add movie** on the results page; **Add person** on the people page; **Edit** and **Delete** on movie and person pages.
*Check:* as alice none of these appear; as bob they all do; with auth off they all appear. (The edit pages themselves need nothing extra here: step 9's guard covers them.)

### 9. Guard the routes

Direct links must not bypass the UI: wrap `/movies/new`, `/movies/:title/edit`, `/people/new` and `/people/:name/edit` in a guard component. With auth off render the page. While loading show a placeholder. If there is no identity, start the login from a `useEffect`, never during render, and not before loading has finished, or logged-in users get bounced. If the identity lacks the permission, render a message that includes the words "editor role" and a link back.
*Check:* anonymous opening `/movies/new` ends up on the Keycloak login page; alice opening it sees the message; bob sees the form.

### 10. Readable errors

Extend `friendlyError` in `src/forms/model.ts`. The raw messages the app sees look like `[GraphQL] Unauthenticated: log in to change data` and `[GraphQL] Forbidden: "createMovies" needs the "catalog:write" permission` (urql prefixes them), and a bare 401 or 403 can appear in a `[Network]` message. Messages mentioning `Unauthenticated` or 401 become "You need to log in (or your session expired) to do that."; `Forbidden` or 403 become "Your role does not allow that." Add unit tests.
*Check:* temporarily disable a guard and try a write as alice: you should see the readable message, not the raw GraphQL error.

### 11. The open-mode banner

`PublicEditBanner` says "No authentication yet". When auth is on, it should not appear. (The stock browser checks look for this banner in open mode, so they are a regression test for this step.)

### 12. Build and run it as a container

Add build arguments to your `Dockerfile` for `VITE_AUTH_ENABLED`, `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`, `VITE_OIDC_SCOPE`, `VITE_OIDC_AUDIENCE`, turn them into `ENV` before `npm run build` (Vite bakes them into the files), and default `VITE_AUTH_ENABLED` to `false`.

Create `compose.web-auth.yaml` in the `grandstack` repo, next to `compose.yaml` (it is yours; do not commit it to the shared repos), that points the `web` service at your copy. The path `../grandstack-web-auth` is relative to that folder, so run the compose commands from there:

```yaml
services:
  web:
    build:
      context: ../grandstack-web-auth
      args:
        VITE_AUTH_ENABLED: "true"
        VITE_OIDC_AUTHORITY: http://localhost:8081/realms/grandstack
        VITE_OIDC_CLIENT_ID: grandstack-auth-client
```

and run it with the auth stack:

```sh
docker compose -f compose.yaml -f compose.auth.yaml -f compose.web-auth.yaml up -d --build web
```

If the stack is already running and you only want to replace the web app, add `--no-deps` (`up -d --build --no-deps web`) so nothing else is recreated. If `docker` on your machine is Podman, start its machine first.

Open http://localhost:3000.

## Check your work

1. **Unit tests and types** in your copy: `npm run typecheck && npm test`.
2. **Acceptance check** (needs the stack running with your web app as above):
   ```sh
   cd ../grandstack-auth && npm ci && node e2e/exercise-check.mjs
   ```
   On Linux set `CHROME_PATH` (for example `/usr/bin/chromium`); `WEB_URL` and `GRAPHQL_URL` are the other settings.
   It logs in as anonymous, alice and bob in a real browser and checks the goal items: browsing, Log in/out controls, the Add menu, route guarding, the editor-role message, creating and deleting a movie with a token. It needs the hooks named in the goal: text "Log in" and "Log out", `data-testid="who-name"`, an "Add" menu button. It exits non-zero on failure.
3. **Open mode** still works. The stock browser checks (`npm run e2e` in your copy) write data as an anonymous user, so they can only pass against a stack that has **no auth rules**: the plain open stack, which also means a different, freshly seeded database. Stop the auth stack, build your copy without the auth build arguments (that is open mode, since `VITE_AUTH_ENABLED` defaults to `false`), and run it on the open stack:
   ```sh
   # in grandstack/, create compose.web-open.yaml:  services: { web: { build: { context: ../grandstack-web-auth } } }
   docker compose -f compose.yaml -f compose.auth.yaml down -v
   docker compose -f compose.yaml -f compose.web-open.yaml up -d --build
   cd ../grandstack-web-auth && npm run e2e      # all 78 checks should pass
   ```
   They include "public edit banner shown" and the Add, Edit and Delete controls, so they regress steps 8 and 11. If the run stops at the first create with a 401, you are still talking to the auth gateway. With auth off you should see no login controls.
4. **By hand:** log in as each user and compare with the table in [how it works](how-it-works.md#what-is-allowed).

## Pitfalls checklist

- The redirect URI and the web origin must match exactly what the realm allows (`http://localhost:3000/*`); a mismatch shows "Invalid parameter: redirect_uri" on the Keycloak page.
- The callback code is single-use: reloading `/callback` fails. Go to `/` and log in again.
- Do not log tokens or put them in URLs. Session storage is readable by scripts on the page; that is the trade-off of an SPA ([notes](keycloak.md#not-for-production)).
- Hiding buttons is not security. If you remove the gateway and server rules, the API is open again no matter what the UI shows. Test with the playground in the demo client or with `npm run smoke` that the rules still hold.
- The app must keep working with auth off: no `useAuth` code path may assume a logged-in user.
- Environment variables are baked in at build time: change them, rebuild.

## Stretch goals

- Show and manage **reviews** on the movie page: the server schema already has them (`createReview`, `updateReviews`, `deleteReviews`); copy the approach from `client/src/pages/MovieDetail.tsx`. Remember `reviews` exist only in the auth stack, so the page must tolerate their absence when auth is off.
- Extend your copy's `e2e/run.mjs` with the login flows from `e2e/run.mjs` in this repo.
- Show a friendly "session expired, log in again" state when silent renewal fails.
- Run the same app against an **Auth0** tenant using [auth0.md](auth0.md) (untested).

## Compare with the reference solution (spoiler)

`exercise/reference-solution.patch` in this repo contains one complete solution as a patch against `grandstack-web` v0.5.0: 20 files, about 350 lines. Try the exercise first. When you are done, or stuck, read it with `git apply --stat exercise/reference-solution.patch` (summary) or open the file. `npm run verify-exercise` applies it to a clean checkout and confirms it type-checks, passes its tests and builds, so it stays valid.
