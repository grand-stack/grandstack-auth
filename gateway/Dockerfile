# Copyright (c) "Neo4j"
# Neo4j Sweden AB [http://neo4j.com]
FROM ghcr.io/graphql-hive/gateway:2.15.2@sha256:a5776053eceac4c46878af1b09eff58e58ad96544cfa61275808f42d03c6b10c
# The config only imports packages the image already has, so nothing is installed here.
COPY gateway.config.ts rules.ts /gateway/
CMD ["proxy"]
