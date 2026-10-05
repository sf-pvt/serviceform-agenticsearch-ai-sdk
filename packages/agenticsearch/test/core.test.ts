import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agenticsearch } from '../src';
import { connectAutocomplete, connectCurrentRefinements, connectInfiniteHits, connectRange, connectRefinementList } from '../src/connectors';
import { browseBody, clientWith, configBody, product, tick, type Call } from './helpers';

const wireState = (over: Record<string, unknown> = {}) => ({ q: '', filters: {}, ranges: {}, price_min: null, price_max: null, sort: 'relevance', in_stock: false, kind: '', ...over });

describe('AgenticSearch', () => {
  it('searches on start and hands widgets the results', async () => {
    const { client, calls } = clientWith({ '/browse/': browseBody(), '/omnibox/config/': configBody() });
    const seen: number[] = [];
    const search = agenticsearch({ searchClient: client, insights: false });
    search.addWidgets([{ $$type: 'test', render: ({ results }) => { if (results) seen.push(results.found); } }]);
    search.start();
    await tick(5);
    expect(seen.at(-1)).toBe(2);
    expect(calls.filter((c) => c.url.includes('/browse/'))).toHaveLength(1);
    expect(search.config.language).toBe('fi');
    expect(search.strings.search).toBe('Hae');
  });

  it('makes one request for several changes in the same tick', async () => {
    const { client, calls } = clientWith({ '/browse/': browseBody() });
    const search = agenticsearch({ searchClient: client, insights: false, searchOnStart: false }).start();
    search.toggleRefinement('brand', 'Volvo');
    search.setSort('price_asc');
    search.setRange('price', null, 3000000);
    await tick(5);
    const browse = calls.filter((c) => c.url.includes('/browse/'));
    expect(browse).toHaveLength(1);
    expect(decodeURIComponent(browse[0].url)).toContain('f.brand=Volvo&price_max=3000000&sort=price_asc');
  });

  it('takes on the state the server read out of the words', async () => {
    const { client } = clientWith({ '/browse/': browseBody({ read: true, state: wireState({ q: 'volvo', filters: { colour: ['Red'] }, price_max: 30000 }), chips: [{ k: 'colour', l: 'Punainen' }, { k: 'price', l: 'alle 30 000' }] }) });
    const search = agenticsearch({ searchClient: client, insights: false, searchOnStart: false }).start();
    search.setQuery('punainen volvo alle 30k');
    await tick(5);
    expect(search.state).toMatchObject({ q: 'volvo', filters: { colour: ['Red'] }, priceMax: 30000 });
  });

  it('ignores an answer to a search that has been replaced', async () => {
    let n = 0;
    const { client } = clientWith({ '/browse/': async () => { n += 1; const mine = n; await tick(mine === 1 ? 30 : 1); return browseBody({ found: mine, state: undefined }); } });
    const search = agenticsearch({ searchClient: client, insights: false, searchOnStart: false }).start();
    search.setQuery('a');
    await tick(2);
    search.setQuery('ab');
    await tick(50);
    expect(search.results?.found).toBe(2);
    expect(search.state.q).toBe('ab');
  });

  it('removes what a chip stands for', async () => {
    const { client } = clientWith({ '/browse/': browseBody({ state: undefined }) });
    const search = agenticsearch({ searchClient: client, insights: false, searchOnStart: false, initialState: { q: 'volvo vetokoukku', filters: { brand: ['Volvo'] }, ranges: { year: { min: 2018, max: null } }, priceMax: 100, sort: 'price_asc', kind: 'small' } }).start();
    search.clearRefinement('brand');
    search.clearRefinement('year');
    search.clearRefinement('price');
    search.clearRefinement('sort');
    search.clearRefinement('kind');
    search.clearRefinement('q:vetokoukku');
    expect(search.state).toMatchObject({ q: 'volvo', filters: {}, ranges: {}, priceMax: null, sort: 'relevance', kind: '' });
  });

  it('goes back to the first page when the search changes, and not when the page does', async () => {
    const { client } = clientWith({ '/browse/': browseBody({ state: undefined }) });
    const search = agenticsearch({ searchClient: client, insights: false, searchOnStart: false }).start();
    search.setPage(3);
    expect(search.state.page).toBe(3);
    search.toggleRefinement('brand', 'Volvo');
    expect(search.state.page).toBe(1);
  });

  it('asks the AI on submit and adopts its reading when the search read nothing', async () => {
    const asked: any[] = [];
    const { client } = clientWith({
      '/browse/': browseBody({ state: undefined, read: false }),
      '/ask/': (call: Call) => { asked.push(JSON.parse(String(call.init?.body))); return { answer: 'Perheelle sopii farmari.', intent: 'catalogue', products: [product(90)], adopt: wireState({ filters: { body_style: ['WAGON'] } }), filters: { body_style: ['WAGON'] } }; },
      '/omnibox/config/': configBody(),
    });
    const search = agenticsearch({ searchClient: client, insights: false, searchOnStart: false }).start();
    await tick(2);
    search.submit('jotain vaimolle työmatkoihin');
    await tick(10);
    expect(search.ai).toMatchObject({ status: 'done', question: 'jotain vaimolle työmatkoihin' });
    expect(search.ai.answer?.answer).toBe('Perheelle sopii farmari.');
    expect(search.state.filters).toEqual({ body_style: ['WAGON'] });
    // A follow-up carries the conversation and the last reading.
    search.submit('entä punainen');
    await tick(10);
    expect(asked[1].history).toHaveLength(2);
    expect(asked[1].previous).toMatchObject({ filters: { body_style: ['WAGON'] } });
  });

  it('does not ask when the tool has AI off', async () => {
    const { client, calls } = clientWith({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody({ ai: false }) });
    const search = agenticsearch({ searchClient: client, insights: false, searchOnStart: false }).start();
    await tick(2);
    search.submit('volvo');
    await tick(5);
    expect(calls.some((c) => c.url.includes('/ask/'))).toBe(false);
  });
});

