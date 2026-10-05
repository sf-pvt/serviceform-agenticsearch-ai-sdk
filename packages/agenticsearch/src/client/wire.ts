import type { Answer, BrowseResults, Chip, Facet, Hit, InstantResults, RangeStats, SitePage } from './types';
import { stateFromWire } from './query';

const text = (v: unknown): string => (v == null ? '' : String(v));
const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/** Only links a browser can follow safely: http(s) or a path on this site. */
export function safeUrl(value: unknown): string {
  const url = text(value).trim();
  if (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)) return url;
  return '';
}

/** A product row as the API sends it (`t`, `p`, `h`...) as a readable hit. */
export function hitFromWire(row: any): Hit | null {
  if (!row || typeof row !== 'object') return null;
  const title = text(row.t).trim();
  if (!title) return null;
  const hit: Hit = {
    title,
    price: text(row.p),
    monthly: text(row.mo),
    url: safeUrl(row.h),
    image: safeUrl(row.img),
    outOfStock: !!row.oos,
  };
  if (row.id !== undefined) hit.id = text(row.id);
  if (Number(row.y)) hit.year = Number(row.y);
  if (row.meta) hit.meta = text(row.meta);
  if (row.loc) hit.location = text(row.loc);
  if (row.brand) hit.brand = text(row.brand);
  if (Number.isFinite(Number(row.pn)) && row.pn != null) hit.priceValue = Number(row.pn);
  if (row.f && typeof row.f === 'object') hit.fields = row.f;
  return hit;
}

export const hitsFromWire = (rows: unknown): Hit[] => list(rows).map(hitFromWire).filter((h): h is Hit => !!h);

export const chipsFromWire = (rows: unknown): Chip[] =>
  list(rows).filter((c) => c && c.k && c.l).map((c) => ({ key: text(c.k), label: text(c.l) }));

function facetsFromWire(rows: unknown): Facet[] {
  return list(rows)
    .filter((f) => f && f.field)
    .map((f) => ({
      attribute: text(f.field),
      values: list(f.values).filter((v) => v && text(v.v) !== '').map((v) => ({ value: text(v.v), count: Number(v.c) || 0, ...(v.l ? { label: text(v.l) } : {}) })),
    }))
    .filter((f) => f.values.length);
}

export function browseFromWire(body: any, requestedPage = 1): BrowseResults {
  const b = body || {};
  const ranges: RangeStats[] = list(b.ranges).filter((r) => r && r.field).map((r) => ({ attribute: text(r.field), min: Number(r.min), max: Number(r.max) }));
  if (b.price && Number.isFinite(b.price.min) && Number.isFinite(b.price.max)) ranges.unshift({ attribute: 'price', min: b.price.min, max: b.price.max });
  const page = Number(b.page) || requestedPage;
  return {
    query: text(b.q),
    page,
    perPage: Number(b.per_page) || 0,
    found: Number(b.found) || 0,
    hasMore: !!b.has_more,
    sort: b.sort || 'relevance',
    hits: hitsFromWire(b.products),
    facets: facetsFromWire(b.facets),
    ranges,
    available: list(b.available).map(text),
    priceCents: !!b.price_cents,
    mileageUnit: text(b.mileage_unit) || 'km',
    state: b.state ? stateFromWire(b.state, page) : null,
    read: !!b.read,
    chips: chipsFromWire(b.chips),
    note: text(b.note),
    dropped: text(b.dropped),
  };
}

export function instantFromWire(body: any, query: string): InstantResults {
  const b = body || {};
  const hits = hitsFromWire(b.products);
  return {
    query,
    hits,
    found: Number(b.found) || hits.length,
    suggestions: list(b.suggestions).filter((s) => s && s.t).map((s) => ({ text: text(s.t), boldFrom: Number(s.b) || 0 })),
    chips: chipsFromWire(b.understood?.chips),
    note: text(b.understood?.note),
  };
}

export function answerFromWire(body: any): Answer {
  const b = body || {};
  return {
    answer: text(b.answer).trim(),
    intent: text(b.intent) || 'error',
    hits: hitsFromWire(b.products),
    links: list(b.links).map((l) => ({ label: text(l?.l), url: safeUrl(l?.h) })).filter((l) => l.label && /^https?:/i.test(l.url)),
    chips: chipsFromWire(b.chips),
    adopt: b.adopt && typeof b.adopt === 'object' ? stateFromWire(b.adopt, 1) : null,
    filters: b.filters && typeof b.filters === 'object' ? b.filters : {},
    rawAdopt: b.adopt && typeof b.adopt === 'object' ? b.adopt : null,
    note: text(b.note),
    language: text(b.language),
    continued: !!b.continued,
    ...(b.error ? { error: text(b.error) } : {}),
  };
}

/** Site pages, whichever spelling the server used for them. */
export function pagesFromWire(rows: unknown): SitePage[] {
  return list(rows)
    .map((p) => ({ label: text(p?.l ?? p?.t).trim(), url: safeUrl(p?.h), keywords: text(p?.k ?? p?.d) }))
    .filter((p) => p.label && p.url);
}
