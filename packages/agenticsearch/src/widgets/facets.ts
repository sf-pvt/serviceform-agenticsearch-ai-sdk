import { connectDynamicFacets, connectRange, connectRefinementList, type DynamicFacet } from '../connectors';
import type { RenderContext, Widget } from '../core/types';
import { button, clear, debounce, el, resolveContainer, type Container } from '../lib/dom';

export interface RefinementListParams {
  container: Container;
  attribute: string;
  limit?: number;
  showMoreLimit?: number;
  /** A field to find a value by. On by itself when the list is long. */
  searchable?: boolean;
  /** `list` (checkboxes), `buttons` (pills) or `dropdown` (a select). */
  style?: 'list' | 'buttons' | 'dropdown' | string;
  /** Show the filter's name above it. On by default. */
  title?: boolean;
}

/** One filter: the values of an attribute with their counts, ticked to narrow the search. */
export function refinementList(params: RefinementListParams): Widget {
  const root = resolveContainer(params.container, 'refinementList');
  const style = params.style === 'buttons' || params.style === 'dropdown' ? params.style : 'list';
  const group = el('div', `sfas-facet sfas-facet--${style}`);
  const title = el('div', 'sfas-facet-title');
  const find = el('input', 'sfas-facet-find');
  find.type = 'search';
  const list = el('ul', 'sfas-facet-list');
  const select = el('select', 'sfas-facet-select');
  const more = button('sfas-facet-more');
  return connectRefinementList<RefinementListParams>(({ items, label, refine, canRefine, canToggleShowMore, isShowingMore, toggleShowMore, searchForItems, instance }, first) => {
    const s = instance.strings;
    if (first) {
      clear(root);
      if (params.title !== false) group.appendChild(title);
      if (style === 'dropdown') {
        group.appendChild(select);
        select.addEventListener('change', () => instance.setRefinements(params.attribute, select.value ? [select.value] : []));
      } else {
        group.appendChild(find);
        group.appendChild(list);
        group.appendChild(more);
        find.addEventListener('input', () => searchForItems(find.value));
        more.addEventListener('click', () => toggleShowMore());
      }
      root.appendChild(group);
    }
    group.hidden = !canRefine;
    title.textContent = label;
    if (style === 'dropdown') {
      clear(select);
      const any = el('option', '', s.any); any.value = ''; select.appendChild(any);
      let current = '';
      for (const item of items) {
        const opt = el('option', '', `${item.label} (${item.count})`); opt.value = item.value; select.appendChild(opt);
        if (item.isRefined) current = item.value;
      }
      select.value = current;
      select.setAttribute('aria-label', label);
      return;
    }
    const searchable = params.searchable ?? (canToggleShowMore && style === 'list');
    find.hidden = !searchable && !find.value;
    // "Search make": the filter's own name in the field that finds a value of it.
    find.placeholder = `${s.findValue} ${label.toLocaleLowerCase()}`;
    find.setAttribute('aria-label', `${s.findValue}: ${label}`);
    clear(list);
    for (const item of items) {
      const li = el('li', `sfas-facet-item${item.isRefined ? ' is-refined' : ''}`);
      if (style === 'buttons') {
        const b = button('sfas-facet-pill', item.label);
        b.setAttribute('aria-pressed', String(item.isRefined));
        b.addEventListener('click', () => refine(item.value));
        li.appendChild(b);
      } else {
        const row = el('label', 'sfas-facet-row');
        const box = el('input');
        box.type = 'checkbox';
        box.checked = item.isRefined;
        box.addEventListener('change', () => refine(item.value));
        row.appendChild(box);
        row.appendChild(el('span', 'sfas-facet-label', item.label));
        row.appendChild(el('span', 'sfas-facet-count', String(item.count)));
        li.appendChild(row);
      }
      list.appendChild(li);
    }
    more.hidden = !canToggleShowMore;
    more.textContent = isShowingMore ? s.fewer : s.more;
  }, () => clear(root))(params);
}

export interface RangeParams {
  container: Container;
  attribute: string;
  title?: boolean;
  /** Two fields to type the bounds into, over the slider. Off by default: the slider and what it reads are enough. */
  fields?: boolean;
  /** The two fields and no slider. */
  inputsOnly?: boolean;
}

