import { afterEach, describe, expect, it } from 'vitest';
import { createElement, StrictMode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { AgenticSearch, AgenticSearchProvider, useAiAnswer, useHits, useRefinementList, useSearchBox, useStats } from '../src/react';
import { browseBody, clientWith, configBody, fakeFetch, tick } from './helpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
const host = () => { const node = document.createElement('div'); document.body.appendChild(node); return node; };
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ''; });

function Results() {
  const box = useSearchBox();
  const { hits, sendClick } = useHits();
  const brand = useRefinementList({ attribute: 'brand' });
  const stats = useStats();
  const ai = useAiAnswer();
  return createElement('div', null,
    createElement('input', { value: box.query, onChange: (e: any) => box.refine(e.target.value), 'data-testid': 'q' }),
    createElement('p', { id: 'stats' }, stats.text),
    createElement('p', { id: 'answer' }, ai.answer),
    createElement('ul', { id: 'brands' }, brand.items.map((item) => createElement('li', { key: item.value, onClick: () => brand.refine(item.value), className: item.isRefined ? 'on' : '' }, `${item.label} ${item.count}`))),
    createElement('ul', { id: 'hits' }, hits.map((hit, i) => createElement('li', { key: hit.id, onClick: () => sendClick(hit, i) }, hit.title))),
  );
}

describe('React bindings', () => {
  it('feeds hooks from one search, in StrictMode too, and searches once', async () => {
    const { client, calls } = clientWith({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody() });
    const node = host();
    await act(async () => {
      root = createRoot(node);
      root.render(createElement(StrictMode, null, createElement(AgenticSearchProvider, { searchClient: client, insights: false, children: createElement(Results) })));
      await tick(20);
    });
    expect([...node.querySelectorAll('#hits li')].map((n) => n.textContent)).toEqual(['Volvo XC40', 'Volvo XC60']);
    expect(node.querySelector('#stats')!.textContent).toBe('2 tulosta');
    expect([...node.querySelectorAll('#brands li')].map((n) => n.textContent)).toEqual(['Volvo 2', 'Audi 1']);
    // StrictMode mounts, unmounts and mounts again: the search survives it without a pile of requests.
    expect(calls.filter((c) => c.url.includes('/browse/')).length).toBeLessThanOrEqual(2);

    await act(async () => { (node.querySelector('#brands li') as HTMLElement).click(); await tick(20); });
    expect(node.querySelector('#brands li')!.className).toBe('on');
    expect(decodeURIComponent(calls.at(-1)!.url)).toContain('f.brand=Volvo');
  });

  it('renders on a server with something to show and no request', () => {
    const { client, calls } = clientWith({});
    const html = renderToString(createElement(AgenticSearchProvider, { searchClient: client, initialState: { q: 'volvo' }, children: createElement(Results) }));
    expect(html).toContain('value="volvo"');
    expect(calls).toHaveLength(0);
  });

  it('says so when a hook is used outside a provider', () => {
    expect(() => renderToString(createElement(Results))).toThrow(/AgenticSearchProvider/);
  });

  it('the ready-made component renders the shell first, then mounts and cleans up', async () => {
    const shell = renderToString(createElement(AgenticSearch, { toolId: 'toolR', layout: 'page', placeholder: 'Etsi <b>' }));
    expect(shell).toContain('sfas-shell--page');
    expect(shell).toContain('sfas-shell-grid');
    expect(shell).toContain('Etsi &lt;b&gt;');

    const { fetch } = fakeFetch({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody() });
    globalThis.fetch = fetch;
    const node = host();
    let handle: any = null;
    await act(async () => {
      root = createRoot(node);
      root.render(createElement(AgenticSearch, { toolId: 'toolR', layout: 'page', apiBase: 'https://api.test', routing: false, onMount: (m) => { handle = m; } }));
    });
    // The search itself is loaded on demand, in the browser only.
    for (let i = 0; i < 100 && !handle; i++) await tick(20);
    await tick(40);
    expect(handle.layout).toBe('page');
    expect(node.querySelectorAll('.sfas-page .sfas-hit').length).toBe(2);
    expect(node.querySelector('.sfas-shell-field')).toBeNull();
    act(() => root!.unmount());
    root = null;
    expect(document.querySelector('[data-sfas-mounted]')).toBeNull();
  });
});
