import { afterEach, describe, expect, it } from 'vitest';
import { agenticsearch, aiAnswer, autocomplete, currentRefinements, dynamicFacets, hits, infiniteHits, mount, mountAll, range, searchBox, sortBy, stats } from '../src';
import { shellHtml } from '../src/lib/shell';
import { keepForReturn } from '../src/lib/return';
import { browseBody, clientWith, configBody, fakeFetch, product, tick, type Call } from './helpers';

const host = () => { const node = document.createElement('div'); document.body.appendChild(node); return node; };
afterEach(() => { document.body.innerHTML = ''; document.head.querySelectorAll('style[data-sfas]').forEach((n) => n.remove()); history.replaceState(null, '', window.location.pathname); });

describe('DOM widgets', () => {
  it('draws hits as text, never as markup, and links only where it is safe', async () => {
    const { client } = clientWith({ '/browse/': browseBody({ state: undefined, products: [product(1, { t: '<img src=x onerror=alert(1)>', meta: '<b>x</b>', h: 'javascript:alert(1)' }), product(2)] }) });
    const node = host();
    agenticsearch({ searchClient: client, insights: false }).addWidgets([hits({ container: node })]).start();
    expect(node.querySelectorAll('.sfas-hit--ghost').length).toBe(6);
    await tick(5);
    const cards = node.querySelectorAll('.sfas-hit');
    expect(cards).toHaveLength(2);
    expect(node.querySelector('img[onerror]')).toBeNull();
    expect(cards[0].querySelector('.sfas-hit-title')!.textContent).toContain('<img src=x');
    expect(cards[0].querySelector('a')!.hasAttribute('href')).toBe(false);
    expect(cards[1].querySelector('a')!.getAttribute('href')).toBe('https://shop.test/p/2');
  });

  it('says so when nothing is found', async () => {
    const { client } = clientWith({ '/browse/': browseBody({ state: undefined, products: [], found: 0 }), '/omnibox/config/': configBody() });
    const node = host();
    agenticsearch({ searchClient: client, insights: false, initialState: { q: 'zzz' } }).addWidgets([infiniteHits({ container: node })]).start();
    await tick(5);
    expect(node.querySelector('.sfas-empty-title')!.textContent).toBe('Ei tuloksia haulle “zzz”');
    expect((node.querySelector('.sfas-more') as HTMLElement).hidden).toBe(true);
  });

  it('searches as the field is typed in and starts over on Enter', async () => {
    const { client, calls } = clientWith({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody({ ai: false }) });
    const node = host();
    const search = agenticsearch({ searchClient: client, insights: false, searchOnStart: false, initialState: { filters: { brand: ['Volvo'] } } });
    search.addWidgets([searchBox({ container: node, debounce: 0 })]).start();
    const input = node.querySelector('input')!;
    expect(input.placeholder).toBe('Search');
    await tick(5);
    // The tool's own placeholder once its settings are in.
    expect(input.placeholder).toBe('Hae autoa');
    input.value = 'xc40';
    input.dispatchEvent(new Event('input'));
    await tick(10);
    expect(search.state).toMatchObject({ q: 'xc40', filters: { brand: ['Volvo'] } });
    input.value = 'audi';
    node.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(search.state).toMatchObject({ q: 'audi', filters: {} });
    await tick(5);
    expect(calls.filter((c) => c.url.includes('/browse/')).length).toBeGreaterThan(1);
  });

  it('builds the filters the catalogue has, in the order the tool asks for', async () => {
    const { client } = clientWith({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody({ facets: ['year', 'brand', 'nothere'], facetStyles: { brand: 'buttons' }, facetLabels: { brand: 'Automerkki' } }) });
    const node = host();
    const search = agenticsearch({ searchClient: client, insights: false });
    search.addWidgets([dynamicFacets({ container: node })]).start();
    await tick(10);
    const groups = Array.from(node.querySelectorAll('.sfas-facet'));
    expect(groups.map((g) => g.querySelector('.sfas-facet-title')!.textContent)).toEqual(['Vuosimalli', 'Automerkki']);
    expect(groups[0].classList.contains('sfas-facet--range')).toBe(true);
    (groups[1].querySelector('.sfas-facet-pill') as HTMLButtonElement).click();
    expect(search.state.filters.brand).toEqual(['Volvo']);
  });

  it('shows chips, count and order from the results', async () => {
    const { client } = clientWith({ '/browse/': browseBody({ found: 1234, chips: [{ k: 'brand', l: 'Volvo' }, { k: 'price', l: 'alle 30 000 €' }] }), '/omnibox/config/': configBody() });
    const [a, b, c] = [host(), host(), host()];
    const search = agenticsearch({ searchClient: client, insights: false });
    search.addWidgets([currentRefinements({ container: a }), stats({ container: b }), sortBy({ container: c })]).start();
    await tick(10);
    expect(Array.from(a.querySelectorAll('.sfas-chip span')).map((n) => n.textContent)).toEqual(['Volvo', 'alle 30 000 €']);
    expect(a.querySelector('.sfas-clear')).not.toBeNull();
    expect(b.textContent).toMatch(/^1.234 tulosta$/);
    expect(Array.from(c.querySelectorAll('option')).map((o) => o.value)).toEqual(['relevance', 'price_asc', 'price_desc', 'year_desc', 'year_asc']);
  });

  it('shows the AI answer with its sources and the notice', async () => {
    const { client } = clientWith({
      '/browse/': browseBody({ state: undefined }),
      '/ask/': { answer: 'Toimitamme koko Suomeen.', intent: 'general', links: [{ l: 'Toimitus', h: 'https://shop.test/toimitus' }] },
      '/omnibox/config/': configBody({ aiDisclaimer: 'Vastaus on tekoälyn tuottama.' }),
    });
    const node = host();
    const search = agenticsearch({ searchClient: client, insights: false, searchOnStart: false });
    search.addWidgets([aiAnswer({ container: node })]).start();
    await tick(2);
    expect(node.hidden).toBe(true);
    void search.ask('toimitatteko');
    expect(node.querySelector('[aria-busy="true"]')).not.toBeNull();
    await tick(10);
    expect(node.querySelector('.sfas-answer-text')!.textContent).toBe('Toimitamme koko Suomeen.');
    expect(node.querySelector('.sfas-answer-links a')!.getAttribute('href')).toBe('https://shop.test/toimitus');
    expect(node.querySelector('.sfas-answer-disclaimer')!.textContent).toBe('Vastaus on tekoälyn tuottama.');
  });

  it('autocomplete lists products, pages and suggestions, and Enter goes to the results page', async () => {
    const went: string[] = [];
    const { client } = clientWith({
      '/search/': { products: [product(40)], found: 12, suggestions: [{ t: 'volvo xc40', b: 5 }] },
      '/omnibox/config/': (call: Call) => (call.url.includes('part=pages') ? { v: 1, pages: [{ l: 'Volvo-huolto', h: 'https://shop.test/huolto' }] } : configBody()),
    });
    const node = host();
    const search = agenticsearch({ searchClient: client, insights: false, results: false });
    search.addWidgets([autocomplete({ container: node, limit: 4, onSubmit: (q) => went.push(q) })]).start();
    await tick(5);
    const input = node.querySelector('input')!;
    const panel = node.querySelector('.sfas-panel') as HTMLElement;
    expect(panel.hidden).toBe(true);
    input.value = 'volvo';
    input.dispatchEvent(new Event('input'));
    await tick(200);
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector('.sfas-hit-title')!.textContent).toBe('Volvo XC40 2020');
    expect(panel.querySelector('.sfas-panel-all')!.textContent).toContain('(12)');
    expect(Array.from(panel.querySelectorAll('.sfas-panel-row')).map((n) => n.textContent)).toEqual(['Volvo-huolto', 'volvo xc40']);
    expect(panel.querySelector('.sfas-panel-ask')!.textContent).toContain('“volvo”');
    node.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(went).toEqual(['volvo']);
    expect(panel.hidden).toBe(true);
  });
});

