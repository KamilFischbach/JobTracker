import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // Room for several 3 s findBy waits (setup.ts) on slow CI runners.
      testTimeout: 15_000,
    },
  }),
);
