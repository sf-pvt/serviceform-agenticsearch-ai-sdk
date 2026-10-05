import { afterEach, describe, expect, it } from 'vitest';
import { createApp, createSSRApp, defineComponent, h, nextTick, type App } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { AgenticSearch, AgenticSearchProvider, useHits, useRefinementList, useSearchBox, useStats } from '../src/vue';
import { browseBody, clientWith, configBody, fakeFetch, tick } from './helpers';

let app: App | null = null;
const host = () => { const node = document.createElement('div'); document.body.appendChild(node); return node; };
afterEach(() => { app?.unmount(); app = null; document.body.innerHTML = ''; });

const Results = defineComponent({
  setup() {
    const box = useSearchBox();
    const hits = useHits();
    const brand = useRefinementList({ attribute: 'brand' });
    const stats = useStats();
    return () => h('div', [
      h('input', { value: box.value.query, onInput: (e: any) => box.value.refine(e.target.value) }),
      h('p', { id: 'stats' }, stats.value.text),
      h('ul', { id: 'brands' }, brand.value.items.map((item) => h('li', { key: item.value, class: item.isRefined ? 'on' : '', onClick: () => brand.value.refine(item.value) }, `${item.label} ${item.count}`))),
      h('ul', { id: 'hits' }, hits.value.hits.map((hit) => h('li', { key: hit.id }, hit.title))),
    ]);
  },
});

describe('Vue bindings', () => {
  it('feeds composables from one search and reacts to changes', async () => {
    const { client, calls } = clientWith({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody() });
    const node = host();
    app = createApp({ render: () => h(AgenticSearchProvider, { searchClient: client, insights: false }, () => h(Results)) });
    app.mount(node);
    await tick(20); await nextTick();
    expect([...node.querySelectorAll('#hits li')].map((n) => n.textContent)).toEqual(['Volvo XC40', 'Volvo XC60']);
    expect(node.querySelector('#stats')!.textContent).toBe('2 tulosta');
    expect(calls.filter((c) => c.url.includes('/browse/'))).toHaveLength(1);
    (node.querySelector('#brands li') as HTMLElement).click();
    await tick(20); await nextTick();
    expect(node.querySelector('#brands li')!.className).toBe('on');
    expect(decodeURIComponent(calls.at(-1)!.url)).toContain('f.brand=Volvo');
  });

  it('renders on a server with something to show and no request', async () => {
    const { client, calls } = clientWith({});
    const html = await renderToString(createSSRApp({ render: () => h(AgenticSearchProvider, { searchClient: client, initialState: { q: 'volvo' } }, () => h(Results)) }));
    expect(html).toContain('value="volvo"');
    expect(calls).toHaveLength(0);
  });

  it('the ready-made component renders the shell first, then mounts and cleans up', async () => {
    const shell = await renderToString(createSSRApp({ render: () => h(AgenticSearch, { toolId: 'toolV', layout: 'page', placeholder: 'Etsi <b>' }) }));
    expect(shell).toContain('sfas-shell--page');
    expect(shell).toContain('Etsi &lt;b&gt;');

    const { fetch } = fakeFetch({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody() });
    globalThis.fetch = fetch;
    const node = host();
    app = createApp({ render: () => h(AgenticSearch, { toolId: 'toolV', layout: 'page', apiBase: 'https://api.test', routing: false }) });
    app.mount(node);
    for (let i = 0; i < 100 && !node.querySelector('[data-sfas-mounted]'); i++) await tick(20);
    await tick(40);
    expect(node.querySelectorAll('.sfas-page .sfas-hit').length).toBe(2);
    app.unmount(); app = null;
    expect(document.querySelector('[data-sfas-mounted]')).toBeNull();
  });
});