describe('the field and the filters, as on the search page', () => {
  it('a results-page field has a send button, and the assistant\'s face once the settings say so', async () => {
    const { client } = clientWith({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody({ assistantAvatar: 'https://cdn.test/face.png' }) });
    const node = host();
    agenticsearch({ searchClient: client, insights: false, searchOnStart: false }).addWidgets([searchBox({ container: node })]).start();
    const go = node.querySelector('.sfas-input-go') as HTMLButtonElement;
    expect(go.type).toBe('submit');
    const face = node.querySelector('.sfas-input-face') as HTMLImageElement;
    expect(face.hidden).toBe(true);
    expect((node.querySelector('.sfas-input-icon') as HTMLElement).hidden).toBe(false);
    await tick(5);
    expect(face.hidden).toBe(false);
    expect(face.getAttribute('src')).toBe('https://cdn.test/face.png');
    expect((node.querySelector('.sfas-input-icon') as HTMLElement).hidden).toBe(true);
  });

  it('a range is its name with the span beside it and a slider; the fields only when asked for', async () => {
    const { client } = clientWith({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody() });
    const [a, b] = [host(), host()];
    agenticsearch({ searchClient: client, insights: false }).addWidgets([range({ container: a, attribute: 'year' }), range({ container: b, attribute: 'year', fields: true })]).start();
    await tick(5);
    const head = a.querySelector('.sfas-range-head')!;
    expect(head.querySelector('.sfas-facet-title')!.textContent).toBe('Vuosimalli');
    expect(head.querySelector('.sfas-range-said')!.textContent).toBe('2015 – 2024');
    expect(a.querySelector('.sfas-range-input')).toBeNull();
    expect(a.querySelectorAll('.sfas-range-slider input')).toHaveLength(2);
    expect(a.querySelector('.sfas-range-filled')).not.toBeNull();
    expect(b.querySelectorAll('.sfas-range-input')).toHaveLength(2);
  });

  it('the shell of a page puts the field over the results, beside the filters', () => {
    expect(shellHtml('page', 'Hae')).toBe('<div class="sfas-shell-body"><div class="sfas-shell-side"></div><div class="sfas-shell-main"><div class="sfas-shell-field"><span class="sfas-shell-icon"></span><span class="sfas-shell-text">Hae</span></div><div class="sfas-shell-grid"><i></i><i></i><i></i><i></i><i></i><i></i></div></div></div>');
    expect(shellHtml('box', 'Hae')).toBe('<div class="sfas-shell-field"><span class="sfas-shell-icon"></span><span class="sfas-shell-text">Hae</span></div>');
  });
});

