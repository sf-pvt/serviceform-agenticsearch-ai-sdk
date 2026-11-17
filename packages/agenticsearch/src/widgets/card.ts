import type { Hit } from '../client/types';
import type { CartAdapter, CartVariant } from '../lib/cart';
import { button, el, escapeHtml, fill, icon, openWhere } from '../lib/dom';
import { favouriteId, type Favourites } from '../lib/favourites';
import type { Strings } from '../lib/i18n';

export type HitTemplate = (hit: Hit, helpers: { escape: typeof escapeHtml; position: number }) => string | Node;

/** What a card can do beside being a link: be saved, be added to the cart. */
export interface CardActions {
  strings: Strings;
  favourites?: Favourites | null;
  cart?: CartAdapter | null;
  /** Called after a product went into the cart. */
  onAdd?: (hit: Hit, position: number) => void;
}

export interface CardOptions { fallbackImage?: string; template?: HitTemplate; onClick?: (hit: Hit, position: number) => void; compact?: boolean; /** The link opens in a new tab. */ newTab?: boolean; actions?: CardActions }

const ADDED_MS = 2000;
const ERROR_MS = 3500;

/** The heart: saves the product in this browser, or takes it off. */
function favouriteButton(hit: Hit, favourites: Favourites, strings: Strings): HTMLButtonElement {
  const b = button('sfas-hit-fav');
  b.appendChild(icon('heart'));
  b.dataset.sfasFav = favouriteId(hit);
  const show = (on: boolean) => {
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? strings.favouriteRemove : strings.favouriteAdd);
    b.title = on ? strings.favouriteRemove : strings.favouriteAdd;
  };
  show(favourites.has(hit));
  b.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const on = favourites.toggle(hit);
    // Every heart of this product on the page, whichever search drew it.
    b.ownerDocument.querySelectorAll<HTMLElement>('.sfas-hit-fav').forEach((other) => {
      if (other.dataset.sfasFav !== b.dataset.sfasFav) return;
      other.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    show(on);
  });
  return b;
}

/**
 * "Add to cart". A product with one way to buy it is added at once; one that
 * comes in sizes or colours shows them first, and the same button then adds
 * the one chosen.
 */
function cartRow(hit: Hit, position: number, actions: CardActions): HTMLElement {
  const { strings } = actions;
  const cart = actions.cart!;
  const row = el('div', 'sfas-hit-buy');
  const add = button('sfas-hit-add');
  const label = el('span', '', strings.addToCart);
  add.append(icon('cart'), label);
  row.appendChild(add);
  let variants: CartVariant[] | null = null;
  let select: HTMLSelectElement | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const say = (text: string, state: '' | 'is-busy' | 'is-done' | 'is-error', title = '') => {
    label.textContent = text;
    add.classList.remove('is-busy', 'is-done', 'is-error');
    if (state) add.classList.add(state);
    add.title = title;
    add.setAttribute('aria-busy', state === 'is-busy' ? 'true' : 'false');
  };
  const rest = (after: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { add.disabled = false; say(strings.addToCart, ''); }, after);
  };
  const soldOut = () => { add.disabled = true; say(strings.soldOut, ''); };

  const put = async (variant: CartVariant | null) => {
    add.disabled = true;
    say(strings.addToCart, 'is-busy');
    try {
      await cart.add(hit, variant, 1);
      say(strings.added, 'is-done');
      actions.onAdd?.(hit, position);
      rest(ADDED_MS);
    } catch (error) {
      say(strings.cartError, 'is-error', error instanceof Error ? error.message : '');
      rest(ERROR_MS);
    }
  };

  const choose = (list: CartVariant[]) => {
    select = el('select', 'sfas-hit-variant');
    select.setAttribute('aria-label', strings.chooseOption);
    for (const v of list) {
      const option = el('option', '', [v.title, v.price, v.available ? '' : strings.soldOut].filter(Boolean).join(' · '));
      option.value = v.id;
      option.disabled = !v.available;
      select.appendChild(option);
    }
    const firstOpen = list.find((v) => v.available);
    if (firstOpen) select.value = firstOpen.id;
    row.insertBefore(select, add);
    select.focus();
  };

  add.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (add.disabled) return;
    if (select && variants) { put(variants.find((v) => v.id === select!.value) || null); return; }
    if (!cart.product) { put(null); return; }
    add.disabled = true;
    say(strings.addToCart, 'is-busy');
    try {
      variants = (await cart.product(hit))?.variants || [];
    } catch (error) {
      say(strings.cartError, 'is-error', error instanceof Error ? error.message : '');
      rest(ERROR_MS);
      return;
    }
    const open = variants.filter((v) => v.available);
    if (variants.length && !open.length) { soldOut(); return; }
    if (variants.length > 1) { choose(variants); add.disabled = false; say(strings.addToCart, ''); return; }
    put(variants[0] || null);
  });
  return row;
}