describe('routing', () => {
  beforeEach(() => window.history.replaceState(null, '', '/haku?utm_source=mail&s=volvo&f.brand=Volvo'));
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('opens with the search in the address and writes changes back, leaving foreign parameters alone', async () => {
    const { client, calls } = clientWith({ '/browse/': browseBody({ state: undefined }) });
    const search = agenticsearch({ searchClient: client, insights: false, routing: { queryParam: 's' } }).start();
    await tick(5);
    expect(decodeURIComponent(calls.find((c) => c.url.includes('/browse/'))!.url)).toContain('q=volvo&f.brand=Volvo');
    search.setSort('price_asc');
    expect(decodeURIComponent(window.location.search)).toBe('?utm_source=mail&s=volvo&f.brand=Volvo&sort=price_asc');
    search.dispose();
  });
});

describe('insights', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('writes a settled search down once, and a click with its position', async () => {
    const { client, calls } = clientWith({ '/browse/': browseBody({ state: undefined }), '/analytics/': {} });
    const search = agenticsearch({ searchClient: client, searchOnStart: false }).start();
    search.setQuery('vol');
    await vi.advanceTimersByTimeAsync(200);
    search.setQuery('volvo');
    await vi.advanceTimersByTimeAsync(2000);
    search.setQuery('volvo');
    await vi.advanceTimersByTimeAsync(2000);
    const events = calls.filter((c) => c.url.includes('/api/analytics/search')).map((c) => JSON.parse(String(c.init?.body)));
    expect(events.map((e) => e.type)).toEqual(['search']);
    expect(events[0].data).toMatchObject({ query: 'volvo', toolId: 'tool1', resultsCount: 2 });
    search.sendClick(search.results!.hits[1], 1);
    const click = JSON.parse(String(calls.at(-1)!.init?.body));
    expect(click).toMatchObject({ type: 'click', data: { searchQuery: 'volvo', resultId: '60', resultPosition: 1, resultPrice: 29900 } });
  });
});

