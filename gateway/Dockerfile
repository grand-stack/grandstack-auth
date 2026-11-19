# Copyright (c) "Neo4j"
# Neo4j Sweden AB [http://neo4j.com]
FROM ghcr.io/graphql-hive/gateway:2.15.10@sha256:f355b6ec4f0418e32c4d315c99e13f5c6178a81fc2a3be1f4fc1419174c2f1ef
# The config only imports packages the image already has, so nothing is installed here.
COPY gateway.config.ts rules.ts /gateway/
CMD ["proxy"]
