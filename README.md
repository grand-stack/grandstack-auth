# grandstack-auth

Authentication and authorization for GRANDstack: a **gateway** that validates Keycloak tokens and enforces permissions per mutation, **row-level rules** for the GraphQL server, a Keycloak **development realm** with demo users, and a small **demo client** with a permissions playground. It is opt-in, and it leaves `grandstack-web` untouched.

> **Development only.** Keycloak runs in dev mode with known passwords over plain HTTP. See [what to change for production](docs/keycloak.md#not-for-production).

## What you get

- Reads are public; writes need a login. Roles: `user` (write reviews), `editor` (change movies, people, genres), `moderator` (also delete any review).
- Two independent checks: the gateway validates every token and applies permissions; the server verifies the token again and applies row-level rules. Calling the server directly cannot bypass auth.
- A review's author always comes from the token and cannot be spoofed; only the author or a moderator can change a review.
- Works with any OpenID Connect provider by configuration ([swapping providers](docs/swapping-providers.md), with an [untested Auth0 guide](docs/auth0.md)).

## Run it

This repo is used through the `grandstack` umbrella repo. With `grandstack`, `grandstack-server`, `grandstack-web` and this repo side by side in one folder:

```sh
cd grandstack
cp .env.example .env        # once
docker compose -f compose.yaml -f compose.auth.yaml up --build
```

The plain `docker compose up` (no `-f` override) still starts the open stack with no login.

| Open | What |
| --- | --- |
| http://localhost:3001 | The demo client: log in, write reviews, try the permissions playground |
| http://localhost:4000/graphql | The gateway: the public GraphQL endpoint (the server is not published) |
| http://localhost:8081 | Keycloak (admin console: `admin` / `admin`) |
| http://localhost:3000 | The unchanged `grandstack-web`. It has no login, so through the gateway it can read but every write is refused |

Demo users (password is the name plus `-pass`):

| User | Password | Role | Can |
| --- | --- | --- | --- |
| `alice` | `alice-pass` | user | write and edit own reviews |
| `bob` | `bob-pass` | editor | the above, plus create, edit and delete movies, people and genres |
| `carol` | `carol-pass` | moderator | the above, plus delete anyone's review |

## Documentation

| Read | To learn |
| --- | --- |
| [How it works](docs/how-it-works.md) | The pieces, the two checks, what is allowed, responses, why two addresses |
| [Role and permission model](docs/role-and-scope-model.md) | Roles, permissions, the mutation table, the server rules |
| [Keycloak realm](docs/keycloak.md) | What the dev realm contains, changing it, not for production |
| [The demo client](docs/client.md) | Login flow, playground, configuration, files |
| [Recipes](docs/recipes.md) | Add a role, protect a mutation, add a user |
| [Testing](docs/testing.md) | Unit tests, the smoke script, browser checks |
| [Swapping providers](docs/swapping-providers.md), [Auth0](docs/auth0.md) | Using another OpenID Connect provider (Auth0 untested) |
| [Troubleshooting](docs/troubleshooting.md) | Errors we hit and their fixes |
| [**Exercise:** add auth to grandstack-web](docs/exercise-add-auth-to-grandstack-web.md) | A follow-up task for a developer or coding agent |

Working with a coding agent? Start with [AGENTS.md](AGENTS.md).

`npm ci` prints `npm warn install-scripts` notices; they are harmless.

Last verified: grandstack-auth v0.1.0 with grandstack-server v0.7.0, Keycloak 26.8.1, Hive Gateway 2.15.2, Neo4j 2026.10 community, under Podman 6 on macOS.