/** A numeric filter (price, year, mileage): its name with what it is set to beside it, and a two-handled slider. */
export function range(params: RangeParams): Widget {
  const root = resolveContainer(params.container, 'range');
  const group = el('div', 'sfas-facet sfas-facet--range');
  const head = el('div', 'sfas-range-head');
  const title = el('div', 'sfas-facet-title');
  const said = el('div', 'sfas-range-said');
  const fields = el('div', 'sfas-range-fields');
  const lo = el('input', 'sfas-range-input');
  const hi = el('input', 'sfas-range-input');
  const slider = el('div', 'sfas-range-slider');
  const filled = el('i', 'sfas-range-filled');
  const sLo = el('input');
  const sHi = el('input');
  for (const input of [lo, hi]) { input.type = 'number'; input.inputMode = 'numeric'; }
  for (const input of [sLo, sHi]) { input.type = 'range'; }
  const withFields = !!(params.fields || params.inputsOnly);
  let apply: (bounds: [number | null, number | null]) => void = () => {};
  let bounds = { min: 0, max: 0 };
  const read = (input: HTMLInputElement): number | null => (input.value.trim() === '' || !Number.isFinite(Number(input.value)) ? null : Number(input.value));
  const commit = () => {
    let a = read(lo);
    let b = read(hi);
    if (a !== null && b !== null && a > b) [a, b] = [b, a];
    // A bound at the edge of what there is narrows nothing: it is left open.
    apply([a !== null && a <= bounds.min ? null : a, b !== null && b >= bounds.max ? null : b]);
  };
  const later = debounce(commit, 350);
  // The track between the two handles, in the tool's colour.
  const paint = () => {
    const min = Number(sLo.min);
    const span = Number(sLo.max) - min || 1;
    filled.style.left = `${((Number(sLo.value) - min) / span) * 100}%`;
    filled.style.right = `${100 - ((Number(sHi.value) - min) / span) * 100}%`;
  };
  return connectRange<RangeParams>(({ label, range: r, start, refine, canRefine, format, instance }, first) => {
    const s = instance.strings;
    apply = refine;
    bounds = r;
    if (first) {
      clear(root);
      if (params.title !== false) head.appendChild(title);
      head.appendChild(said);
      group.appendChild(head);
      if (withFields) {
        fields.appendChild(lo); fields.appendChild(el('span', 'sfas-range-dash', '–')); fields.appendChild(hi);
        group.appendChild(fields);
      }
      if (!params.inputsOnly) { slider.appendChild(filled); slider.appendChild(sLo); slider.appendChild(sHi); group.appendChild(slider); }
      lo.addEventListener('change', commit);
      hi.addEventListener('change', commit);
      sLo.addEventListener('input', () => { if (Number(sLo.value) > Number(sHi.value)) sLo.value = sHi.value; lo.value = sLo.value; paint(); later(); });
      sHi.addEventListener('input', () => { if (Number(sHi.value) < Number(sLo.value)) sHi.value = sLo.value; hi.value = sHi.value; paint(); later(); });
      root.appendChild(group);
    }
    const active = start[0] !== null || start[1] !== null;
    group.hidden = !canRefine && !active;
    title.textContent = label;
    lo.placeholder = String(r.min); hi.placeholder = String(r.max);
    lo.setAttribute('aria-label', `${label}: ${s.min}`); hi.setAttribute('aria-label', `${label}: ${s.max}`);
    // Not while it is being typed in or dragged: the visitor's hand wins.
    const busy = [lo, hi, sLo, sHi].includes(document.activeElement as HTMLInputElement);
    if (!busy) {
      lo.value = start[0] === null ? '' : String(start[0]);
      hi.value = start[1] === null ? '' : String(start[1]);
      const min = Math.min(r.min, start[0] ?? r.min);
      const max = Math.max(r.max, start[1] ?? r.max);
      const step = String(params.attribute === 'year' || max - min < 200 ? 1 : Math.pow(10, Math.max(0, Math.floor(Math.log10(max - min)) - 2)));
      for (const input of [sLo, sHi]) { input.min = String(min); input.max = String(max); input.step = step; }
      sLo.value = String(start[0] ?? min);
      sHi.value = String(start[1] ?? max);
      sLo.setAttribute('aria-label', `${label}: ${s.min}`); sHi.setAttribute('aria-label', `${label}: ${s.max}`);
      paint();
    }
    said.textContent = `${format(start[0] ?? r.min)} \u2013 ${format(start[1] ?? r.max)}`;
  }, () => { later.cancel(); clear(root); })(params);
}

export interface DynamicFacetsParams { container: Container; facets?: string[]; limit?: number }

/**
 * Every filter this catalogue has, in the order set on the tool: lists for
 * words, ranges for numbers. Catalogues differ, so the page does not have to
 * know in advance which filters there are.
 */
export function dynamicFacets(params: DynamicFacetsParams): Widget {
  const root = resolveContainer(params.container, 'dynamicFacets');
  const children = new Map<string, { widget: Widget; host: HTMLElement; started: boolean }>();
  let context: RenderContext | null = null;
  const sync = (facets: DynamicFacet[], show: boolean) => {
    if (!context) return;
    root.classList.add('sfas-facets');
    root.hidden = !show;
    const wanted = new Set(facets.map((f) => `${f.type}:${f.attribute}:${f.style}`));
    for (const [key, child] of children) {
      if (wanted.has(key)) continue;
      child.widget.dispose?.(context);
      child.host.remove();
      children.delete(key);
    }
    facets.forEach((facet, index) => {
      const key = `${facet.type}:${facet.attribute}:${facet.style}`;
      let child = children.get(key);
      if (!child) {
        const host = el('div', 'sfas-facet-host');
        const widget = facet.type === 'range'
          ? range({ container: host, attribute: facet.attribute })
          : refinementList({ container: host, attribute: facet.attribute, style: facet.style, limit: params.limit });
        child = { widget, host, started: false };
        children.set(key, child);
      }
      if (root.children[index] !== child.host) root.insertBefore(child.host, root.children[index] || null);
      if (!child.started) { child.widget.init?.(context!); child.started = true; }
      else child.widget.render?.(context!);
    });
  };
  const widget = connectDynamicFacets<DynamicFacetsParams>(({ facets, show }) => sync(facets, show), () => {
    if (context) for (const child of children.values()) child.widget.dispose?.(context);
    children.clear();
    clear(root);
  })(params);
  // The children are drawn with the same context the parent was given.
  return {
    $$type: widget.$$type,
    init(ctx) { context = ctx; widget.init?.(ctx); },
    render(ctx) { context = ctx; widget.render?.(ctx); },
    dispose(ctx) { context = ctx; widget.dispose?.(ctx); },
  };
}
