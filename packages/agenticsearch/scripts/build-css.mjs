// Builds the stylesheet the library ships, from src/css/agenticsearch.css:
//
//   src/css/agenticsearch.built.css   imported by the prebuilt bundle
//   dist/agenticsearch.min.css        the same, minified, for a <link>
//
// The one change made on the way is weight. The search is dropped into pages
// it does not own, whose themes say things like `#page button:hover { ... }`
// or `.entry-content a { ... }`. Every selector here gets `:not(#\#)` added,
// which matches everything and counts as an id, so no element or class rule
// of the page can outrank a rule of ours, while the order among our own
// rules stays exactly as written. Sites theme the search with the --sfas-*
// custom properties; a site that wants to override a rule outright needs an
// id in its selector, or !important.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { boost } from './boost-css.mjs';

if (import.meta.url === `file://${process.argv[1]}`) {
  const built = boost(readFileSync('src/css/agenticsearch.css', 'utf8'));
  writeFileSync('src/css/agenticsearch.built.css', built);
  if (!process.argv.includes('--source-only')) {
    mkdirSync('dist', { recursive: true });
    await build({ entryPoints: ['src/css/agenticsearch.built.css'], outfile: 'dist/agenticsearch.min.css', minify: true, logLevel: 'warning' });
    console.log(`dist/agenticsearch.min.css ${(readFileSync('dist/agenticsearch.min.css').length / 1024).toFixed(1)} kB`);
  }
}
