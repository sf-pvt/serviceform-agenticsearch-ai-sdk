import { afterEach, describe, expect, it, vi } from 'vitest';
import { agenticsearch, autocomplete, favourites, favouritesFor, infiniteHits, mount, setCart, type CartAdapter } from '../src';
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

describe('favourites in a header box', () => {
  const shoe = { id: '7', title: 'AllRound Epic', price: '€499', monthly: '', url: 'https://shop.test/p/7', image: '', outOfStock: false };

  it('counts what is saved on a heart in the field and lists it when pressed', async () => {
    favouritesFor('tool1').toggle(shoe);
    const { client } = clientWith(routes());
    const node = host();
    agenticsearch({ searchClient: client, insights: false, favourites: true, results: false })
      .addWidgets([autocomplete({ container: node, searchPageHref: '/search' })]).start();
    await tick(5);
    const heart = node.querySelector<HTMLButtonElement>('.sfas-input-fav')!;
    expect(heart.hidden).toBe(false);
    expect(heart.textContent).toBe('1');
    const panel = node.querySelector<HTMLElement>('.sfas-panel')!;
    expect(panel.hidden).toBe(true);
    heart.click();
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector('.sfas-panel-title')!.textContent).toBe('Favourites (1)');
    expect(panel.querySelector('.sfas-hit-title')!.textContent).toBe('AllRound Epic');
    expect(panel.querySelector<HTMLAnchorElement>('.sfas-panel-all')!.getAttribute('href')).toBe('/search?favourites=1');
    // Taken off elsewhere on the page: the heart in the field goes with it.
    favouritesFor('tool1').toggle(shoe);
    expect(heart.hidden).toBe(true);
  });

  it('has no heart in the field while favourites are off', async () => {
    favouritesFor('tool1').toggle(shoe);
    const { client } = clientWith(routes());
    const node = host();
    agenticsearch({ searchClient: client, insights: false, results: false }).addWidgets([autocomplete({ container: node })]).start();
    await tick(5);
    expect(node.querySelector<HTMLButtonElement>('.sfas-input-fav')!.hidden).toBe(true);
  });

  it('opens a results page on the saved products from favourites=1 in its address', async () => {
    favouritesFor('tool1').toggle(shoe);
    history.replaceState(null, '', `${window.location.pathname}?favourites=1`);
    const { client, calls } = clientWith(routes());
    const list = host();
    const search = agenticsearch({ searchClient: client, insights: false, favourites: true, routing: true });
    search.addWidgets([infiniteHits({ container: list })]).start();
    await tick(5);
    expect(calls.filter((c) => c.url.includes('/browse/'))).toHaveLength(0);
    expect(list.querySelectorAll('.sfas-hit')).toHaveLength(1);
    // Back to the catalogue: the address says so too.
    search.clearRefinement('favourites');
    await tick(5);
    expect(window.location.search).toBe('');
    expect(list.querySelectorAll('.sfas-hit')).toHaveLength(2);
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

  it('asks for each option by the name the shop gives it when the product has several variants', async () => {
    const add = vi.fn(async () => {});
    const variants = [
      { id: 'v1', title: '41 / Black', available: false, options: ['41', 'Black'] },
      { id: 'v2', title: '42 / Black', available: true, options: ['42', 'Black'] },
      { id: 'v3', title: '42 / Brown', available: true, options: ['42', 'Brown'], price: '€519.00' },
    ];
    const options = [{ name: 'Size', values: ['41', '42'] }, { name: 'Colour', values: ['Black', 'Brown'] }];
    const { node, search } = await page({ add, product: async () => ({ variants, options }) });
    const button = node.querySelector<HTMLButtonElement>('.sfas-hit-add')!;
    button.click();
    await tick(5);
    expect(add).not.toHaveBeenCalled();
    expect([...node.querySelectorAll('.sfas-hit-option-name')].map((n) => n.textContent)).toEqual(['Size', 'Colour']);
    const [size, colour] = [...node.querySelectorAll<HTMLSelectElement>('.sfas-hit-variant')];
    // Opens on the first one that can be bought.
    expect([size.value, colour.value]).toEqual(['42', 'Black']);
    expect(size.options[0].textContent).toBe('41 · Sold out');
    // Drawing again with the same results leaves the choice where it is.
    search.render();
    expect(node.querySelector('.sfas-hit-variant')).toBe(size);
    // A pair that does not exist, or is sold out, cannot be added.
    size.value = '41';
    size.dispatchEvent(new Event('change'));
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Sold out');
    size.value = '42';
    size.dispatchEvent(new Event('change'));
    colour.value = 'Brown';
    colour.dispatchEvent(new Event('change'));
    expect(button.disabled).toBe(false);
    expect(node.querySelector('.sfas-hit-option-price')!.textContent).toBe('€519.00');
    button.click();
    await tick(5);
    expect((add.mock.calls[0] as any)[1]).toMatchObject({ id: 'v3' });
  });

  it('shows one named list when the shop gives variants without option names', async () => {
    const add = vi.fn(async () => {});
    const variants = [{ id: 'v1', title: '41', available: false }, { id: 'v2', title: '42', available: true }];
    const { node } = await page({ add, product: async () => ({ variants }) });
    const button = node.querySelector<HTMLButtonElement>('.sfas-hit-add')!;
    button.click();
    await tick(5);
    expect(node.querySelector('.sfas-hit-option-name')!.textContent).toBe('Choose an option');
    const select = node.querySelector<HTMLSelectElement>('.sfas-hit-variant')!;
    expect(select.value).toBe('v2');
    expect(select.options[0].textContent).toBe('41 · Sold out');
    button.click();
    await tick(5);
    expect((add.mock.calls[0] as any)[1]).toMatchObject({ id: 'v2' });
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
