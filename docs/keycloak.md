# The Keycloak development realm

`keycloak/grandstack-realm.json` is imported when Keycloak starts. It defines everything the stack needs, so there is nothing to click in the admin console.

> **Where to run this.** Docker Compose commands run inside a clone of the `grandstack` repository, with the repositories it builds cloned beside it: `git clone https://github.com/grand-stack/grandstack`, and the others the same way. The [quickstart](https://grandstack.ai/quickstart/) has the exact steps.

## What is in it

| Item | Value |
| --- | --- |
| Realm | `grandstack` |
| Roles | `user`, `editor` (includes user), `moderator` (includes editor). New users get `user`. |
| Demo users | `alice` (user), `bob` (editor), `carol` (moderator). Password is the username plus `-pass`, for example `alice-pass`. |
| Client `grandstack-auth-client` | Public client for browser apps. Authorization code flow with PKCE (S256). Redirect URIs `http://localhost:3001/*` and `http://localhost:3000/*`, web origins the same. This is the client the demo client uses. |
| Client `grandstack-smoke` | Allows the password grant, for the smoke script and `curl` examples. Development only. |
| Client `grandstack-smoke-expiring` | Same, with a 5 second access token lifetime, to test expiry. |
| Token claims | `sub`, `name`, `preferred_username`, `email`, `roles` (realm roles), and audience `grandstack-api`. |
| Token lifetime | 5 minutes (access token); SSO session idle 30 minutes. |

Keycloak admin console: http://localhost:8081, user `admin`, password `admin`.

## How it is started

In `compose.auth.yaml` (the `grandstack` repo): image `quay.io/keycloak/keycloak:26.8.1`, command `start-dev --import-realm`, the realm file mounted into `/opt/keycloak/data/import/`, and:

- `KC_HOSTNAME=http://localhost:8081` fixes the **issuer** of every token to the browser-facing address, whichever address the token was requested from.
- `KC_HTTP_ENABLED=true` because dev mode uses plain HTTP.
- `KC_HEALTH_ENABLED=true` and a healthcheck on the management port (9000), so other services wait until Keycloak is ready. It is up in about 20 seconds.

## Changing the realm

Keycloak imports the file only when the realm **does not exist yet** (strategy "ignore existing"). Edits to the JSON are ignored by a Keycloak that has already imported it. Recreate the container so it starts from scratch:

```sh
docker compose -f compose.yaml -f compose.auth.yaml rm -sf keycloak
docker compose -f compose.yaml -f compose.auth.yaml up -d keycloak
```

On a **first** start nothing needs recreating: the file is imported automatically. The development database lives inside the container, so anything you create in the admin console is lost when the container is recreated; put lasting changes in the JSON file.

Gotchas that bit us while building it: a client needs the `basic` client scope or its tokens have no `sub`; custom claims need protocol mappers on the client (the realm roles mapper produces the top-level `roles` claim; the audience mapper adds `grandstack-api`).

## Not for production

This setup is for local development. Before a real deployment you would at least:

- run Keycloak in production mode behind HTTPS with a real database, and a real hostname instead of `localhost`;
- change the admin password and remove the demo users and the `grandstack-smoke*` clients (they allow the password grant);
- turn on brute-force protection, set sensible token lifetimes, and review CORS and redirect URIs;
- not use `sessionStorage` for tokens if your threat model includes XSS (consider a backend-for-frontend that keeps tokens server-side);
- add rate limiting at the gateway, and keep secrets out of the repository.

None of this is done here.
