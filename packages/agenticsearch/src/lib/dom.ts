/** Small DOM helpers. Text always goes in as text, never as markup. */

export type Container = string | HTMLElement;

export function resolveContainer(container: Container, widget: string): HTMLElement {
  const node = typeof container === 'string' ? document.querySelector<HTMLElement>(container) : container;
  if (!node) throw new Error(`${widget}: container not found (${String(container)})`);
  return node;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string | null, attrs?: Record<string, string>): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null && text !== '') node.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export function button(className: string, text?: string, label?: string): HTMLButtonElement {
  const b = el('button', className, text);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  return b;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** A template's output into a node: a string is taken as HTML the site wrote itself, a node is used as it is. */
export function fill(target: HTMLElement, content: string | Node | null | undefined): void {
  if (content == null) return;
  if (typeof content === 'string') target.innerHTML = content;
  else target.appendChild(content);
}

const SVG = (path: string) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
export const ICONS = {
  search: SVG('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  close: SVG('<path d="M6 6l12 12M18 6L6 18"/>'),
  page: SVG('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  spark: SVG('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
  filter: SVG('<path d="M4 6h16M7 12h10M10 18h4"/>'),
  arrow: SVG('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  trend: SVG('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
};

export function icon(name: keyof typeof ICONS, className = 'sfas-icon'): HTMLSpanElement {
  const span = el('span', className);
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = ICONS[name];
  return span;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): ((...args: A) => void) & { cancel(): void; flush(...args: A): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...args); }, ms);
  };
  wrapped.cancel = () => { if (timer) clearTimeout(timer); timer = null; };
  wrapped.flush = (...args: A) => { wrapped.cancel(); fn(...args); };
  return wrapped;
}

/** Names for a widget's parts, with the site's own classes added on. */
export function classNames<T extends string>(base: Record<T, string>, extra?: Partial<Record<T, string>>): Record<T, string> {
  const out = { ...base };
  if (extra) for (const key of Object.keys(extra) as T[]) if (extra[key]) out[key] = `${base[key] || ''} ${extra[key]}`.trim();
  return out;
}
