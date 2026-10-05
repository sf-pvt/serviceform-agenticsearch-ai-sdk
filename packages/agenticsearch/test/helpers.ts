import { vi } from 'vitest';
import { serviceformSearch, type ClientOptions } from '../src/client';

export interface Call { url: string; init?: RequestInit }

/** A fetch that answers from a table of path fragments, and remembers what it was asked. */
export function fakeFetch(routes: Record<string, unknown | ((call: Call) => unknown)>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    for (const [fragment, answer] of Object.entries(routes)) {
      if (!url.includes(fragment)) continue;
      const body = typeof answer === 'function' ? (answer as (c: Call) => unknown)({ url, init }) : answer;
      if (body && typeof body === 'object' && 'status' in (body as any) && '__raw' in (body as any)) {
        const raw = body as any;
        return { ok: raw.status >= 200 && raw.status < 300, status: raw.status, json: async () => raw.body, headers: { get: () => null } } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => body, headers: { get: () => null } } as unknown as Response;
    }
    return { ok: false, status: 404, json: async () => ({ error: 'Not found' }), headers: { get: () => null } } as unknown as Response;
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

export const status = (code: number, body: unknown = {}) => ({ __raw: true, status: code, body });

export const product = (n: number, extra: Record<string, unknown> = {}) => ({ t: `Volvo XC${n}`, y: 2020, meta: 'Volvo · SUV', p: '29 900 €', mo: '', h: `https://shop.test/p/${n}`, img: `https://shop.test/i/${n}.jpg`, id: String(n), pn: 29900, oos: false, ...extra });

export const browseBody = (over: Record<string, unknown> = {}) => ({
  q: '', page: 1, per_page: 24, found: 2, has_more: false, sort: 'relevance',
  products: [product(40), product(60)],
  facets: [{ field: 'brand', values: [{ v: 'Volvo', c: 2 }, { v: 'AUDI', c: 1 }] }, { field: 'fuel', values: [{ v: 'S', c: 1, l: 'Sähkö' }] }],
  ranges: [{ field: 'year', min: 2015, max: 2024 }],
  price: { min: 500000, max: 4500000 },
  price_cents: true,
  available: ['brand', 'fuel', 'year', 'price'],
  mileage_unit: 'km',
  state: { q: '', filters: {}, ranges: {}, price_min: null, price_max: null, sort: 'relevance', in_stock: false, kind: '' },
  read: false,
  chips: [],
  ...over,
});

export const configBody = (over: Record<string, unknown> = {}) => ({ v: 1, toolId: 'tool1', language: 'fi', currency: 'EUR', ai: true, questions: ['Mikä auto perheelle?'], placeholders: ['Hae autoa'], facets: [], showFilters: true, layout: 'box', accent: '#123456', radius: 10, pagesCount: 1, ...over });

export function clientWith(routes: Record<string, unknown | ((call: Call) => unknown)>, options: ClientOptions = {}) {
  const { fetch, calls } = fakeFetch(routes);
  const client = serviceformSearch('tool1', { fetch, storage: false, apiBase: 'https://api.test', ...options });
  return { client, calls };
}

export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
