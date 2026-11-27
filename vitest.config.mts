import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    env: {
      DATABASE_PATH: path.join(os.tmpdir(), `agenda-test-${process.pid}.db`),
      UPLOAD_DIR: path.join(os.tmpdir(), `agenda-test-uploads-${process.pid}`),
      ENCRYPTION_KEY: "test-key",
    },
  },
});
