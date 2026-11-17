import { afterEach, describe, expect, it, vi } from 'vitest';
import { agenticsearch, favourites, favouritesFor, infiniteHits, mount, setCart, type CartAdapter } from '../src';
import { browseBody, clientWith, configBody, fakeFetch, product, tick } from './helpers';

// A storage of the test's own: what the runtime offers as localStorage differs between Node versions.
const kept = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: { getItem: (k: string) => (kept.has(k) ? kept.get(k)! : null), setItem: (k: string, v: string) => { kept.set(k, String(v)); }, removeItem: (k: string) => { kept.delete(k); }, clear: () => kept.clear() },
});
const forget = (toolId: string) => { const f = favouritesFor(toolId); for (const hit of f.all()) f.toggle(hit); };

const host = () => { const node = document.createElement('div'); document.body.appendChild(node); return node; };
afterEach(() => {
  setCart(null);
  forget('tool1');
  forget('tool9');
  kept.clear();
  document.body.innerHTML = '';
  document.head.querySelectorAll('style[data-sfas]').forEach((n) => n.remove());
  history.replaceState(null, '', window.location.pathname);
});

const routes = (over: Record<string, unknown> = {}) => ({ '/browse/': browseBody({ state: undefined }), '/omnibox/config/': configBody({ language: 'en', ...over }) });

