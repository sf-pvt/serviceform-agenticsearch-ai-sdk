// Raises the weight of every selector in a stylesheet by one id. Why: see build-css.mjs.

const BOOST = ':not(#\\#)';
const UNTOUCHED = /^(:root|html\.sfas-lock)$/;

/** Splits on commas that are not inside parentheses. */
function splitTop(list) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { parts.push(list.slice(from, i)); from = i + 1; }
  }
  parts.push(list.slice(from));
  return parts.map((p) => p.trim()).filter(Boolean);
}

function boostSelector(selector) {
  if (UNTOUCHED.test(selector)) return selector;
  // Before a pseudo-element, which has to stay last.
  const at = selector.search(/::[a-z-]+(\([^)]*\))?$/i);
  return at === -1 ? selector + BOOST : selector.slice(0, at) + BOOST + selector.slice(at);
}

export function boost(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '';
  let i = 0;
  // What kind of block each open brace began: 'rule' (declarations), 'group'
  // (@media, @supports: rules inside) or 'raw' (@keyframes: left alone).
  const stack = [];
  while (i < source.length) {
    const open = source.indexOf('{', i);
    const close = source.indexOf('}', i);
    if (close !== -1 && (open === -1 || close < open)) {
      out += source.slice(i, close + 1);
      stack.pop();
      i = close + 1;
      continue;
    }
    if (open === -1) { out += source.slice(i); break; }
    const prelude = source.slice(i, open);
    const text = prelude.trim();
    const inside = stack[stack.length - 1];
    if (inside === 'raw' || inside === 'rule') { out += prelude + '{'; stack.push(inside); }
    else if (text.startsWith('@')) { out += prelude + '{'; stack.push(/^@(-webkit-)?keyframes/.test(text) ? 'raw' : 'group'); }
    else {
      const lead = prelude.slice(0, prelude.length - prelude.trimStart().length);
      out += `${lead}${splitTop(text).map(boostSelector).join(', ')} {`;
      stack.push('rule');
    }
    i = open + 1;
  }
  return out;
}
