import type { Hit } from '../client/types';
import { el, escapeHtml, fill, openWhere } from '../lib/dom';

export type HitTemplate = (hit: Hit, helpers: { escape: typeof escapeHtml; position: number }) => string | Node;

export interface CardOptions { fallbackImage?: string; template?: HitTemplate; onClick?: (hit: Hit, position: number) => void; compact?: boolean; /** The link opens in a new tab. */ newTab?: boolean }

/** One result as a card (or a row in a dropdown): picture, title, details, price, the whole of it a link. */
export function renderCard(hit: Hit, position: number, options: CardOptions = {}): HTMLElement {
  const item = el('li', `sfas-hit${hit.outOfStock ? ' sfas-hit--out' : ''}${options.compact ? ' sfas-hit--row' : ''}`);
  const link = openWhere(el('a', 'sfas-hit-link'), !!options.newTab);
  if (hit.url) link.href = hit.url;
  if (options.onClick) link.addEventListener('click', () => options.onClick!(hit, position));
  if (options.template) {
    fill(link, options.template(hit, { escape: escapeHtml, position }));
    item.appendChild(link);
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