describe('what dev added: where a result opens, the way back, the extra button', () => {
  it('results open in a new tab unless the tool or the mount says this one', async () => {
    const { client } = clientWith({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody() });
    const [a, b] = [host(), host()];
    agenticsearch({ searchClient: client, insights: false }).addWidgets([hits({ container: a })]).start();
    agenticsearch({ searchClient: client, insights: false, openInNewTab: false }).addWidgets([hits({ container: b })]).start();
    await tick(10);
    const first = a.querySelector('.sfas-hit-link') as HTMLAnchorElement;
    expect(first.target).toBe('_blank');
    expect(first.rel).toBe('noopener noreferrer');
    expect((b.querySelector('.sfas-hit-link') as HTMLAnchorElement).hasAttribute('target')).toBe(false);
    const { client: same } = clientWith({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody({ openInNewTab: false }) });
    const c = host();
    agenticsearch({ searchClient: same, insights: false }).addWidgets([hits({ container: c })]).start();
    await tick(10);
    expect((c.querySelector('.sfas-hit-link') as HTMLAnchorElement).hasAttribute('target')).toBe(false);
  });

  it('the extra button is there when nothing is found and its element is on the page, and clicks it', async () => {
    const { client } = clientWith({ '/browse/': browseBody({ state: undefined, products: [], found: 0 }), '/omnibox/config/': configBody({ emptyButton: { label: '', selector: '#bubble' } }) });
    const node = host();
    agenticsearch({ searchClient: client, insights: false, initialState: { q: 'zzz' } }).addWidgets([infiniteHits({ container: node })]).start();
    await tick(10);
    expect(node.querySelector('.sfas-empty-button')).toBeNull();
    const bubble = document.createElement('div'); bubble.id = 'bubble';
    const inner = document.createElement('span'); bubble.appendChild(inner); document.body.appendChild(bubble);
    let clicked = 0;
    bubble.addEventListener('click', () => { clicked += 1; });
    const { client: again } = clientWith({ '/browse/': browseBody({ state: undefined, products: [], found: 0 }), '/omnibox/config/': configBody({ emptyButton: { label: '', selector: '#bubble' } }) });
    const other = host();
    agenticsearch({ searchClient: again, insights: false, initialState: { q: 'zzz' } }).addWidgets([infiniteHits({ container: other })]).start();
    await tick(10);
    const b = other.querySelector('.sfas-empty-button') as HTMLButtonElement;
    expect(b.textContent).toBe('Kysy chatissa');
    b.click();
    expect(clicked).toBe(1);
  });

  it('on the way back from a result opened in this tab the words are in the field again', async () => {
    const { client } = clientWith({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody({ openInNewTab: false }) });
    const tool = 'tool1';
    keepForReturn(tool, 'punainen volvo');
    const back = () => [{ type: 'back_forward' }];
    const original = performance.getEntriesByType;
    performance.getEntriesByType = back as unknown as typeof performance.getEntriesByType;
    try {
      const node = host();
      agenticsearch({ searchClient: client, insights: false, searchOnStart: false }).addWidgets([autocomplete({ container: node })]).start();
      expect((node.querySelector('.sfas-input') as HTMLInputElement).value).toBe('punainen volvo');
      // Read once: the next box on this load starts empty.
      const other = host();
      agenticsearch({ searchClient: client, insights: false, searchOnStart: false }).addWidgets([autocomplete({ container: other })]).start();
      expect((other.querySelector('.sfas-input') as HTMLInputElement).value).toBe('');
    } finally { performance.getEntriesByType = original; }
  });
});

