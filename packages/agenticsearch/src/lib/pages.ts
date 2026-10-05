import type { SitePage } from '../client/types';

const plain = (q: string) => String(q || '').replace(/[?!¿¡.,;:"“”()]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/** How well one string holds another: the start, the start of a word, or anywhere. */
function score(needle: string, hay: string): number {
  const h = String(hay || '').toLowerCase();
  if (!needle || !h) return 0;
  if (h.startsWith(needle)) return 3;
  if (h.includes(` ${needle}`)) return 2;
  return h.includes(needle) ? 1 : 0;
}

/**
 * The site's own pages that fit what was typed, best first. The whole
 * phrase first, and when that finds nothing each word of it: "red volvo"
 * still shows the Volvo page. A word that half the site's pages contain
 * picks none of them and is skipped.
 */
export function matchPages(query: string, pages: SitePage[], limit = 4): SitePage[] {
  const q = plain(query);
  if (!q || !pages.length) return [];
  const common = new Map<string, boolean>();
  const isCommon = (word: string) => {
    if (!common.has(word)) {
      let hits = 0;
      for (const p of pages) if (`${p.label} ${p.keywords}`.toLowerCase().includes(word)) hits += 1;
      common.set(word, pages.length >= 8 && hits > Math.max(3, pages.length * 0.15));
    }
    return common.get(word)!;
  };
  const best = (needle: string, p: SitePage) => Math.max(score(needle, p.label), score(needle, p.keywords));
  const scored = pages.map((p) => {
    const whole = best(q, p);
    if (whole) return { p, s: whole * 10 };
    let sum = 0;
    for (const word of q.split(' ')) {
      if (word.length < 4 || isCommon(word)) continue;
      let hit = best(word, p);
      if (hit < 2 && word.length > 4 && word.endsWith('s')) hit = best(word.slice(0, -1), p);
      if (hit >= 2) sum += hit;
    }
    return { p, s: sum };
  });
  return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.p.label.length - b.p.label.length).slice(0, limit).map((x) => x.p);
}
