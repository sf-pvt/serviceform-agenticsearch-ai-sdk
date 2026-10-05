import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'jsdom', include: ['test/**/*.test.ts'] },
  esbuild: { target: 'es2018' },
  plugins: [{ name: 'css-as-text', transform(code, id) { if (id.endsWith('.css')) return { code: `export default ${JSON.stringify(code)};`, map: null }; return null; } }],
});
