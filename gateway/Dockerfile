# Copyright (c) "Neo4j"
# Neo4j Sweden AB [http://neo4j.com]
FROM ghcr.io/graphql-hive/gateway:2.15.4@sha256:57b51105c1e6a2328dcf2f395a01449ac9c84c80defb704f49f99d16c184aa6b
# The config only imports packages the image already has, so nothing is installed here.
COPY gateway.config.ts rules.ts /gateway/
CMD ["proxy"]
