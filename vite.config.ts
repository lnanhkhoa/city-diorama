import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    // three.js is ~800 kB minified: react-three-fiber imports the whole
    // namespace, so nothing is tree-shaken. App chunks stay far below this.
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        // three.js and React change far less often than app code, so each gets
        // its own long-cached chunk: a deploy that only touches the app keeps them.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|@react-three|zustand|its-fine|suspend-react|react-use-measure)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The persistent transform cache does not see files added to an
    // `import.meta.glob` directory, so new cities would be skipped by tests.
    fsModuleCache: false,
  },
});
