import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Vitest doesn't load .env into process.env, and PrismaClient reads
    // DATABASE_URL directly — set it (and a test JWT secret) here so the API
    // smoke test can hit the same local SQLite dev DB. `file:./dev.db` resolves
    // relative to the Prisma schema dir (prisma/), matching .env.
    env: {
      DATABASE_URL: 'file:./dev.db',
      JWT_SECRET: 'test-only-secret',
      NODE_ENV: 'test',
    },
    // The API test reseeds and mutates the shared dev DB, so it must not run in
    // parallel with itself across files — keep a single worker.
    fileParallelism: false,
  },
})
