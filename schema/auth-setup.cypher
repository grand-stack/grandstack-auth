// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
// Idempotent setup for the auth schema extension; run at every server start (SETUP_CYPHER_PATHS).
CREATE CONSTRAINT user_sub IF NOT EXISTS FOR (u:User) REQUIRE u.sub IS UNIQUE;
CREATE CONSTRAINT review_id IF NOT EXISTS FOR (r:Review) REQUIRE r.id IS UNIQUE;
