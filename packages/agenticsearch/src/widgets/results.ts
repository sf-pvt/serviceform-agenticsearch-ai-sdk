import { connectClearRefinements, connectCurrentRefinements, connectHits, connectInStock, connectInfiniteHits, connectNote, connectPagination, connectSortBy, connectStats } from '../connectors';
import type { Hit, SortId } from '../client/types';
import type { Widget } from '../core/types';
import { button, clear, clickEmptyTarget, el, emptyTarget, fill, icon, resolveContainer, type Container } from '../lib/dom';
import type { AgenticSearch } from '../core/agenticsearch';
import { renderCard, renderSkeleton, type CardActions, type HitTemplate } from './card';

/** What this search's cards can do and show, from its settings: nothing, unless favourites, a cart or badges are on. */
export function cardActions(instance: AgenticSearch): CardActions | undefined {
  const favourites = instance.favouritesEnabled() ? instance.favourites : null;
  const cart = instance.cart();
  const badges = instance.badgeRules();
  const reviews = instance.reviewsEnabled();
  if (!favourites && !cart && !badges.length && !reviews) return undefined;
  return { strings: instance.strings, favourites, cart, badges, reviews };
}

export interface HitsParams {
  container: Container;
  templates?: { item?: HitTemplate; empty?: (query: string) => string | Node };
  /** How many outlines to show before the first results arrive. 0 for none. */
  skeleton?: number;
}

function emptyBlock(instance: AgenticSearch, query: string, template?: (query: string) => string | Node): HTMLElement {
  const { strings, config } = instance.context();
  const empty = el('div', 'sfas-empty');
  if (template) { fill(empty, template(query)); return empty; }
  empty.appendChild(el('strong', 'sfas-empty-title', query ? strings.emptyFor.replace('{q}', `“${query}”`) : strings.emptyTitle));
  empty.appendChild(el('p', 'sfas-empty-hint', strings.emptyHint));
  // Ways on: the AI, for words the catalogue did not match; everything,
  // again; and the site's own way (its chat) when the tool asks for it,
  // while what that button clicks is on the page.
  const actions = el('div', 'sfas-empty-actions');
  if (query && instance.aiEnabled() && query !== instance.ai.question) {
    const ask = button('sfas-empty-ask is-main', strings.askAi);
    ask.addEventListener('click', () => instance.submit(query, { ask: true }));
    actions.appendChild(ask);
  }
  const all = button('sfas-empty-all', strings.showAll);
  all.addEventListener('click', () => { instance.resetConversation(); instance.clearRefinements({ query: true }); });
  actions.appendChild(all);
  const extra = config.emptyButton;
  if (extra && emptyTarget(extra.selector)) {
    const b = button('sfas-empty-button', extra.label || strings.chat);
    b.addEventListener('click', () => clickEmptyTarget(extra.selector));
    actions.appendChild(b);
  }
  empty.appendChild(actions);
  return empty;
}

function drawHits(list: HTMLElement, hits: Hit[], from: number, opts: { template?: HitTemplate; fallbackImage: string; newTab: boolean; onClick: (hit: Hit, position: number) => void; details?: boolean; sale?: boolean; shopBadge?: boolean; actions?: CardActions }) {
  hits.forEach((hit, i) => list.appendChild(renderCard(hit, from + i, { template: opts.template, fallbackImage: opts.fallbackImage, newTab: opts.newTab, onClick: opts.onClick, details: opts.details, sale: opts.sale, shopBadge: opts.shopBadge, actions: opts.actions })));
}

/** The results of the current page, as a grid of cards. */
export function hits(params: HitsParams): Widget {
  const root = resolveContainer(params.container, 'hits');
  const list = el('ul', 'sfas-hits');
  const emptyHost = el('div');
  return connectHits<HitsParams>(({ hits: rows, isFirstLoad, status, sendClick, instance }, first) => {
    if (first) { clear(root); root.appendChild(list); root.appendChild(emptyHost); }
    const ctx = instance.context();
    list.classList.toggle('is-loading', status === 'loading');
    clear(emptyHost);
    if (isFirstLoad) {
      if (!list.children.length) renderSkeleton(params.skeleton ?? 6).forEach((n) => list.appendChild(n));
      return;
    }
    if (status === 'loading') return;
    clear(list);
    drawHits(list, rows, 0, { template: params.templates?.item, fallbackImage: ctx.config.fallbackImage, newTab: instance.opensInNewTab(), onClick: sendClick, details: instance.detailsEnabled(), sale: instance.saleEnabled(), shopBadge: instance.shopBadgesEnabled(), actions: cardActions(instance) });
    if (!rows.length) emptyHost.appendChild(emptyBlock(instance, ctx.state.q, params.templates?.empty));
  }, () => clear(root))(params);
}

