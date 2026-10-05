import { describe, expect, it } from 'vitest';
import { configFromToolDoc, normalizeState, queryToState, serviceformSearch, stateToQuery } from '../src/client';
import { browseBody, clientWith, configBody, fakeFetch, product, status } from './helpers';

describe('state and query strings', () => {
  it('round-trips a full state in the format the API reads', () => {
    const state = normalizeState({ q: 'red volvo', filters: { colour: ['Red'], brand: ['Volvo', 'Audi'] }, ranges: { year: { min: 2018, max: null } }, priceMin: 1000, priceMax: 30000, sort: 'price_asc', kind: 'small', inStock: true, page: 3 });
    const query = stateToQuery(state);
    expect(decodeURIComponent(query)).toBe('q=red volvo&f.brand=Volvo|Audi&f.colour=Red&r.year=2018|&price_min=1000&price_max=30000&sort=price_asc&k=small&in_stock=1&page=3');
    expect(queryToState(`?${query}`)).toEqual(state);
  });

  it('reads the words from another parameter when told to (WordPress uses s)', () => {
    expect(queryToState('?s=kengat&utm_source=x', 's').q).toBe('kengat');
    expect(stateToQuery({ q: 'kengat' }, 's')).toBe('s=kengat');
  });

  it('drops what it cannot trust', () => {
    const state = normalizeState({ sort: 'drop table' as never, kind: 'Not A Kind', filters: { 'bad field!': ['x'], brand: ['', 'Volvo', 'Volvo'] }, page: -4 });
    expect(state).toMatchObject({ sort: 'relevance', kind: '', filters: { brand: ['Volvo'] }, page: 1 });
  });
});

describe('serviceformSearch', () => {
  it('refuses an id that could not be a tool id', () => {
    expect(() => serviceformSearch('../etc')).toThrow(/tool id/);
  });

  it('browses with the state as query parameters and maps the answer to readable names', async () => {
    const { client, calls } = clientWith({ '/browse/': browseBody({ chips: [{ k: 'brand', l: 'Volvo' }], note: 'Showing similar', read: true }) });
    const results = await client.browse({ q: 'volvo', filters: { brand: ['Volvo'] } }, { perPage: 12, facets: ['brand', 'price'] });
    const url = decodeURIComponent(calls[0].url);
    expect(url).toContain('https://api.test/api/public/omnibox/browse/tool1?q=volvo&f.brand=Volvo&per_page=12&facets=brand,price');
    expect(url).toMatch(/sdk=agenticsearch-js@\d/);
    expect(results.hits[0]).toMatchObject({ title: 'Volvo XC40', url: 'https://shop.test/p/40', priceValue: 29900, outOfStock: false });
    expect(results.facets[1]).toEqual({ attribute: 'fuel', values: [{ value: 'S', count: 1, label: 'Sähkö' }] });
    expect(results.ranges[0]).toEqual({ attribute: 'price', min: 500000, max: 4500000 });
    expect(results.chips).toEqual([{ key: 'brand', label: 'Volvo' }]);
    expect(results).toMatchObject({ note: 'Showing similar', read: true, priceCents: true });
  });

  it('never hands a script: link to the page', async () => {
    const { client } = clientWith({ '/browse/': browseBody({ products: [product(1, { h: 'javascript:alert(1)', img: 'data:text/html,x' })] }) });
    const { hits } = await client.browse();
    expect(hits[0].url).toBe('');
    expect(hits[0].image).toBe('');
  });

  it('asks with the history and maps the answer', async () => {
    const { client, calls } = clientWith({ '/ask/': { answer: ' Kolme Volvoa. ', intent: 'catalogue', products: [product(40)], links: [{ l: 'Rahoitus', h: 'https://shop.test/rahoitus' }, { l: 'Bad', h: 'javascript:1' }], chips: [{ k: 'brand', l: 'Volvo' }], adopt: { q: '', filters: { brand: ['Volvo'] }, price_max: 30000 }, filters: { brand: ['Volvo'] } } });
    const answer = await client.ask('volvo alle 30k', { history: [{ role: 'user', content: 'hei' }] });
    const body = JSON.parse(String(calls[0].init?.body));
    expect(calls[0].init?.method).toBe('POST');
    expect(body).toMatchObject({ q: 'volvo alle 30k', history: [{ role: 'user', content: 'hei' }] });
    expect(body.userId).toBe(client.sessionId);
    expect(answer.answer).toBe('Kolme Volvoa.');
    expect(answer.links).toEqual([{ label: 'Rahoitus', url: 'https://shop.test/rahoitus' }]);
    expect(answer.adopt).toMatchObject({ filters: { brand: ['Volvo'] }, priceMax: 30000 });
  });

  it('marks test requests and writes nothing down for them', async () => {
    const { client, calls } = clientWith({ '/ask/': { answer: 'ok' } }, { testMode: true });
    await client.ask('x');
    client.track('search', { query: 'x' });
    expect(JSON.parse(String(calls[0].init?.body)).testMode).toBe(true);
    expect(calls).toHaveLength(1);
  });
});

