import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Route/lib modules import 'server-only' to guard against accidental
      // client bundling; in unit tests it resolves to a no-op stub.
      'server-only': path.resolve(__dirname, 'tests/stubs/empty.ts'),
      'client-only': path.resolve(__dirname, 'tests/stubs/empty.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
