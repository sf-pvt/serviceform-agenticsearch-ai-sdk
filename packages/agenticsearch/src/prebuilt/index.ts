import { serviceformSearch } from '../client';
import { queryToState } from '../client/query';
import type { SearchClient, SearchConfig, SearchState } from '../client/types';
import { AgenticSearch } from '../core/agenticsearch';
import { button, el, icon } from '../lib/dom';
import { stringsFor } from '../lib/i18n';
import css from '../css/agenticsearch.built.css';
import { boxLayout, pageLayout, type Layout } from './layouts';

export type LayoutName = 'box' | 'navmini' | 'modal' | 'page' | 'section';

export interface MountOptions {
  toolId: string;
  /** Where to draw. An element, or a selector for one. */
  target: HTMLElement | string;
  /** `box` (header field with a dropdown), `modal` (a trigger that opens the search over the page), `page` (the full results page) or `section` (a field with example questions). Defaults to the tool's own setting. */
  layout?: LayoutName;
  apiBase?: string;
  /** Settings to start from, so nothing is fetched before the first render. */
  config?: Partial<SearchConfig>;
  language?: string;
  accent?: string;
  ai?: boolean;
  /** The site's results page, for `box`, `modal` and `section`. */
  searchPageHref?: string;
  /** The query parameter the words travel in. `q` by default, `s` on WordPress. */
  searchPageParam?: string;
  perPage?: number;
  facets?: string[];
  placeholder?: string;
  /** Keep the search in the address (page layout). On by default. */
  routing?: boolean;
  /**
   * The search to open with, for a landing page: "used Volvos under 30 000"
   * as a page of its own. An object, or the same text a results page puts in
   * its address (`f.brand=Volvo&price_max=30000&sort=price_asc`). A search in
   * the page's own address still wins over it.
   */
  initialState?: Partial<SearchState> | string;
  /** Open results in a new tab. The tool's own setting (on) by default. */
  openInNewTab?: boolean;
  /** A heart on every card and "Favourites" among the filters. The tool's own setting (off) by default. */
  favourites?: boolean;
  /** "Add to cart" on every card, once the page has called `setCart`. The tool's own setting (off) by default. */
  cart?: boolean;
  /** Badges on cards from the product's tags: "Tag = Label" or "Tag = flag:fi", one per line or separated by ";". */
  badges?: string;
  /** The tool has a product index per language: search the one in `language`. Off by default. */
  languageIndexes?: boolean;
  testMode?: boolean;
}

export interface Mounted {
  element: HTMLElement;
  instance: AgenticSearch;
  layout: LayoutName;
  /** Modal layout: opens the search, optionally with words already in it. */
  open(query?: string): void;
  close(): void;
  destroy(): void;
}

const clients = new Map<string, SearchClient>();
const mounted = new WeakMap<HTMLElement, Mounted>();
const LAYOUTS: LayoutName[] = ['box', 'navmini', 'modal', 'page', 'section'];
let shortcutOwner: HTMLElement | null = null;
// How long a shell may wait for the settings before the search draws with defaults.
const SETTINGS_WAIT_MS = 1500;

function clientFor(options: MountOptions): SearchClient {
  const languageIndex = options.languageIndexes && options.language ? options.language : '';
  const key = `${options.apiBase || ''}|${options.toolId}|${options.testMode ? 't' : ''}|${languageIndex}`;
  let client = clients.get(key);
  if (!client) {
    client = serviceformSearch(options.toolId, { apiBase: options.apiBase, config: options.config, testMode: options.testMode, ...(languageIndex ? { languageIndex } : {}) });
    clients.set(key, client);
  }
  return client;
}

/** The stylesheet, unless the page already loaded it as a file (which is what the plugins do, so nothing flashes). */
export function ensureStyles(doc: Document = document): void {
  if (doc.querySelector('style[data-sfas]')) return;
  try {
    if (getComputedStyle(doc.documentElement).getPropertyValue('--sfas-css').trim()) return;
  } catch { /* no computed styles: inject */ }
  const style = doc.createElement('style');
  style.setAttribute('data-sfas', '');
  style.textContent = css;
  doc.head.appendChild(style);
}

