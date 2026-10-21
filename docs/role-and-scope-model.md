# Role and permission model

## Roles, permissions and where each is checked

| Concept | Defined in | Checked by | Example |
| --- | --- | --- | --- |
| **Role** | Keycloak realm role, sent as the `roles` claim | the server, in `schema/auth.graphql` rules | `editor`, `moderator` |
| **Permission** | derived from roles in the gateway (`DEFAULT_ROLE_PERMISSIONS` in `gateway/rules.ts`) | the gateway, per mutation field | `catalog:write`, `reviews:write` |

The gateway answers "may this token call this mutation at all?" using permissions. The server answers "may this token change this row?" using roles and the token's `sub`.

### Why permissions are derived from roles, not read from the OAuth `scope`

In OAuth, a *scope* is something a **client application** is allowed to request, so Keycloak grants scopes per client, not per user: every user logging in through the same client gets the same scopes. What differs between alice and bob is their **realm roles**. So the gateway maps roles to permissions. It also accepts permissions the token already carries, in a `permissions` array (Auth0 puts RBAC permissions there) or in the space-separated `scope` claim, so other providers work without changes.

`permissionsFromClaims` (in `gateway/rules.ts`) is the whole rule: a token's permissions are the union of the permissions of its roles, its `permissions` array and its `scope` string.

## The default map

| Role | Permissions at the gateway | Server-level extras |
| --- | --- | --- |
| `user` | `reviews:write` | may edit or delete their own reviews |
| `editor` (includes `user`) | `reviews:write`, `catalog:write` | `@authentication` on movies, people and genres requires the `editor` role |
| `moderator` (includes `editor`) | same as editor | may edit or delete anyone's review |

Keycloak makes the roles composite, so a moderator's token carries `["editor", "moderator", "user"]`.

Override the map without changing code: set the gateway's `ROLE_PERMISSIONS` environment variable to JSON, for example `{"user":["reviews:write"],"critic":["reviews:write"]}`. It must be an object of role to array of permission strings; anything else stops the gateway at startup.

## Which permission each mutation needs

Defined by `MUTATION_PERMISSIONS` in `gateway/rules.ts`:

| Mutation fields | Permission |
| --- | --- |
| `createMovies`, `updateMovies`, `deleteMovies`, `createPeople`, `updatePeople`, `deletePeople`, `createGenres`, `updateGenres`, `deleteGenres` | `catalog:write` |
| `createReview`, `updateReviews`, `deleteReviews` | `reviews:write` |
| anything else | **refused** (default deny) |

Queries are never checked at the gateway: reading is public. If a request contains several mutation fields, all of them must be allowed. If you add a mutation to the schema, add it to this table or the gateway will refuse it.

## Row-level rules on the server

All in `schema/auth.graphql`:

- `Movie`, `Person`, `Genre`: `@authentication` on create, update, delete and relationship changes with `jwt: { roles: { includes: "editor" } }`.
- `Review`: `@authentication` on update and delete, and an `@authorization` **filter**: only reviews whose `author.sub` equals the token's `sub`, or any review if the token has the `moderator` role, can be updated or deleted.
- `Review.author` and `Review.movie` (and `Movie.reviews`) have `nestedOperations: []`, so nobody can re-point a review at another author or movie through an update.
- `createReview` is a custom mutation that takes the author from `$jwt.sub`; the generated `createReviews` is removed with `@mutation(operations: [UPDATE, DELETE])` on `Review`. So a client cannot pass an author, and cannot create a review as someone else.
- `User` has no generated mutations; users are created by `createReview` the first time someone reviews.

## Adding a role

See [recipes](recipes.md#add-a-role-that-can-delete-any-review).
