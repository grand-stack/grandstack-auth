// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { port: 3001, host: true },
});