function theme(element: HTMLElement, instance: AgenticSearch, options: MountOptions): () => void {
  const apply = () => {
    const config = instance.config;
    element.style.setProperty('--sfas-accent', options.accent || config.accent);
    element.style.setProperty('--sfas-radius', `${config.radius}px`);
    element.lang = options.language || config.language;
  };
  apply();
  return instance.on('render', apply);
}

function newInstance(options: MountOptions, extra: { routing?: boolean; results?: boolean }): AgenticSearch {
  const initial = typeof options.initialState === 'string' ? queryToState(options.initialState, options.searchPageParam || 'q') : options.initialState;
  return new AgenticSearch({
    searchClient: clientFor(options),
    initialState: initial,
    routing: extra.routing ? { queryParam: options.searchPageParam || 'q' } : false,
    results: extra.results,
    searchOnStart: extra.results !== false,
    perPage: options.perPage,
    facets: options.facets,
    language: options.language,
    ai: options.ai,
    openInNewTab: options.openInNewTab,
    favourites: options.favourites,
    cart: options.cart,
    badges: options.badges,
  });
}

function start(element: HTMLElement, instance: AgenticSearch, layout: Layout, options: MountOptions): () => void {
  const offTheme = theme(element, instance, options);
  instance.addWidgets(layout.widgets);
  instance.start();
  return () => { offTheme(); instance.dispose(); layout.teardown(); };
}

function mountModal(element: HTMLElement, options: MountOptions): Mounted {
  const client = clientFor(options);
  const config = client.peekConfig();
  const s = stringsFor(options.language || config?.language, config?.labels as object);
  const trigger = button('sfas-trigger');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.appendChild(icon('search'));
  trigger.appendChild(el('span', 'sfas-trigger-text', options.placeholder || config?.placeholders[0] || s.placeholder));
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  trigger.appendChild(el('kbd', 'sfas-trigger-key', mac ? '⌘K' : 'Ctrl K'));
  trigger.setAttribute('aria-label', s.search);
  element.appendChild(trigger);
  if (options.accent || config?.accent) element.style.setProperty('--sfas-accent', options.accent || config!.accent);

  let overlay: HTMLElement | null = null;
  let stop = () => {};
  // Made on the first open: a page that never opens its search never pays for it.
  const instance = newInstance(options, { routing: false });
  const close = () => {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.documentElement.classList.remove('sfas-lock');
    trigger.focus();
  };
  const open = (query?: string) => {
    if (!overlay) {
      overlay = el('div', 'sfas sfas-modal');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', s.search);
      const sheet = el('div', 'sfas-modal-sheet');
      const shut = button('sfas-modal-close', undefined, s.close);
      shut.appendChild(icon('close'));
      shut.addEventListener('click', close);
      sheet.appendChild(shut);
      overlay.appendChild(sheet);
      overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) close(); });
      document.body.appendChild(overlay);
      stop = start(overlay, instance, pageLayout(sheet, instance, { placeholder: options.placeholder, autofocus: true }), options);
    }
    overlay.hidden = false;
    document.documentElement.classList.add('sfas-lock');
    if (query) instance.submit(query);
    overlay.querySelector<HTMLInputElement>('.sfas-input')?.focus();
  };
  // A header often carries the trigger twice (desktop and mobile). The
  // shortcut opens one search, not one for each.
  if (!shortcutOwner) shortcutOwner = element;
  const onKey = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      if (shortcutOwner !== element) return;
      event.preventDefault();
      open();
    } else if (event.key === 'Escape') close();
  };
  trigger.addEventListener('click', () => open());
  document.addEventListener('keydown', onKey);
  return {
    element, instance, layout: 'modal', open, close,
    destroy() {
      close();
      if (shortcutOwner === element) shortcutOwner = null;
      document.removeEventListener('keydown', onKey);
      stop();
      overlay?.remove();
      trigger.remove();
    },
  };
}

// How wide the panel under a navbar icon is, and how far it keeps from the window's edges.
const MINI_WIDTH = 680;
const MINI_EDGE = 12;

/**
 * Nav mini: only a search icon where a navbar has no room for a field. A click on it opens a panel
 * under it, the field at its top and focused, the instant results under the field in the same panel.
 * A second click, a click elsewhere or Esc puts it away, and Esc hands the focus back to the icon.
 */
