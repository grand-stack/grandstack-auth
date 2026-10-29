# AGENTS.md: grandstack-auth

Auth for GRANDstack: Hive Gateway (`gateway/`), Keycloak dev realm (`keycloak/`), row-level schema rules (`schema/auth.graphql`), demo client (`client/`), smoke and browser tests. Read [docs/how-it-works.md](docs/how-it-works.md) first, then [docs/recipes.md](docs/recipes.md). `grandstack-web` is deliberately **not** modified by this project; adding login to it is the exercise in [docs/exercise-add-auth-to-grandstack-web.md](docs/exercise-add-auth-to-grandstack-web.md).

## Commands
- Start: `cd ../grandstack && docker compose -f compose.yaml -f compose.auth.yaml up --build` (client :3001, gateway :4000, Keycloak :8081).
- Gateway: `cd gateway && npm ci && npm test && npm run typecheck`. Client: `cd client && npm ci && npm test && npm run typecheck` (`npm run codegen` needs the stack).
- With the stack running: `npm ci && npm run smoke` and `npm run e2e`.
- Before you finish, all of: `(cd gateway && npm test && npm run typecheck)`, `(cd client && npm test && npm run typecheck)`, `npm run docs:check`, then with the stack running `npm run smoke` and `npm run e2e`.
- First time: `cp .env.example .env` in the `grandstack` repo (compose reads the Neo4j password from it).

## Rules that are easy to get wrong
- **Build on the blocks; do not make a silo.** A new repository or setup must be made from what GRANDstack already provides (the `grandstack-server` image and its models, the `grandstack-federation` gateway, `grandstack-auth`, `grandstack-agents`, compose overlays in the `grandstack` repository), and improve a block when it falls short rather than copying or working around it. Read [building on GRANDstack](../grandstack/docs/building-on-grandstack.md) before creating a repository, a compose file, a server, a gateway or a docs structure. Providing building blocks that people shape into their own solution is a goal of the project.
- Realm edits only apply to a fresh Keycloak (recreate the container); see [docs/keycloak.md](docs/keycloak.md#changing-the-realm).
- **Two addresses:** `AUTH_ISSUER` is the browser-facing `http://localhost:8081/realms/grandstack`; `AUTH_JWKS_URL` is `http://keycloak:8080/...` (reachable from containers). They must match the token's `iss` and the services' network respectively.
- A new mutation must be added to `MUTATION_PERMISSIONS` in `gateway/rules.ts` or the gateway refuses it (default deny).
- Server rules use `filter`, not `validate` (`validate` needs the APOC plugin), and no `DateTime` fields (also APOC). Rule `where` clauses use operators (`sub: { eq: "$jwt.sub" }`). More in `grandstack-server/docs/schema-guide.md`.
- The server and gateway read their config at startup: restart the server after changing `auth.graphql`, then the gateway.
- `grandstack-web` stays unauthenticated and unchanged; against the gateway it is an anonymous client and its writes fail by design.
- Never use the demo realm, its passwords or the password-grant clients outside local development.
- New code files need the copyright header (two lines: `Copyright (c) "Neo4j"` and `Neo4j Sweden AB [http://neo4j.com]`, in the file's comment syntax). Run `node ../grandstack/scripts/add-headers.mjs` (or `node ../.github/scripts/headers.mjs --root .` for one repository) to add it; `--check` lists what is missing. Generated files are exempt.

## Keep the docs true
Update the matching doc in the same change as the behaviour (role tables in `docs/how-it-works.md` and `docs/role-and-scope-model.md`, Keycloak facts in `docs/keycloak.md`). `npm run docs:check` fails on a broken relative link. Keep `exercise/reference-solution.patch` valid with `npm run verify-exercise`. Diagrams are SVG files in `docs/diagrams/`: edit the SVG and its numbered legend together when behaviour changes; `npm run docs:check` fails on a missing alt text, unsafe SVG content, or legend numbers that do not match the callouts drawn.
- Releases use the **release-cut** workflow (Actions tab), which sets the version in every `package.json`, tags and publishes. Do not bump versions or push tags by hand; see `grandstack/docs/releasing.md`.
- `gateway/package.json` `overrides` pin `@graphql-tools/utils` to 12.1.0 and `uuid` to 11.1.1 to clear Dependabot security alerts (that package is a dev dependency used for types and tests; the gateway itself runs from the stock Hive Gateway image).
- Base images in Dockerfiles and compose files are pinned to an exact version **and** a digest (`image:1.2.3@sha256:...`), never a floating tag such as `latest` or `24-slim`, so a rebuilt image cannot silently change or be swapped. Dependabot proposes updates to both; take them through a pull request that passes CI. To pin a new image, look up the digest of the multi-arch index (not of one platform).
