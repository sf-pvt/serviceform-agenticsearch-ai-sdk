import type { Hit } from '../client/types';

/** One buyable version of a product (a size, a colour). */
export interface CartVariant {
  id: string;
  /** "42 / Black". */
  title: string;
  available: boolean;
  /** The price as text, when it differs between variants. */
  price?: string;
}

export interface CartProduct { variants: CartVariant[] }

/**
 * How "Add to cart" on a card reaches the shop's cart. The search itself
 * knows nothing of carts: the platform it runs on (the Shopify app, the
 * WordPress plugin, a site's own code) gives it this.
 */
export interface CartAdapter {
  /**
   * The product's variants, asked for when the button is pressed. With more
   * than one, the card lets the visitor choose. Leave it out (or answer null)
   * for a shop where a product is added as it is.
   */
  product?(hit: Hit): Promise<CartProduct | null>;
  /** Adds to the cart. Rejects when the shop says no; the message is shown. */
  add(hit: Hit, variant: CartVariant | null, quantity: number): Promise<void>;
}

let adapter: CartAdapter | null = null;
const listeners = new Set<() => void>();

/** Gives the search a cart to add to. `null` takes it away. */
export function setCart(next: CartAdapter | null): void {
  adapter = next && typeof next.add === 'function' ? next : null;
  for (const listener of [...listeners]) listener();
}

export const getCart = (): CartAdapter | null => adapter;

/** Called when a cart is given or taken away. Returns an unsubscribe. */
export function onCart(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
