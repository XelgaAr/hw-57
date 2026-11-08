import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: { PORT: '3000', HOST: '127.0.0.1' },
    setupFiles: ['./vitest.setup.js'],
    include: ['src/__test__/**/*.test.js'],
    fileParallelism: false,
    coverage: { provider: 'v8', include: ['src/**/*.mjs'], exclude: ['src/__test__/**'] }
  }
})