export interface InfiniteHitsParams extends HitsParams { showMoreLabel?: string }

/** Results that grow with a "show more" button instead of page numbers. */
export function infiniteHits(params: InfiniteHitsParams): Widget {
  const root = resolveContainer(params.container, 'infiniteHits');
  const list = el('ul', 'sfas-hits');
  const emptyHost = el('div');
  const more = button('sfas-more');
  let drawn = 0;
  let drawnFirst: Hit | undefined;
  // What the cards were drawn with: a heart or a cart button that arrives later means drawing them again.
  let drawnWith = '';
  return connectInfiniteHits<InfiniteHitsParams>(({ hits: rows, isFirstLoad, isLastPage, status, showMore, sendClick, instance }, first) => {
    const ctx = instance.context();
    if (first) {
      clear(root); root.appendChild(list); root.appendChild(emptyHost); root.appendChild(more);
      more.addEventListener('click', () => { more.disabled = true; showMore(); });
    }
    more.textContent = params.showMoreLabel || ctx.strings.loadMore;
    list.classList.toggle('is-loading', status === 'loading' && ctx.state.page === 1);
    if (isFirstLoad) {
      more.hidden = true;
      if (!list.children.length) renderSkeleton(params.skeleton ?? 6).forEach((n) => list.appendChild(n));
      return;
    }
    if (status === 'loading') return;
    clear(emptyHost);
    // More of the same search is added under what is there; anything else starts the list again.
    const actions = cardActions(instance);
    const withNow = `${instance.redraw}|${actions?.favourites ? 'f' : ''}|${actions?.cart ? 'c' : ''}`;
    const appending = drawn > 0 && rows.length > drawn && rows[0] === drawnFirst && withNow === drawnWith;
    // The same cards as are there, drawn the same way: left alone, so a size being chosen stays chosen.
    if (drawn > 0 && rows.length === drawn && rows[0] === drawnFirst && withNow === drawnWith && list.children.length === drawn) { more.hidden = isLastPage || !rows.length; more.disabled = false; return; }
    if (!appending) { clear(list); drawn = 0; }
    drawnWith = withNow;
    drawHits(list, rows.slice(drawn), drawn, { template: params.templates?.item, fallbackImage: ctx.config.fallbackImage, newTab: instance.opensInNewTab(), onClick: sendClick, details: instance.detailsEnabled(), sale: instance.saleEnabled(), shopBadge: instance.shopBadgesEnabled(), actions });
    drawn = rows.length;
    drawnFirst = rows[0];
    more.hidden = isLastPage || !rows.length;
    more.disabled = false;
    if (!rows.length) emptyHost.appendChild(emptyBlock(instance, ctx.state.q, params.templates?.empty));
  }, () => clear(root))(params);
}

/** "128 results". */
export function stats(params: { container: Container }): Widget {
  const root = resolveContainer(params.container, 'stats');
  return connectStats<typeof params>(({ text }) => {
    root.classList.add('sfas-stats');
    root.setAttribute('aria-live', 'polite');
    root.textContent = text;
  }, () => clear(root))(params);
}

export interface SortByParams { container: Container; items?: Array<{ value: SortId; label?: string }> }
/** The order of the results, as a select. */
export function sortBy(params: SortByParams): Widget {
  const root = resolveContainer(params.container, 'sortBy');
  const select = el('select', 'sfas-sort');
  return connectSortBy<SortByParams>(({ options, currentRefinement, refine, instance }, first) => {
    if (first) {
      clear(root); root.appendChild(select);
      select.addEventListener('change', () => refine(select.value as SortId));
    }
    select.setAttribute('aria-label', instance.strings.sortBy);
    const key = options.map((o) => `${o.value}:${o.label}`).join('|');
    if (select.dataset.key !== key) {
      clear(select);
      for (const o of options) { const opt = el('option', '', o.label); opt.value = o.value; select.appendChild(opt); }
      select.dataset.key = key;
    }
    select.value = currentRefinement;
  }, () => clear(root))(params);
}

