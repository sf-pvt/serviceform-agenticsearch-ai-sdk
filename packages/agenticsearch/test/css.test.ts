import { describe, expect, it } from 'vitest';
// @ts-expect-error a build script, plain JavaScript
import { boost } from '../scripts/boost-css.mjs';

describe('stylesheet weight', () => {
  it('adds an id-weight to every selector and keeps pseudo-elements last', () => {
    const css = boost('.sfas a, .sfas .x:is(.a, .b)::placeholder { color: red; }');
    expect(css).toBe('.sfas a:not(#\\#), .sfas .x:is(.a, .b):not(#\\#)::placeholder { color: red; }');
  });

  it('reaches rules inside media queries and leaves keyframes and the root alone', () => {
    const css = boost(':root { --sfas-css: 1; }\n@media (max-width: 820px) { .sfas-hits { gap: 10px; } }\n@keyframes sfas-pulse { 50% { opacity: 0.5; } }\n.sfas-note { margin: 0; }');
    expect(css).toContain(':root { --sfas-css: 1; }');
    expect(css).toContain('@media (max-width: 820px) { .sfas-hits:not(#\\#) { gap: 10px; } }');
    expect(css).toContain('@keyframes sfas-pulse { 50% { opacity: 0.5; } }');
    expect(css).toContain('.sfas-note:not(#\\#) { margin: 0; }');
  });
});
