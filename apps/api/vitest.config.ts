import { defineConfig } from "vitest/config";

const root = new URL("../../", import.meta.url).pathname;

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: [
      // Sub-path exports must come BEFORE the bare specifier aliases
      { find: "@repo/db/schema", replacement: `${root}packages/db/src/schema.ts` },
      { find: "@repo/db/client", replacement: `${root}packages/db/src/client.ts` },
      { find: "@repo/db/seed", replacement: `${root}packages/db/src/seed.ts` },
      { find: "@repo/db", replacement: `${root}packages/db/src/index.ts` },
      { find: /^@repo\/shared\/schemas\/(.+)$/, replacement: `${root}packages/shared/src/schemas/$1.ts` },
      { find: "@repo/shared/permissions", replacement: `${root}packages/shared/src/permissions.ts` },
      { find: "@repo/shared/money", replacement: `${root}packages/shared/src/money.ts` },
      { find: "@repo/shared", replacement: `${root}packages/shared/src/index.ts` },
    ],
  },
});
