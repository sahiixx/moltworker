import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'skills/**/*.test.js', 'tests/**/*.test.{cjs,js}'],
    exclude: ['src/client/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['src/client/**', 'node_modules/**', '**/*.test.ts', '**/*.test.js', '**/*.test.cjs'],
    },
  },
})