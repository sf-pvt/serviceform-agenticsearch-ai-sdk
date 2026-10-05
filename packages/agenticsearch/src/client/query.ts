import type { Range, SearchState, SortId } from './types';

export const SORTS: SortId[] = ['relevance', 'price_asc', 'price_desc', 'year_desc', 'year_asc', 'mileage_asc', 'newest', 'name_asc'];
const FIELD = /^[a-zA-Z0-9_]{1,40}$/;
const KIND = /^[a-z_]{1,20}$/;
export const MAX_QUERY_LENGTH = 120;

export function emptyState(): SearchState {
  return { q: '', filters: {}, ranges: {}, priceMin: null, priceMax: null, sort: 'relevance', inStock: false, kind: '', page: 1 };
}

const num = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** A state with every part present and of the right type, whatever it was given. */
export function normalizeState(input?: Partial<SearchState> | null): SearchState {
  const s = input || {};
  const filters: Record<string, string[]> = {};
  for (const [field, values] of Object.entries(s.filters || {})) {
    if (!FIELD.test(field)) continue;
    const list = [...new Set((Array.isArray(values) ? values : [values]).map((v) => String(v ?? '')).filter(Boolean))];
    if (list.length) filters[field] = list;
  }
  const ranges: Record<string, Range> = {};
  for (const [field, r] of Object.entries(s.ranges || {})) {
    if (!FIELD.test(field) || !r) continue;
    const min = num(r.min);
    const max = num(r.max);
    if (min !== null || max !== null) ranges[field] = { min, max };
  }
  return {
    q: String(s.q ?? '').slice(0, MAX_QUERY_LENGTH),
    filters,
    ranges,
    priceMin: num(s.priceMin),
    priceMax: num(s.priceMax),
    sort: SORTS.includes(s.sort as SortId) ? (s.sort as SortId) : 'relevance',
    inStock: !!s.inStock,
    kind: KIND.test(String(s.kind || '')) ? String(s.kind) : '',
    page: Math.max(1, Math.floor(Number(s.page) || 1)),
  };
}

/** The API's own spelling of a state (`price_min`, `in_stock`) as ours. */
export function stateFromWire(wire: any, page = 1): SearchState {
  const w = wire || {};
  return normalizeState({
    q: w.q,
    filters: w.filters,
    ranges: w.ranges,
    priceMin: w.price_min,
    priceMax: w.price_max,
    sort: w.sort,
    inStock: w.in_stock,
    kind: w.kind,
    page,
  });
}

/** Ours as the API spells it, to send back with a follow-up question. */
export function stateToWire(state: SearchState): Record<string, unknown> {
  return { q: state.q, filters: state.filters, ranges: state.ranges, price_min: state.priceMin, price_max: state.priceMax, sort: state.sort, in_stock: state.inStock, kind: state.kind };
}

export type QueryPairs = Array<[string, string]>;

/**
 * A state as query-string pairs: `q`, `f.<field>=a|b`, `r.<field>=min|max`,
 * `price_min`, `price_max`, `sort`, `k`, `in_stock`, `page`. The same format
 * the API reads and a results page writes to its address.
 */
export function stateToPairs(state: Partial<SearchState>, queryParam = 'q'): QueryPairs {
  const s = normalizeState(state);
  const pairs: QueryPairs = [];
  if (s.q) pairs.push([queryParam, s.q]);
  for (const field of Object.keys(s.filters).sort()) pairs.push([`f.${field}`, s.filters[field].join('|')]);
  for (const field of Object.keys(s.ranges).sort()) {
    const r = s.ranges[field];
    pairs.push([`r.${field}`, `${r.min ?? ''}|${r.max ?? ''}`]);
  }
  if (s.priceMin !== null) pairs.push(['price_min', String(s.priceMin)]);
  if (s.priceMax !== null) pairs.push(['price_max', String(s.priceMax)]);
  if (s.sort !== 'relevance') pairs.push(['sort', s.sort]);
  if (s.kind) pairs.push(['k', s.kind]);
  if (s.inStock) pairs.push(['in_stock', '1']);
  if (s.page > 1) pairs.push(['page', String(s.page)]);
  return pairs;
}

export const encodePairs = (pairs: QueryPairs): string => pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

export const stateToQuery = (state: Partial<SearchState>, queryParam = 'q'): string => encodePairs(stateToPairs(state, queryParam));

/** Whether a query-string key is one a state writes. */
export function isStateKey(key: string, queryParam = 'q'): boolean {
  return key === queryParam || /^(k|sort|price_min|price_max|in_stock|page)$/.test(key) || /^(f|r)\.[a-zA-Z0-9_]{1,40}$/.test(key);
}

/** A query string back to a state. Keys it does not know are left alone. */
export function queryToState(search: string, queryParam = 'q'): SearchState {
  const draft: any = { filters: {}, ranges: {} };
  for (const pair of String(search || '').replace(/^\?/, '').split('&')) {
    if (!pair) continue;
    const at = pair.indexOf('=');
    let key: string;
    let value: string;
    try {
      key = decodeURIComponent(at === -1 ? pair : pair.slice(0, at));
      value = decodeURIComponent((at === -1 ? '' : pair.slice(at + 1)).replace(/\+/g, ' '));
    } catch { continue; }
    const f = /^f\.([a-zA-Z0-9_]{1,40})$/.exec(key);
    const r = /^r\.([a-zA-Z0-9_]{1,40})$/.exec(key);
    if (key === queryParam) draft.q = value;
    else if (key === 'sort') draft.sort = value;
    else if (key === 'k') draft.kind = value;
    else if (key === 'price_min') draft.priceMin = value;
    else if (key === 'price_max') draft.priceMax = value;
    else if (key === 'in_stock') draft.inStock = value === '1' || value === 'true';
    else if (key === 'page') draft.page = value;
    else if (f) draft.filters[f[1]] = value.split('|').filter(Boolean);
    else if (r) {
      const [lo, hi] = value.split('|');
      draft.ranges[r[1]] = { min: lo, max: hi };
    }
  }
  return normalizeState(draft);
}

/** Whether anything but the words and the order narrows the search. */
export function isFiltered(state: SearchState): boolean {
  return Object.keys(state.filters).length > 0 || Object.keys(state.ranges).length > 0 || state.priceMin !== null || state.priceMax !== null || state.inStock || !!state.kind;
}

/** Same search, whatever page of it. */
export function sameSearch(a: SearchState, b: SearchState): boolean {
  return stateToQuery({ ...a, page: 1 }) === stateToQuery({ ...b, page: 1 });
}