describe('favourites', () => {
  it('draws no heart and no cart button unless they are turned on', async () => {
    const { client } = clientWith(routes());
    const node = host();
    agenticsearch({ searchClient: client, insights: false }).addWidgets([infiniteHits({ container: node })]).start();
    await tick(5);
    expect(node.querySelectorAll('.sfas-hit')).toHaveLength(2);
    expect(node.querySelector('.sfas-hit-fav')).toBeNull();
    expect(node.querySelector('.sfas-hit-add')).toBeNull();
  });

  it('saves a product with the heart and shows only the saved ones without asking the API', async () => {
    const { client, calls } = clientWith(routes());
    const list = host();
    const toggle = host();
    const search = agenticsearch({ searchClient: client, insights: false, favourites: true });
    search.addWidgets([infiniteHits({ container: list }), favourites({ container: toggle })]).start();
    await tick(5);
    const input = toggle.querySelector('input')!;
    expect(input.disabled).toBe(true);
    const hearts = list.querySelectorAll<HTMLButtonElement>('.sfas-hit-fav');
    expect(hearts).toHaveLength(2);
    expect(hearts[1].getAttribute('aria-pressed')).toBe('false');
    hearts[1].click();
    expect(hearts[1].getAttribute('aria-pressed')).toBe('true');
    expect(hearts[1].getAttribute('aria-label')).toBe('Remove from favourites');
    expect(search.favourites.count()).toBe(1);
    expect(input.disabled).toBe(false);
    expect(toggle.querySelector('.sfas-toggle-count')!.textContent).toBe('1');

    const browsed = calls.filter((c) => c.url.includes('/browse/')).length;
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    await tick(5);
    expect(calls.filter((c) => c.url.includes('/browse/')).length).toBe(browsed);
    const cards = list.querySelectorAll('.sfas-hit');
    expect(cards).toHaveLength(1);
    expect(cards[0].querySelector('.sfas-hit-title')!.textContent).toContain('XC60');
    expect(search.results!.chips).toEqual([{ key: 'favourites', label: 'Favourites' }]);

    // Taken off while only the saved ones are shown: it leaves the list.
    cards[0].querySelector<HTMLButtonElement>('.sfas-hit-fav')!.click();
    await tick(5);
    expect(list.querySelectorAll('.sfas-hit')).toHaveLength(0);

    // The chip's cross goes back to the catalogue.
    search.clearRefinement('favourites');
    await tick(5);
    expect(search.favouritesOnly).toBe(false);
    expect(list.querySelectorAll('.sfas-hit')).toHaveLength(2);
  });

  it('remembers what was saved between visits, per tool', async () => {
    const first = clientWith(routes());
    const a = agenticsearch({ searchClient: first.client, insights: false, favourites: true });
    const list = host();
    a.addWidgets([infiniteHits({ container: list })]).start();
    await tick(5);
    list.querySelector<HTMLButtonElement>('.sfas-hit-fav')!.click();
    const stored = JSON.parse(window.localStorage.getItem('sfas:favourites:tool1') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: '40', url: 'https://shop.test/p/40' });
    expect(stored[0].fields).toBeUndefined();
  });

  it('follows the tool setting and the data attribute', async () => {
    const node = host();
    const { fetch } = fakeFetch(routes({ favourites: true }));
    vi.stubGlobal('fetch', fetch);
    mount({ toolId: 'tool9', target: node, layout: 'page', apiBase: 'https://api.test' });
    await tick(20);
    expect(node.querySelectorAll('.sfas-hit-fav')).toHaveLength(2);
    expect((node.querySelector('.sfas-page-saved') as HTMLElement).hidden).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('add to cart', () => {
  const page = async (cart: CartAdapter, products = [product(40), product(60, { oos: true })]) => {
    setCart(cart);
    const { client } = clientWith({ '/browse/': browseBody({ state: undefined, products }), '/omnibox/config/': configBody({ language: 'en' }) });
    const node = host();
    const search = agenticsearch({ searchClient: client, insights: false, cart: true });
    search.addWidgets([infiniteHits({ container: node })]).start();
    await tick(5);
    return { node, search };
  };

  it('adds a product with one way to buy it at once, and not one that is out of stock', async () => {
    const add = vi.fn(async () => {});
    const { node } = await page({ add });
    const buttons = node.querySelectorAll<HTMLButtonElement>('.sfas-hit-add');
    expect(buttons).toHaveLength(1);
    buttons[0].click();
    await tick(5);
    expect(add).toHaveBeenCalledTimes(1);
    expect((add.mock.calls[0] as any)[0].id).toBe('40');
    expect((add.mock.calls[0] as any)[1]).toBeNull();
    expect(buttons[0].textContent).toBe('Added');
  });

  it('lets a size be chosen first when the product has several', async () => {
    const add = vi.fn(async () => {});
    const variants = [{ id: 'v1', title: '41', available: false }, { id: 'v2', title: '42', available: true }, { id: 'v3', title: '43', available: true }];
    const { node, search } = await page({ add, product: async () => ({ variants }) });
    const button = node.querySelector<HTMLButtonElement>('.sfas-hit-add')!;
    button.click();
    await tick(5);
    expect(add).not.toHaveBeenCalled();
    const select = node.querySelector<HTMLSelectElement>('.sfas-hit-variant')!;
    expect(select.options).toHaveLength(3);
    expect(select.options[0].disabled).toBe(true);
    expect(select.value).toBe('v2');
    // Drawing again with the same results leaves the choice where it is.
    search.render();
    expect(node.querySelector('.sfas-hit-variant')).toBe(select);
    select.value = 'v3';
    button.click();
    await tick(5);
    expect((add.mock.calls[0] as any)[1]).toMatchObject({ id: 'v3' });
  });

  it('says so when the shop refuses, and when everything is sold out', async () => {
    const refuse = await page({ add: async () => { throw new Error('Only 1 left'); } });
    const b = refuse.node.querySelector<HTMLButtonElement>('.sfas-hit-add')!;
    b.click();
    await tick(5);
    expect(b.textContent).toBe('Could not add. Try again.');
    expect(b.title).toBe('Only 1 left');
    document.body.innerHTML = '';
    const gone = await page({ add: async () => {}, product: async () => ({ variants: [{ id: 'v1', title: '41', available: false }] }) });
    const g = gone.node.querySelector<HTMLButtonElement>('.sfas-hit-add')!;
    g.click();
    await tick(5);
    expect(g.textContent).toBe('Sold out');
    expect(g.disabled).toBe(true);
  });

  it('draws the button on cards already there when the cart arrives later', async () => {
    const { client } = clientWith(routes());
    const node = host();
    agenticsearch({ searchClient: client, insights: false, cart: true }).addWidgets([infiniteHits({ container: node })]).start();
    await tick(5);
    expect(node.querySelector('.sfas-hit-add')).toBeNull();
    setCart({ add: async () => {} });
    expect(node.querySelectorAll('.sfas-hit-add')).toHaveLength(2);
  });
});
