import type { Hit } from '../client/types';
import type { CartAdapter, CartProduct, CartVariant } from '../lib/cart';
import { button, el, escapeHtml, fill, icon, openWhere } from '../lib/dom';
import { badgesFor, type BadgeRule } from '../lib/badges';
import { favouriteId, type Favourites } from '../lib/favourites';
import type { Strings } from '../lib/i18n';

export type HitTemplate = (hit: Hit, helpers: { escape: typeof escapeHtml; position: number }) => string | Node;

/** What a card can do beside being a link: be saved, be added to the cart. */
export interface CardActions {
  strings: Strings;
  favourites?: Favourites | null;
  /** Which tag gives which badge on the picture. */
  badges?: BadgeRule[];
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
  // Once a product with several variants was opened: which one is chosen now.
  let chosen: (() => CartVariant | null) | null = null;
  let settle = () => { add.disabled = false; say(strings.addToCart, ''); };
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
    timer = setTimeout(() => settle(), after);
  };

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

  const select = (name: string) => {
    const field = el('label', 'sfas-hit-option');
    field.appendChild(el('span', 'sfas-hit-option-name', name));
    const input = el('select', 'sfas-hit-variant');
    field.appendChild(input);
    return { field, input };
  };

  /**
   * The choice, drawn over the button. Where the shop names what its
   * variants differ by, each is asked for by that name ("Size", "Colour");
   * otherwise one list of the variants as the shop titles them.
   */
  const choose = (product: CartProduct) => {
    const list = product.variants;
    const names = (product.options || []).filter((o) => o && o.name && o.values?.length);
    const byName = names.length > 0 && list.every((v) => Array.isArray(v.options) && v.options.length === names.length);
    const box = el('div', 'sfas-hit-options');
    const price = el('span', 'sfas-hit-option-price');
    const start = list.find((v) => v.available) || list[0];
    let draw = () => {};
    if (byName) {
      const inputs = names.map((option, at) => {
        const { field, input } = select(option.name);
        for (const value of option.values) { const o = el('option', '', value); o.value = value; input.appendChild(o); }
        input.value = start.options![at];
        box.appendChild(field);
        return input;
      });
      chosen = () => list.find((v) => v.options!.every((value, i) => inputs[i].value === value)) || null;
      draw = () => {
        // A value that cannot be bought with what else is chosen says so, and stays choosable: the other choice may be the one to change.
        inputs.forEach((input, at) => {
          for (const o of Array.from(input.options)) {
            const open = list.some((v) => v.available && v.options![at] === o.value && v.options!.every((value, i) => i === at || inputs[i].value === value));
            o.textContent = open ? o.value : `${o.value} · ${strings.soldOut}`;
          }
        });
      };
      inputs.forEach((input) => input.addEventListener('change', () => settle()));
      inputs[0].focus();
    } else {
      const { field, input } = select(strings.chooseOption);
      for (const v of list) {
        const o = el('option', '', v.available ? v.title : `${v.title} · ${strings.soldOut}`);
        o.value = v.id;
        input.appendChild(o);
      }
      input.value = start.id;
      box.appendChild(field);
      chosen = () => list.find((v) => v.id === input.value) || null;
      input.addEventListener('change', () => settle());
    }
    box.appendChild(price);
    row.insertBefore(box, add);
    settle = () => {
      draw();
      const v = chosen!();
      price.textContent = v?.price || '';
      price.hidden = !v?.price;
      if (v && v.available) { add.disabled = false; say(strings.addToCart, ''); }
      else { add.disabled = true; say(strings.soldOut, ''); }
    };
    settle();
    if (!byName) box.querySelector('select')?.focus();
  };

  add.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (add.disabled) return;
    if (chosen) { put(chosen()); return; }
    if (!cart.product) { put(null); return; }
    add.disabled = true;
    say(strings.addToCart, 'is-busy');
    let product: CartProduct | null;
    try {
      product = await cart.product(hit);
    } catch (error) {
      say(strings.cartError, 'is-error', error instanceof Error ? error.message : '');
      rest(ERROR_MS);
      return;
    }
    const variants = product?.variants || [];
    if (variants.length && !variants.some((v) => v.available)) { add.disabled = true; say(strings.soldOut, ''); return; }
    if (product && variants.length > 1) { choose(product); return; }
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
  // Badges from the product's tags, over the corner of the picture.
  const badges = options.compact || !options.actions?.badges ? [] : badgesFor(hit, options.actions.badges);
  if (badges.length) {
    const row = el('span', 'sfas-hit-badges');
    for (const badge of badges) {
      if (badge.flag) {
        const flag = el('span', `sfas-hit-flag sfas-hit-flag--${badge.flag}`);
        flag.setAttribute('role', 'img');
        flag.setAttribute('aria-label', badge.label);
        flag.title = badge.label;
        row.appendChild(flag);
      } else {
        row.appendChild(el('span', 'sfas-hit-badge', badge.label));
      }
    }
    media.appendChild(row);
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