export interface CurrentRefinementsParams { container: Container; excludeSort?: boolean; /** Show "clear all" after the chips when there are at least two. */ clearAll?: boolean }
/** What is applied, as removable chips. */
export function currentRefinements(params: CurrentRefinementsParams): Widget {
  const root = resolveContainer(params.container, 'currentRefinements');
  return connectCurrentRefinements<CurrentRefinementsParams>(({ items, instance }) => {
    root.classList.add('sfas-chips');
    clear(root);
    for (const item of items) {
      const chip = button('sfas-chip', undefined, `${item.label} ×`);
      chip.appendChild(el('span', '', item.label));
      chip.appendChild(el('i', '', '×'));
      chip.addEventListener('click', () => item.refine());
      root.appendChild(chip);
    }
    if (params.clearAll !== false && items.length > 1) {
      const all = button('sfas-clear', instance.strings.clear);
      all.addEventListener('click', () => instance.clearRefinements());
      root.appendChild(all);
    }
  }, () => clear(root))(params);
}

/** A "clear filters" button, there while something is filtered. */
export function clearRefinements(params: { container: Container; includeQuery?: boolean; label?: string }): Widget {
  const root = resolveContainer(params.container, 'clearRefinements');
  const b = button('sfas-clear');
  return connectClearRefinements<typeof params>(({ canRefine, refine, instance }, first) => {
    if (first) { clear(root); root.appendChild(b); b.addEventListener('click', () => refine()); }
    b.textContent = params.label || instance.strings.clearFilters;
    b.hidden = !canRefine;
  }, () => clear(root))(params);
}

/** Page numbers, for sites that prefer them to "show more". */
export function pagination(params: { container: Container; padding?: number }): Widget {
  const root = resolveContainer(params.container, 'pagination');
  return connectPagination<typeof params>(({ pages, currentPage, isFirstPage, isLastPage, refine, canRefine, instance }) => {
    root.classList.add('sfas-pagination');
    clear(root);
    if (!canRefine) return;
    const add = (label: string, page: number, opts: { disabled?: boolean; current?: boolean; aria?: string } = {}) => {
      const b = button(`sfas-page-number${opts.current ? ' is-current' : ''}`, label, opts.aria);
      b.disabled = !!opts.disabled;
      if (opts.current) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', () => { refine(page); root.closest('.sfas')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
      root.appendChild(b);
    };
    add('‹', currentPage - 1, { disabled: isFirstPage, aria: instance.strings.previous });
    for (const p of pages) add(String(p), p, { current: p === currentPage });
    add('›', currentPage + 1, { disabled: isLastPage, aria: instance.strings.next });
  }, () => clear(root))(params);
}

/** "In stock only". */
export function inStock(params: { container: Container; label?: string }): Widget {
  const root = resolveContainer(params.container, 'inStock');
  const label = el('label', 'sfas-toggle');
  const input = el('input');
  input.type = 'checkbox';
  const text = el('span');
  label.appendChild(input);
  label.appendChild(text);
  return connectInStock<typeof params>(({ isRefined, refine, label: words }, first) => {
    if (first) { clear(root); root.appendChild(label); input.addEventListener('change', () => refine()); }
    input.checked = isRefined;
    text.textContent = params.label || words;
  }, () => clear(root))(params);
}

/**
 * "Favourites (3)": shows only what the visitor saved with the heart. There
 * while favourites are on for this search; nothing to tick until something is saved.
 */
export function favourites(params: { container: Container; label?: string }): Widget {
  const root = resolveContainer(params.container, 'favourites');
  const label = el('label', 'sfas-toggle sfas-toggle--fav');
  const input = el('input');
  input.type = 'checkbox';
  const text = el('span');
  const count = el('b', 'sfas-toggle-count');
  label.append(input, icon('heart'), text, count);
  let instance: AgenticSearch | null = null;
  let off = () => {};
  const draw = () => {
    if (!instance) return;
    const on = instance.favouritesEnabled();
    root.hidden = !on;
    if (!on) return;
    const kept = instance.favourites.count();
    input.checked = instance.favouritesOnly;
    input.disabled = !kept && !instance.favouritesOnly;
    label.classList.toggle('is-empty', input.disabled);
    text.textContent = params.label || instance.strings.favourites;
    count.textContent = kept ? String(kept) : '';
  };
  return {
    $$type: 'sfas.favourites',
    init(context) {
      instance = context.instance;
      clear(root);
      root.appendChild(label);
      input.addEventListener('change', () => instance?.setFavouritesOnly(input.checked));
      off = instance.favourites.subscribe(draw);
      draw();
    },
    render(context) { instance = context.instance; draw(); },
    dispose() { off(); off = () => {}; instance = null; clear(root); },
  };
}

/** What the search says when it loosened something to find anything. */
export function note(params: { container: Container }): Widget {
  const root = resolveContainer(params.container, 'note');
  return connectNote<typeof params>(({ note: words }) => {
    root.classList.add('sfas-note');
    root.textContent = words;
    root.hidden = !words;
  }, () => { root.textContent = ''; })(params);
}
