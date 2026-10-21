// Hive Gateway in proxy mode in front of grandstack-server.
//  - validates the bearer token (signature via JWKS, expiry, issuer, audience); a missing token is allowed (public reads)
//  - refuses mutations the token has no permission for (see rules.ts)
//  - forwards the Authorization header, so the server verifies the token again and applies row-level rules
import { createRemoteJwksSigningKeyProvider, defineConfig, extractFromHeader, type GatewayPlugin } from "@graphql-hive/gateway";
import { generateKeyPairSync } from "node:crypto";
import { GraphQLError } from "graphql";
import { authorizeMutation, mutationRootFields, parseRolePermissions } from "./rules";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

const jwksUri = required("AUTH_JWKS_URL");
const issuer = required("AUTH_ISSUER");
const audience = required("AUTH_AUDIENCE");
const upstream = required("UPSTREAM_URL");
const origins = (process.env.CORS_ORIGIN ?? "http://localhost:3000,http://localhost:3001").split(",").map((o) => o.trim()).filter(Boolean);
const roleMap = parseRolePermissions(process.env.ROLE_PERMISSIONS);

// The JWT plugin answers a token whose key id is not in the JWKS (forged, or signed by a rotated-out key) with
// HTTP 500 "Authentication is not available". That is the client's mistake, so we answer 401 instead: when the key
// is unknown we hand the plugin a public key that cannot verify anything, which makes the token "invalid".
// Other failures (for example the JWKS endpoint being unreachable) are not caught and stay server errors.
const remoteKeys = createRemoteJwksSigningKeyProvider({ jwksUri });
const unusableKey = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } }).publicKey;
const signingKeyProvider: typeof remoteKeys = async (header) => {
  try {
    return await remoteKeys(header);
  } catch (error) {
    if ((error as Error).name === "SigningKeyNotFoundError") return unusableKey;
    throw error;
  }
};

export const gatewayConfig = defineConfig({
  proxy: { endpoint: upstream },
  jwt: {
    tokenLookupLocations: [extractFromHeader({ name: "authorization", prefix: "Bearer" })],
    signingKeyProviders: [signingKeyProvider],
    tokenVerification: { issuer, audience, algorithms: ["RS256"] },
    reject: { missingToken: false, invalidToken: true },
  },
  propagateHeaders: {
    fromClientToSubgraphs({ request }) {
      const authorization = request.headers.get("authorization");
      return authorization ? { authorization } : {};
    },
  },
  cors: { origin: origins, allowedHeaders: ["authorization", "content-type"], methods: ["GET", "POST", "OPTIONS"] },
  plugins: (): GatewayPlugin[] => [
    {
      onExecute({ args, setResultAndStopExecution }) {
        const claims = (args.contextValue as { jwt?: { payload?: Record<string, unknown> } }).jwt?.payload;
        const decision = authorizeMutation(claims, mutationRootFields(args.document, args.operationName), roleMap);
        if (!decision.ok) {
          setResultAndStopExecution({
            errors: [new GraphQLError(decision.message, { extensions: { code: decision.code, http: { status: decision.status } } })],
          });
        }
      },
    },
  ],
});