function mountMini(element: HTMLElement, options: MountOptions): Mounted {
  const client = clientFor(options);
  const config = client.peekConfig();
  const s = stringsFor(options.language || config?.language, config?.labels as object);
  const trigger = button('sfas-mini-trigger');
  trigger.setAttribute('aria-label', s.search);
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.appendChild(icon('search'));
  element.appendChild(trigger);

  let pop: HTMLElement | null = null;
  let stop = () => {};
  // Made on the first open: a page that never opens its search never pays for it.
  const instance = newInstance(options, { routing: false, results: false });
  const isOpen = () => !!pop && !pop.hidden;
  // Under the icon, from its left edge; from its right edge where that would run off the window.
  const place = () => {
    if (!pop) return;
    const at = trigger.getBoundingClientRect();
    const width = Math.min(MINI_WIDTH, window.innerWidth - MINI_EDGE * 2);
    let left = at.left;
    if (left + width > window.innerWidth - MINI_EDGE) left = at.right - width;
    pop.style.width = `${Math.round(width)}px`;
    pop.style.left = `${Math.round(Math.max(MINI_EDGE, left))}px`;
    pop.style.top = `${Math.round(at.bottom + 8)}px`;
  };
  const close = (focus = false) => {
    if (!isOpen()) return;
    pop!.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus) trigger.focus();
  };
  const open = (query?: string) => {
    if (!pop) {
      pop = el('div', 'sfas sfas-mini-pop');
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-label', s.search);
      document.body.appendChild(pop);
      const layout = boxLayout(pop, instance, { placeholder: options.placeholder, searchPageHref: options.searchPageHref, searchPageParam: options.searchPageParam, autofocus: true });
      stop = start(pop, instance, layout, options);
    }
    pop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    place();
    const input = pop.querySelector<HTMLInputElement>('.sfas-input');
    if (input && query) { input.value = query; input.dispatchEvent(new Event('input', { bubbles: true })); }
    input?.focus();
  };
  const onTrigger = () => (isOpen() ? close() : open());
  const onPointer = (event: Event) => {
    const target = event.target as Node | null;
    if (isOpen() && target && !pop!.contains(target) && !element.contains(target)) close();
  };
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && isOpen()) close(true); };
  const onMove = () => { if (isOpen()) place(); };
  trigger.addEventListener('click', onTrigger);
  document.addEventListener('pointerdown', onPointer, true);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onMove);
  window.addEventListener('scroll', onMove, true);
  return {
    element, instance, layout: 'navmini', open, close: () => close(),
    destroy() {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      stop();
      pop?.remove();
      trigger.remove();
    },
  };
}

/**
 * Draws a ready-made search in an element.
 *
 * ```js
 * ServiceformAgenticSearch.mount({ toolId: 'TOOL_ID', target: '#search', layout: 'page' });
 * ```
 */
