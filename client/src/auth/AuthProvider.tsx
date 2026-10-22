// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { User, UserManager, WebStorageStateStore } from "oidc-client-ts";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { identityFromToken, type Identity } from "./claims";
import { readOidcConfig } from "./config";

interface AuthState {
  /** True until we know whether there is a signed-in user. */
  loading: boolean;
  identity?: Identity;
  /** Current access token, for the `Authorization` header. */
  accessToken?: string;
  login: (returnTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Completes the redirect back from the provider. Returns the path to go to. */
  completeLogin: () => Promise<string>;
}

const Ctx = createContext<AuthState | null>(null);

/** The token the urql client attaches to requests. Updated by the provider. */
let currentToken: string | undefined;
export const getAccessToken = (): string | undefined => currentToken;

function createManager(): UserManager {
  const config = readOidcConfig();
  return new UserManager({
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: `${window.location.origin}/callback`,
    post_logout_redirect_uri: `${window.location.origin}/`,
    response_type: "code", // authorization code with PKCE
    scope: config.scope,
    extraQueryParams: config.audience ? { audience: config.audience } : undefined,
    automaticSilentRenew: true,
    // sessionStorage keeps the session to this tab. It is readable by scripts on the page (XSS), a known trade-off for SPAs.
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const manager = useMemo(createManager, []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const apply = (u: User | null) => {
      currentToken = u && !u.expired ? u.access_token : undefined;
      if (alive) setUser(u && !u.expired ? u : null);
    };
    manager.getUser().then((u) => { apply(u); if (alive) setLoading(false); }, () => { if (alive) setLoading(false); });
    const onLoaded = (u: User) => apply(u);
    const onGone = () => apply(null);
    manager.events.addUserLoaded(onLoaded);
    manager.events.addUserUnloaded(onGone);
    manager.events.addAccessTokenExpired(onGone);
    manager.events.addSilentRenewError(onGone);
    return () => {
      alive = false;
      manager.events.removeUserLoaded(onLoaded);
      manager.events.removeUserUnloaded(onGone);
      manager.events.removeAccessTokenExpired(onGone);
      manager.events.removeSilentRenewError(onGone);
    };
  }, [manager]);

  const login = useCallback((returnTo = window.location.pathname + window.location.search) => manager.signinRedirect({ state: { returnTo } }), [manager]);
  const logout = useCallback(async () => {
    currentToken = undefined;
    await manager.signoutRedirect();
  }, [manager]);
  const completeLogin = useCallback(async () => {
    const u = await manager.signinRedirectCallback();
    currentToken = u.access_token;
    setUser(u);
    return (u.state as { returnTo?: string } | undefined)?.returnTo ?? "/";
  }, [manager]);

  const value = useMemo<AuthState>(
    () => ({ loading, identity: user ? identityFromToken(user.access_token) : undefined, accessToken: user?.access_token, login, logout, completeLogin }),
    [loading, user, login, logout, completeLogin],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
