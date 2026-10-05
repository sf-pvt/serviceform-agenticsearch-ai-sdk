import { defineConfig } from 'tsup';

// Two builds: the library (ESM + CJS + types, one entry per subpath) and the
// prebuilt bundle (one minified script for a <script> tag and for the plugins).
export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      client: 'src/client/index.ts',
      connectors: 'src/connectors/index.ts',
      widgets: 'src/widgets/index.ts',
      prebuilt: 'src/prebuilt/index.ts',
      react: 'src/react/index.ts',
      vue: 'src/vue/index.ts',
    },
    external: ['react', 'vue'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    target: 'es2018',
    sourcemap: true,
    loader: { '.css': 'text' },
  },
  {
    entry: { 'agenticsearch.prebuilt.min': 'src/prebuilt/browser.ts' },
    format: ['iife'],
    minify: true,
    target: 'es2018',
    sourcemap: false,
    loader: { '.css': 'text' },
    outExtension: () => ({ js: '.js' }),
  },
]);
