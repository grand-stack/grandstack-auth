FROM ghcr.io/graphql-hive/gateway
# The config only imports packages the image already has, so nothing is installed here.
COPY gateway.config.ts rules.ts /gateway/
CMD ["proxy"]