describe('prebuilt mount', () => {
  it('lays the page out with the filters as a card headed by the count and the order, the field over the results', async () => {
    const { fetch } = fakeFetch({ '/browse/': (call: Call) => browseBody({ state: undefined, found: 1234, chips: call.url.includes('f.brand=Volvo') ? [{ k: 'brand', l: 'Volvo' }] : [] }), '/omnibox/config/': configBody() });
    globalThis.fetch = fetch;
    const node = host();
    const mounted = mount({ toolId: 'toolL', target: node, layout: 'page', apiBase: 'https://api.test' });
    await tick(10);
    const side = node.querySelector('.sfas-page-side')!;
    const main = node.querySelector('.sfas-page-main')!;
    expect(main.querySelector('.sfas-page-top .sfas-searchbox')).not.toBeNull();
    expect(side.querySelector('.sfas-searchbox')).toBeNull();
    // The count heads the card, the order is its first group, the filters follow, "clear" closes it.
    const parts = Array.from(side.children).map((c) => c.className);
    expect(parts.indexOf('sfas-page-count')).toBeLessThan(parts.indexOf('sfas-page-sortgroup'));
    expect(side.querySelector('.sfas-page-count')!.textContent).toMatch(/^1.234 tulosta$/);
    expect(side.querySelector('.sfas-page-sortgroup .sfas-facet-title')!.textContent).toBe('Järjestys');
    expect(side.querySelector('.sfas-page-sortgroup .sfas-sort')).not.toBeNull();
    expect(side.querySelectorAll('.sfas-facet').length).toBeGreaterThan(0);
    expect(side.querySelector('.sfas-side-clear .sfas-clear')).not.toBeNull();
    // Nothing on the line over the results while no filter is on.
    const tools = main.querySelector('.sfas-page-tools')!;
    expect(tools.classList.contains('is-bare')).toBe(true);
    expect(tools.querySelector('.sfas-page-count')).toBeNull();
    mounted.instance.setRefinements('brand', ['Volvo']);
    await tick(10);
    expect(tools.classList.contains('is-bare')).toBe(false);
    expect(tools.querySelector('.sfas-chip')).not.toBeNull();
    mounted.destroy();
  });

  it('with the filters turned off on the tool the count and the order are on the line over the results', async () => {
    const { fetch } = fakeFetch({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody({ showFilters: false }) });
    globalThis.fetch = fetch;
    const node = host();
    const mounted = mount({ toolId: 'toolN', target: node, layout: 'page', apiBase: 'https://api.test' });
    await tick(10);
    expect(node.querySelector('.sfas-page')!.classList.contains('sfas-page--nofilters')).toBe(true);
    const tools = node.querySelector('.sfas-page-tools')!;
    expect(tools.querySelector('.sfas-page-count')).not.toBeNull();
    expect(tools.querySelector('.sfas-page-sort .sfas-sort')).not.toBeNull();
    expect(tools.classList.contains('is-bare')).toBe(false);
    mounted.destroy();
  });


  it('mounts declared elements from their data attributes, replacing the shell', async () => {
    const { fetch, calls } = fakeFetch({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody() });
    globalThis.fetch = fetch;
    document.body.innerHTML = `
      <div id="p" class="sfas sfas-shell sfas-shell--page" data-sf-agenticsearch data-tool-id="toolA" data-layout="page" data-search-param="s" data-accent="#00ff00" data-api-base="https://api.test"><div class="sfas-shell-field">x</div></div>
      <script type="application/json" data-sf-agenticsearch-config="toolA">{"language":"fi","questions":["Mikä auto perheelle?"],"accent":"#ff0000"}</script>
      <div id="b" data-sf-agenticsearch data-tool-id="toolA" data-layout="box" data-search-page="/haku" data-api-base="https://api.test"></div>
      <div id="none" data-sf-agenticsearch></div>`;
    const results = mountAll();
    expect(results.map((r) => r.layout)).toEqual(['page', 'box']);
    const page = document.getElementById('p')!;
    expect(page.querySelector('.sfas-shell-field')).toBeNull();
    expect(page.classList.contains('sfas-shell')).toBe(false);
    expect(page.querySelector('.sfas-page .sfas-searchbox input')).not.toBeNull();
    // The inline settings draw the first frame: Finnish words, the element's own accent over the tool's.
    expect((page.querySelector('.sfas-input') as HTMLInputElement).placeholder).toBe('Hae');
    expect(page.lang).toBe('fi');
    expect(page.style.getPropertyValue('--sfas-accent')).toBe('#00ff00');
    expect(document.head.querySelector('style[data-sfas]')).not.toBeNull();
    await tick(10);
    expect(page.querySelectorAll('.sfas-hit').length).toBe(2);
    expect(page.querySelector('.sfas-question')!.textContent).toBe('Mikä auto perheelle?');
    // Only the page runs the faceted search; the box waits to be typed in.
    expect(calls.filter((c) => c.url.includes('/browse/'))).toHaveLength(1);
    expect(mountAll()).toHaveLength(0);
    results.forEach((r) => r.destroy());
    expect(page.querySelector('.sfas-page')).toBeNull();
  });

  it('opens the modal from its trigger and closes on Escape', async () => {
    const { fetch } = fakeFetch({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody() });
    globalThis.fetch = fetch;
    const node = host();
    const mounted = mount({ toolId: 'toolB', target: node, layout: 'modal', apiBase: 'https://api.test', placeholder: 'Etsi' });
    const trigger = node.querySelector('.sfas-trigger') as HTMLButtonElement;
    expect(trigger.textContent).toContain('Etsi');
    expect(document.querySelector('.sfas-modal')).toBeNull();
    trigger.click();
    const modal = document.querySelector('.sfas-modal') as HTMLElement;
    expect(modal.hidden).toBe(false);
    expect(document.documentElement.classList.contains('sfas-lock')).toBe(true);
    await tick(10);
    expect(modal.querySelectorAll('.sfas-hit').length).toBe(2);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(modal.hidden).toBe(true);
    expect(document.documentElement.classList.contains('sfas-lock')).toBe(false);
    mounted.destroy();
    expect(document.querySelector('.sfas-modal')).toBeNull();
  });

  it('takes itself down and says so when the tool does not exist', async () => {
    const { fetch } = fakeFetch({ '/api/public/tid/': '404' });
    globalThis.fetch = fetch;
    const node = host();
    let told = '';
    document.addEventListener('sfas:unavailable', (event) => { told = (event as CustomEvent).detail.toolId; }, { once: true });
    mount({ toolId: 'gone', target: node, layout: 'box', apiBase: 'https://api.test' });
    expect(node.querySelector('input')).not.toBeNull();
    await tick(10);
    expect(told).toBe('gone');
    expect(node.hidden).toBe(true);
    expect(node.querySelector('input')).toBeNull();
  });

  it('stays up when the settings are merely unreachable', async () => {
    const { fetch } = fakeFetch({ '/omnibox/config/': { __raw: true, status: 503, body: {} } });
    globalThis.fetch = fetch;
    const node = host();
    mount({ toolId: 'flaky', target: node, layout: 'box', apiBase: 'https://api.test' });
    await tick(10);
    expect(node.hidden).toBe(false);
    expect(node.querySelector('input')).not.toBeNull();
  });

  it('opens one modal on the shortcut however many triggers the header has, and never looks like a theme search form', async () => {
    const { fetch } = fakeFetch({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody() });
    globalThis.fetch = fetch;
    const a = mount({ toolId: 'toolC', target: host(), layout: 'modal', apiBase: 'https://api.test' });
    const b = mount({ toolId: 'toolC', target: host(), layout: 'modal', apiBase: 'https://api.test' });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    expect(document.querySelectorAll('.sfas-modal')).toHaveLength(1);
    expect(document.querySelector('form[role="search"]')).toBeNull();
    a.destroy(); b.destroy();
  });

  it('leaves alone what another copy of the script already mounted', () => {
    document.body.innerHTML = '<div data-sf-agenticsearch data-tool-id="toolD" data-sfas-mounted="box"><b>theirs</b></div>';
    expect(mountAll()).toHaveLength(0);
    expect(document.querySelector('b')!.textContent).toBe('theirs');
  });

  it('opens a landing page on the search it was given, and lets the address override it', async () => {
    const { fetch, calls } = fakeFetch({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody() });
    globalThis.fetch = fetch;
    document.body.innerHTML = '<div id="lp" data-sf-agenticsearch data-tool-id="toolL" data-layout="page" data-routing="false" data-state="f.brand=Volvo&f.fuel=ELECTRIC&price_max=30000&sort=price_asc" data-api-base="https://api.test"></div>';
    const [landing] = mountAll();
    await tick(10);
    expect(decodeURIComponent(calls.find((c) => c.url.includes('/browse/'))!.url)).toContain('f.brand=Volvo&f.fuel=ELECTRIC&price_max=30000&sort=price_asc');
    expect(window.location.search).toBe('');
    landing.destroy();

    window.history.replaceState(null, '', '/?f.brand=Audi');
    const other = mount({ toolId: 'toolL2', target: host(), layout: 'page', apiBase: 'https://api.test', initialState: { filters: { brand: ['Volvo'] } } });
    await tick(10);
    expect(other.instance.state.filters).toEqual({ brand: ['Audi'] });
    other.destroy();
    window.history.replaceState(null, '', '/');
  });

  it('keeps a server-rendered shell up until the settings arrive, then draws in the right language', async () => {
    let release: (v: unknown) => void = () => {};
    const gate = new Promise((r) => { release = r; });
    const { fetch } = fakeFetch({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': async () => { await gate; return configBody(); } });
    globalThis.fetch = fetch;
    document.body.innerHTML = '<div id="s" class="sfas sfas-shell sfas-shell--box" data-sf-agenticsearch data-tool-id="toolS" data-layout="box" data-api-base="https://api.test"><div class="sfas-shell-field"><span class="sfas-shell-text">Hae</span></div></div>';
    const [m] = mountAll();
    await tick(20);
    expect(document.querySelector('#s .sfas-shell-field')).not.toBeNull();
    expect(document.querySelector('#s .sfas-input')).toBeNull();
    release(null);
    await tick(20);
    expect(document.querySelector('#s .sfas-shell-field')).toBeNull();
    expect((document.querySelector('#s .sfas-input') as HTMLInputElement).placeholder).toBe('Hae autoa');
    expect(mountAll()).toHaveLength(0);
    m.destroy();
    expect(document.querySelector('#s .sfas-input')).toBeNull();
  });
});
