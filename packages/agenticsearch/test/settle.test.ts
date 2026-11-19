import { describe, expect, it } from 'vitest';
import { agenticsearch } from '../src';
import { browseBody, clientWith, tick, type Call } from './helpers';

// As the server does: a shop's search for words says how it was ordered, and only waits when asked to.
const shop = ({ url }: Call) => {
  const meaning = /[?&]rank=meaning/.test(url);
  const q = decodeURIComponent((/[?&]q=([^&]*)/.exec(url) || [])[1] || '');
  const state = { q, filters: {}, ranges: {}, price_min: null, price_max: null, sort: 'relevance', in_stock: false, kind: '' };
  return browseBody({ q, state, ...(q ? { ranked: meaning ? 'meaning' : 'words' } : {}), found: meaning ? 9 : 2 });
};
const browse = (calls: Call[]) => calls.filter((c) => c.url.includes('/browse/'));
const byMeaning = (calls: Call[]) => browse(calls).map((c) => /[?&]rank=meaning/.test(c.url));

describe('a shop\'s results while typing', () => {
  it('answers typing by the words, then asks once for the order by meaning when the typing stops', async () => {
    const { client, calls } = clientWith({ '/browse/': shop });
    const search = agenticsearch({ searchClient: client, insights: false, searchOnStart: false }).start();
    search.setQuery('proteiini');
    await tick(20);
    expect(byMeaning(calls)).toEqual([false]);
    expect(search.results?.ranked).toBe('words');
    await tick(700);
    expect(byMeaning(calls)).toEqual([false, true]);
    expect(search.results?.ranked).toBe('meaning');
    expect(search.results?.found).toBe(9);
    await tick(700);
    expect(browse(calls)).toHaveLength(2);
    search.dispose();
  });

  it('does not ask for a search the visitor has typed past', async () => {
    const { client, calls } = clientWith({ '/browse/': shop });
    const search = agenticsearch({ searchClient: client, insights: false, searchOnStart: false }).start();
    search.setQuery('prot');
    await tick(20);
    search.setQuery('proteiini');
    await tick(720);
    const settled = browse(calls).filter((c) => /rank=meaning/.test(c.url));
    expect(settled).toHaveLength(1);
    expect(settled[0].url).toContain('q=proteiini');
    search.dispose();
  });

  it('asks at once when the field is left', async () => {
    const { client, calls } = clientWith({ '/browse/': shop });
    const search = agenticsearch({ searchClient: client, insights: false, searchOnStart: false }).start();
    search.setQuery('proteiini');
    await tick(20);
    search.settle();
    await tick(20);
    expect(byMeaning(calls)).toEqual([false, true]);
    search.dispose();
  });

  it('puts a page opened on a search in order of meaning straight away, and asks by meaning for a filter after that', async () => {
    const { client, calls } = clientWith({ '/browse/': shop });
    const search = agenticsearch({ searchClient: client, insights: false, initialState: { q: 'proteiini' } as never }).start();
    await tick(40);
    expect(byMeaning(calls)).toEqual([false, true]);
    search.toggleRefinement('brand', 'Volvo');
    await tick(40);
    expect(byMeaning(calls)).toEqual([false, true, true]);
    search.dispose();
  });

  it('asks cars and homes exactly as before', async () => {
    const { client, calls } = clientWith({ '/browse/': browseBody() });
    const search = agenticsearch({ searchClient: client, insights: false, searchOnStart: false }).start();
    search.setQuery('volvo');
    await tick(700);
    search.toggleRefinement('brand', 'Volvo');
    await tick(20);
    expect(byMeaning(calls)).toEqual([false, false]);
    search.dispose();
  });
});