/** One result as a card (or a row in a dropdown): picture, title, details, price, the whole of it a link. */
export function renderCard(hit: Hit, position: number, options: CardOptions = {}): HTMLElement {
  const item = el('li', `sfas-hit${hit.outOfStock ? ' sfas-hit--out' : ''}${options.compact ? ' sfas-hit--row' : ''}`);
  const link = openWhere(el('a', 'sfas-hit-link'), !!options.newTab);
  if (hit.url) link.href = hit.url;
  if (options.onClick) link.addEventListener('click', () => options.onClick!(hit, position));
  // The heart and the cart button sit beside the link, not in it: a button inside a link is neither.
  const extras = () => {
    const actions = options.actions;
    if (!actions || options.compact) return;
    if (actions.favourites && favouriteId(hit)) item.appendChild(favouriteButton(hit, actions.favourites, actions.strings));
    if (actions.cart && !hit.outOfStock) { item.classList.add('sfas-hit--buyable'); item.appendChild(cartRow(hit, position, actions)); }
  };
  if (options.template) {
    fill(link, options.template(hit, { escape: escapeHtml, position }));
    item.appendChild(link);
    extras();
    return item;
  }
  const media = el('span', 'sfas-hit-media');
  const src = hit.image || options.fallbackImage || '';
  if (src) {
    const img = el('img', 'sfas-hit-image');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = '';
    img.src = src;
    // A picture that is gone gives way to the fallback, once.
    img.addEventListener('error', () => {
      if (options.fallbackImage && img.src !== options.fallbackImage && !img.dataset.fellBack) { img.dataset.fellBack = '1'; img.src = options.fallbackImage; }
      else img.remove();
    });
    media.appendChild(img);
  }
  link.appendChild(media);
  const body = el('span', 'sfas-hit-body');
  body.appendChild(el('span', 'sfas-hit-title', hit.year && !hit.title.includes(String(hit.year)) ? `${hit.title} ${hit.year}` : hit.title));
  if (hit.meta) body.appendChild(el('span', 'sfas-hit-meta', hit.meta));
  if (hit.location && !options.compact) body.appendChild(el('span', 'sfas-hit-location', hit.location));
  if (hit.price || hit.monthly) {
    const price = el('span', 'sfas-hit-price', hit.price);
    if (hit.monthly) price.appendChild(el('span', 'sfas-hit-monthly', hit.monthly));
    body.appendChild(price);
  }
  link.appendChild(body);
  item.appendChild(link);
  extras();
  return item;
}

/** Outlines of cards, shown while the first results are on their way so nothing jumps when they land. */
export function renderSkeleton(count: number): HTMLElement[] {
  return Array.from({ length: count }, () => {
    const item = el('li', 'sfas-hit sfas-hit--ghost');
    item.setAttribute('aria-hidden', 'true');
    item.appendChild(el('span', 'sfas-hit-media'));
    const body = el('span', 'sfas-hit-body');
    body.appendChild(el('span', 'sfas-ghost-line'));
    body.appendChild(el('span', 'sfas-ghost-line sfas-ghost-line--short'));
    item.appendChild(body);
    return item;
  });
}