export function mount(options: MountOptions): Mounted {
  const element = typeof options.target === 'string' ? document.querySelector<HTMLElement>(options.target) : options.target;
  if (!element) throw new Error(`ServiceformAgenticSearch: target not found (${String(options.target)})`);
  const existing = mounted.get(element);
  if (existing) return existing;
  ensureStyles(element.ownerDocument);

  const client = clientFor(options);
  // Drawn at once when the settings are at hand (inline, remembered, or
  // given in code). Otherwise the server-rendered shell stays up while they
  // are fetched, for at most a moment, rather than a box in the wrong
  // language and colour that changes a second later.
  if (!client.peekConfig() && element.querySelector('.sfas-shell-field') && !options.config) {
    const placeholder: Mounted = { element, instance: null as unknown as AgenticSearch, layout: options.layout || 'box', open() {}, close() {}, destroy() { mounted.delete(element); } };
    mounted.set(element, placeholder);
    let real: Mounted | null = null;
    const go = () => {
      if (mounted.get(element) !== placeholder) return;
      mounted.delete(element);
      real = mount(options);
      Object.assign(placeholder, real, { destroy: () => real?.destroy() });
    };
    Promise.race([client.getConfig().catch(() => {}), new Promise((r) => setTimeout(r, SETTINGS_WAIT_MS))]).then(go);
    return placeholder;
  }
  const layoutName: LayoutName = options.layout && LAYOUTS.includes(options.layout) ? options.layout : (client.peekConfig()?.layout as LayoutName) || 'box';
  // Whatever the server rendered to hold the space (the shell) gives way now.
  element.textContent = '';
  element.classList.add('sfas', `sfas--${layoutName}`);
  element.classList.remove('sfas-shell', 'sfas-shell--box', 'sfas-shell--modal', 'sfas-shell--page', 'sfas-shell--section');
  element.setAttribute('data-sfas-mounted', layoutName);

  let result: Mounted;
  if (layoutName === 'modal') result = mountModal(element, options);
  else if (layoutName === 'navmini') result = mountMini(element, options);
  else {
    const isPage = layoutName === 'page';
    const instance = newInstance(options, { routing: isPage && options.routing !== false, results: isPage });
    const layout = isPage
      ? pageLayout(element, instance, { placeholder: options.placeholder })
      : boxLayout(element, instance, { placeholder: options.placeholder, searchPageHref: options.searchPageHref, searchPageParam: options.searchPageParam, questions: layoutName === 'section' });
    const stop = start(element, instance, layout, options);
    result = { element, instance, layout: layoutName, open() {}, close() {}, destroy: stop };
  }
  const destroy = result.destroy;
  result.destroy = () => { destroy(); mounted.delete(element); element.removeAttribute('data-sfas-mounted'); };
  mounted.set(element, result);
  // The tool does not exist (deleted, or a mistyped id): a search that can
  // never answer is worse than none. It is taken down, and the page is told,
  // so whatever it replaced (a theme's own search) can be put back.
  client.getConfig().catch((error) => {
    if (!error || error.status !== 404 || mounted.get(element) !== result) return;
    result.destroy();
    element.hidden = true;
    element.setAttribute('data-sfas-unavailable', '');
    element.dispatchEvent(new CustomEvent('sfas:unavailable', { bubbles: true, detail: { toolId: options.toolId } }));
  });
  return result;
}

/** Options read from an element's `data-` attributes (see the contract in docs/contract.md). */
export function optionsFromElement(element: HTMLElement): MountOptions | null {
  const d = element.dataset;
  if (!d.toolId) return null;
  const options: MountOptions = { toolId: d.toolId, target: element };
  if (d.layout && LAYOUTS.includes(d.layout as LayoutName)) options.layout = d.layout as LayoutName;
  if (d.apiBase) options.apiBase = d.apiBase;
  if (d.language) options.language = d.language;
  if (d.accent) options.accent = d.accent;
  if (d.ai) options.ai = d.ai !== 'false';
  if (d.searchPage) options.searchPageHref = d.searchPage;
  if (d.searchParam) options.searchPageParam = d.searchParam;
  if (d.perPage && Number(d.perPage)) options.perPage = Number(d.perPage);
  if (d.facets) options.facets = d.facets.split(',').map((f) => f.trim()).filter(Boolean);
  if (d.placeholder) options.placeholder = d.placeholder;
  if (d.routing) options.routing = d.routing !== 'false';
  if (d.state) options.initialState = d.state;
  if (d.newTab) options.openInNewTab = d.newTab !== 'false';
  if (d.favourites) options.favourites = d.favourites !== 'false';
  if (d.cart) options.cart = d.cart !== 'false';
  if (d.badges) options.badges = d.badges;
  if (d.languageIndexes) options.languageIndexes = d.languageIndexes !== 'false';
  if (d.test === 'true') options.testMode = true;
  return options;
}

/** Mounts every `[data-sf-agenticsearch]` element not mounted yet. Safe to call again after adding markup. */
export function mountAll(root: ParentNode = document): Mounted[] {
  const results: Mounted[] = [];
  root.querySelectorAll<HTMLElement>('[data-sf-agenticsearch]').forEach((element) => {
    if (mounted.has(element) || element.hasAttribute('data-sfas-mounted')) return;
    const options = optionsFromElement(element);
    if (!options) return;
    try { results.push(mount(options)); } catch (error) { console.error('[ServiceformAgenticSearch]', error); }
  });
  return results;
}

/** The mounted search in an element, if there is one. */
export const get = (element: HTMLElement): Mounted | undefined => mounted.get(element);
