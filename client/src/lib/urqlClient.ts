import { Client, cacheExchange, fetchExchange } from "urql";
import { getAccessToken } from "../auth/AuthProvider";
import { GRAPHQL_URL } from "../auth/config";

/** urql client that sends the current access token (if any) as a bearer token. */
export const client = new Client({
  url: GRAPHQL_URL,
  exchanges: [cacheExchange, fetchExchange],
  requestPolicy: "cache-and-network",
  fetchOptions: () => {
    const token = getAccessToken();
    return token ? { headers: { authorization: `Bearer ${token}` } } : {};
  },
});
