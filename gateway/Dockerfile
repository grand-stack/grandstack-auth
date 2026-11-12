# Copyright (c) "Neo4j"
# Neo4j Sweden AB [http://neo4j.com]
FROM ghcr.io/graphql-hive/gateway:2.15.8@sha256:9aaeb53f0e7c9e386d7185fde7f61e148033c90e8b64270a04df53b1af814634
# The config only imports packages the image already has, so nothing is installed here.
COPY gateway.config.ts rules.ts /gateway/
CMD ["proxy"]
