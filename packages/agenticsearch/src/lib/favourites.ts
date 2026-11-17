import type { Hit } from '../client/types';

/**
 * What a visitor has saved with the heart on a card. Kept in this browser
 * (localStorage), one list per search tool, with enough of each product to
 * draw its card again without asking the API.
 */
export interface Favourites {
  has(hit: Hit): boolean;
  /** Saves it, or takes it off. Returns whether it is saved now. */
  toggle(hit: Hit): boolean;
  /** Newest first. */
  all(): Hit[];
  count(): number;
  /** Fresher details (a price that changed) for products already saved. */
  refresh(hits: Hit[]): void;
  /** Called after every change, here or in another tab. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}

const PREFIX = 'sfas:favourites:';
const MAX = 200;
const stores = new Map<string, Favourites>();

/** What a product is saved under: its id, or its address when the feed has no id. */
export const favouriteId = (hit: Hit): string => String(hit.id || hit.url || '');

// Only what a card draws: no feed fields, nothing that grows.
const snapshot = (hit: Hit): Hit => ({
  id: hit.id, title: hit.title, year: hit.year, meta: hit.meta, location: hit.location, price: hit.price, monthly: hit.monthly || '',
  url: hit.url, image: hit.image, brand: hit.brand, priceValue: hit.priceValue, outOfStock: !!hit.outOfStock,
});

function storage(): Storage | null {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}

export function favouritesFor(toolId: string): Favourites {
  const existing = stores.get(toolId);
  if (existing) return existing;
  const key = PREFIX + toolId;
  const listeners = new Set<() => void>();
  let items: Hit[] = [];
  const read = () => {
    try {
      const raw = JSON.parse(storage()?.getItem(key) || '[]');
      items = Array.isArray(raw) ? raw.filter((h) => h && typeof h === 'object' && favouriteId(h) && typeof h.title === 'string').slice(0, MAX) : [];
    } catch { items = []; }
  };
  const write = () => { try { storage()?.setItem(key, JSON.stringify(items)); } catch { /* full, or private mode: kept for this page */ } };
  const tell = () => { for (const listener of [...listeners]) listener(); };
  read();
  // The same list in another tab of the same site.
  if (typeof window !== 'undefined') window.addEventListener('storage', (event) => { if (event.key === key) { read(); tell(); } });

  const store: Favourites = {
    has: (hit) => { const id = favouriteId(hit); return !!id && items.some((h) => favouriteId(h) === id); },
    toggle(hit) {
      const id = favouriteId(hit);
      if (!id) return false;
      const was = items.length;
      items = items.filter((h) => favouriteId(h) !== id);
      const on = items.length === was;
      if (on) items = [snapshot(hit), ...items].slice(0, MAX);
      write();
      tell();
      return on;
    },
    all: () => items.slice(),
    count: () => items.length,
    refresh(hits) {
      if (!items.length) return;
      const fresh = new Map(hits.map((h) => [favouriteId(h), h] as const));
      let changed = false;
      items = items.map((h) => {
        const now = fresh.get(favouriteId(h));
        if (!now) return h;
        const next = snapshot(now);
        if (JSON.stringify(next) !== JSON.stringify(h)) changed = true;
        return next;
      });
      // Written quietly: nothing a visitor chose has changed.
      if (changed) write();
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  stores.set(toolId, store);
  return store;
}
