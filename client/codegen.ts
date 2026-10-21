import type { CodegenConfig } from "@graphql-codegen/cli";

// Reads the schema from the gateway (introspection is public). Needs the auth stack running.
const config: CodegenConfig = {
  schema: process.env.GRAPHQL_URL ?? "http://localhost:4000/graphql",
  documents: ["src/**/*.tsx", "src/**/*.ts", "!src/graphql/generated/**"],
  ignoreNoDocuments: false,
  generates: {
    "src/graphql/generated/": { preset: "client", presetConfig: { fragmentMasking: false } },
  },
};

export default config;
