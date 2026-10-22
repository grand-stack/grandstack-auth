# Copyright (c) "Neo4j"
# Neo4j Sweden AB [http://neo4j.com]
FROM node:24.22.1-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# These are read by the browser, so they must be URLs the browser can reach
ARG VITE_GRAPHQL_URL=http://localhost:4000/graphql
ARG VITE_OIDC_AUTHORITY=http://localhost:8081/realms/grandstack
ARG VITE_OIDC_CLIENT_ID=grandstack-auth-client
ARG VITE_OIDC_SCOPE="openid profile"
ARG VITE_OIDC_AUDIENCE=""
ENV VITE_GRAPHQL_URL=$VITE_GRAPHQL_URL VITE_OIDC_AUTHORITY=$VITE_OIDC_AUTHORITY VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID VITE_OIDC_SCOPE=$VITE_OIDC_SCOPE VITE_OIDC_AUDIENCE=$VITE_OIDC_AUDIENCE
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30.6-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