describe('connectors', () => {
  const run = async (routes: Record<string, unknown>, initialState = {}) => {
    const { client, calls } = clientWith({ '/omnibox/config/': configBody(), ...routes });
    const search = agenticsearch({ searchClient: client, insights: false, initialState });
    return { search, calls };
  };

  it('refinementList keeps what is ticked listed, and labels values', async () => {
    const { search } = await run({ '/browse/': browseBody({ state: undefined }) }, { filters: { brand: ['Saab'] } });
    let last: any;
    search.addWidgets([connectRefinementList((s) => { last = s; })({ attribute: 'brand', limit: 2 })]).start();
    await tick(5);
    expect(last.items.map((i: any) => [i.value, i.label, i.isRefined])).toEqual([['Saab', 'Saab', true], ['Volvo', 'Volvo', false]]);
    expect(last.canToggleShowMore).toBe(true);
    last.searchForItems('aud');
    expect(last.items.map((i: any) => i.label)).toEqual(['Audi']);
    last.refine('Volvo');
    expect(search.state.filters.brand).toEqual(['Saab', 'Volvo']);
  });

  it('range speaks currency units when the index stores cents', async () => {
    const { search } = await run({ '/browse/': browseBody({ state: undefined }) });
    let last: any;
    search.addWidgets([connectRange((s) => { last = s; })({ attribute: 'price' })]).start();
    await tick(5);
    expect(last.range).toEqual({ min: 5000, max: 45000 });
    last.refine([null, 30000]);
    expect(search.state.priceMax).toBe(3000000);
    await tick(5);
    expect(last.start).toEqual([null, 30000]);
  });

  it('currentRefinements lists the server chips, each removable', async () => {
    const { search } = await run({ '/browse/': browseBody({ state: wireState({ filters: { brand: ['Volvo'] }, sort: 'price_asc' }), chips: [{ k: 'brand', l: 'Volvo' }, { k: 'sort', l: 'Halvin ensin' }] }) }, { filters: { brand: ['Volvo'] }, sort: 'price_asc' });
    let last: any;
    search.addWidgets([connectCurrentRefinements((s) => { last = s; })({})]).start();
    await tick(5);
    expect(last.items.map((i: any) => i.label)).toEqual(['Volvo', 'Halvin ensin']);
    expect(last.count).toBe(1);
    last.items[0].refine();
    expect(search.state.filters).toEqual({});
  });

  it('infiniteHits adds pages up and starts over when the search changes', async () => {
    const { search } = await run({ '/browse/': (call: Call) => {
      const page = Number(new URL(call.url).searchParams.get('page') || 1);
      return browseBody({ page, has_more: page < 2, products: [product(page * 10), product(page * 10 + 1)], state: undefined });
    } });
    let last: any;
    search.addWidgets([connectInfiniteHits((s) => { last = s; })({})]).start();
    await tick(5);
    expect(last.hits).toHaveLength(2);
    last.showMore();
    await tick(5);
    expect(last.hits.map((h: any) => h.id)).toEqual(['10', '11', '20', '21']);
    expect(last.isLastPage).toBe(true);
    search.setQuery('audi');
    await tick(5);
    expect(last.hits.map((h: any) => h.id)).toEqual(['10', '11']);
  });

  it('autocomplete looks up products and matches the site pages locally', async () => {
    const { search, calls } = await run({
      '/search/': { products: [product(40)], found: 9, suggestions: [{ t: 'volvo xc40', b: 5 }], understood: { chips: [{ k: 'brand', l: 'Volvo' }] } },
      '/omnibox/config/': (call: Call) => (call.url.includes('part=pages') ? { v: 1, pages: [{ l: 'Volvo-huolto', h: 'https://shop.test/huolto' }, { l: 'Yhteystiedot', h: 'https://shop.test/yhteys' }] } : configBody()),
    });
    let last: any;
    const instance = agenticsearch({ searchClient: search.client, insights: false, results: false });
    instance.addWidgets([connectAutocomplete((s) => { last = s; })({ debounce: 0 })]).start();
    await tick(2);
    last.refine('volvo');
    await tick(10);
    expect(last.hits[0].title).toBe('Volvo XC40');
    expect(last.found).toBe(9);
    expect(last.suggestions).toEqual([{ text: 'volvo xc40', boldFrom: 5 }]);
    expect(last.pages.map((p: any) => p.label)).toEqual(['Volvo-huolto']);
    expect(last.chips).toEqual([{ key: 'brand', label: 'Volvo' }]);
    // A header box never runs the faceted search.
    expect(calls.some((c) => c.url.includes('/browse/'))).toBe(false);
  });
});