describe('settings', () => {
  it('uses the settings endpoint', async () => {
    const { client, calls } = clientWith({ '/omnibox/config/': configBody() });
    const config = await client.getConfig();
    expect(config).toMatchObject({ language: 'fi', accent: '#123456', questions: ['Mikä auto perheelle?'] });
    expect(calls[0].url).toContain('/api/public/omnibox/config/tool1');
    await client.getConfig();
    expect(calls).toHaveLength(1);
  });

  it('falls back to the whole tool document on servers without the endpoint', async () => {
    const doc = { type: 'searchbox', uid: 'secret', searchbox: { language: 'sv', questions: ['a', 'b', 'c', 'd'], questionsHidden: ['b'], placeholders: ['x', 'y'], placeholdersHidden: ['y'], aiEnabled: false, pages: [{ l: 'Kontakt', h: 'https://shop.test/kontakt', k: 'telefon' }] }, design: { primaryColor: '#abcdef' } };
    const { client, calls } = clientWith({ '/omnibox/config/': status(404), '/api/public/tid/': doc });
    const config = await client.getConfig();
    expect(config).toMatchObject({ language: 'sv', accent: '#abcdef', ai: false, questions: ['a', 'c', 'd'], placeholders: ['x'], pagesCount: 1 });
    expect(config).not.toHaveProperty('uid');
    expect(await client.getPages()).toEqual([{ label: 'Kontakt', url: 'https://shop.test/kontakt', keywords: 'telefon' }]);
    // One request for the document serves both settings and pages.
    expect(calls.filter((c) => c.url.includes('/api/public/tid/'))).toHaveLength(1);
  });

  it('falls back when the endpoint is missing and the browser hides the 404 behind a failed request', async () => {
    const doc = { type: 'searchbox', searchbox: { language: 'fi', accent: '#102F58', pages: [{ l: 'Rahoitus', h: 'https://shop.test/rahoitus' }] } };
    const calls: string[] = [];
    const fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      // What a cross-origin 404 without CORS headers looks like to a page.
      if (url.includes('/omnibox/config/')) throw new TypeError('Failed to fetch');
      return { ok: true, status: 200, json: async () => doc } as unknown as Response;
    }) as typeof globalThis.fetch;
    const client = serviceformSearch('tool1', { fetch, storage: false, apiBase: 'https://api.test' });
    expect(await client.getConfig()).toMatchObject({ language: 'fi', accent: '#102F58' });
    expect(await client.getPages()).toEqual([{ label: 'Rahoitus', url: 'https://shop.test/rahoitus', keywords: '' }]);
    // The missing endpoint is tried once, not again for the pages.
    expect(calls.filter((u) => u.includes('/omnibox/config/'))).toHaveLength(1);
  });

  it('answers from remembered settings at once and refreshes behind', async () => {
    const memory = new Map<string, string>();
    const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => { memory.set(k, v); } };
    const first = fakeFetch({ '/omnibox/config/': configBody({ accent: '#111111' }) });
    await serviceformSearch('tool1', { fetch: first.fetch, storage, apiBase: 'https://api.test' }).getConfig();

    const second = fakeFetch({ '/omnibox/config/': configBody({ accent: '#222222' }) });
    const client = serviceformSearch('tool1', { fetch: second.fetch, storage, apiBase: 'https://api.test', configMaxAge: 0 });
    expect(client.peekConfig()?.accent).toBe('#111111');
    expect((await client.getConfig()).accent).toBe('#111111');
    await new Promise((r) => setTimeout(r, 5));
    expect(client.peekConfig()?.accent).toBe('#222222');
  });

  it('reads settings a plugin wrote into the page, with no request', async () => {
    document.body.innerHTML = '<script type="application/json" data-sf-agenticsearch-config="tool1">{"language":"de","accent":"#0a0a0a"}</script>';
    const { fetch, calls } = fakeFetch({});
    const client = serviceformSearch('tool1', { fetch, storage: false, configMaxAge: 3600 });
    expect(client.peekConfig()).toMatchObject({ language: 'de', accent: '#0a0a0a' });
    expect((await client.getConfig()).language).toBe('de');
    document.body.innerHTML = '';
    expect(calls).toHaveLength(0);
  });

  it('still searches when the settings cannot be fetched', async () => {
    const { client } = clientWith({ '/omnibox/config/': status(500) });
    expect((await client.getConfig()).language).toBe('en');
  });

  it('says a document that is not a search tool is not one', () => {
    expect(configFromToolDoc('x', { type: 'form-endpoint', searchbox: {} })).toBeNull();
    expect(configFromToolDoc('x', '404')).toBeNull();
  });
});
