import { describe, expect, it } from "vitest";
import { readOidcConfig } from "./config";

describe("readOidcConfig", () => {
  it("requires an authority and a client id", () => {
    expect(() => readOidcConfig({})).toThrow(/VITE_OIDC_AUTHORITY/);
    expect(() => readOidcConfig({ VITE_OIDC_AUTHORITY: "http://x" })).toThrow(/VITE_OIDC_CLIENT_ID/);
  });
  it("defaults the scope and treats the audience as optional", () => {
    expect(readOidcConfig({ VITE_OIDC_AUTHORITY: "http://x", VITE_OIDC_CLIENT_ID: "c" })).toEqual({ authority: "http://x", clientId: "c", scope: "openid profile", audience: undefined });
  });
  it("passes through scope and audience (Auth0 needs the audience)", () => {
    expect(readOidcConfig({ VITE_OIDC_AUTHORITY: "https://t.auth0.com", VITE_OIDC_CLIENT_ID: "c", VITE_OIDC_SCOPE: "openid profile email", VITE_OIDC_AUDIENCE: "api" }))
      .toMatchObject({ scope: "openid profile email", audience: "api" });
  });
});
