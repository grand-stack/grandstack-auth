#!/bin/sh
# Copyright (c) "Neo4j"
# Neo4j Sweden AB [http://neo4j.com]
# Checks that exercise/reference-solution.patch still applies to a clean grandstack-web and that the result type-checks,
# passes its tests and builds. Usage: sh scripts/verify-exercise.sh [path-to-grandstack-web]  (default ../grandstack-web)
# WEB_REF is the grandstack-web tag the patch was made against (default v0.5.0).
set -e
SRC="${1:-../grandstack-web}"
REF="${WEB_REF:-v0.5.0}"
PATCH="$(cd "$(dirname "$0")/.." && pwd)/exercise/reference-solution.patch"
WORK="$(mktemp -d)"
echo "Cloning $SRC at $REF into $WORK (a clean checkout; your working copy is not touched)"
git clone --quiet --branch "$REF" "$SRC" "$WORK/web"
cd "$WORK/web"
git apply --check "$PATCH"
git apply "$PATCH"
npm ci --silent
npm run typecheck
npm test
npm run build
echo "OK: the reference solution applies and passes (checked out in $WORK/web)"
