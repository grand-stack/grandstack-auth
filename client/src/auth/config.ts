/** OIDC settings, read from build-time environment variables. Any OpenID Connect provider works (Keycloak, Auth0, ...). */
export interface OidcConfig {
  authority: string;
  clientId: string;
  scope: string;
  /** Extra authorize parameter some providers need, for example Auth0's `audience`. */
  audience?: string;
}

type Env = Record<string, string | undefined>;

export function readOidcConfig(env: Env = import.meta.env as Env): OidcConfig {
  const authority = env.VITE_OIDC_AUTHORITY;
  const clientId = env.VITE_OIDC_CLIENT_ID;
  if (!authority || !clientId) {
    throw new Error("Set VITE_OIDC_AUTHORITY and VITE_OIDC_CLIENT_ID (see docs/client.md)");
  }
  return { authority, clientId, scope: env.VITE_OIDC_SCOPE ?? "openid profile", audience: env.VITE_OIDC_AUDIENCE || undefined };
}

export const GRAPHQL_URL: string = import.meta.env.VITE_GRAPHQL_URL ?? "http://localhost:4000/graphql";
