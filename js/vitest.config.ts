import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'tests/',
        'examples/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/api': path.resolve(__dirname, './src/api'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    },
  },
});

