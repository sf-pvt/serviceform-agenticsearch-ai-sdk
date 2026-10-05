import { connectAutocomplete, connectSearchBox } from '../connectors';
import type { Widget } from '../core/types';
import { button, clear, debounce, el, icon, resolveContainer, type Container } from '../lib/dom';
import { aiAnswer } from './ai';
import { renderCard } from './card';

export interface SearchBoxParams {
  container: Container;
  placeholder?: string;
  autofocus?: boolean;
  /** Search while typing (on by default). Off: only Enter searches. */
  searchAsYouType?: boolean;
  /** Milliseconds to wait after a keystroke. */
  debounce?: number;
}

function field(placeholder: string) {
  // No role="search" on the form itself: themes and plugins target
  // form[role="search"] to restyle or replace "the site's search form", and
  // this one must not be caught by that. The role goes on the wrapper.
  const form = el('form', 'sfas-searchbox');
  form.noValidate = true;
  const input = el('input', 'sfas-input');
  input.type = 'search';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('enterkeyhint', 'search');
  input.maxLength = 120;
  input.placeholder = placeholder;
  const reset = button('sfas-input-clear');
  reset.innerHTML = icon('close').innerHTML;
  reset.hidden = true;
  form.appendChild(icon('search', 'sfas-input-icon'));
  form.appendChild(input);
  form.appendChild(reset);
  return { form, input, reset };
}

/** The search field of a results page: searches as it is typed in, and Enter starts a new search (and asks the AI). */
export function searchBox(params: SearchBoxParams): Widget {
  const root = resolveContainer(params.container, 'searchBox');
  const { form, input, reset } = field(params.placeholder || '');
  let refineNow: (q: string) => void = () => {};
  const later = debounce((q: string) => refineNow(q), params.debounce ?? 220);
  return connectSearchBox<SearchBoxParams>(({ query, refine, submit, clear: clearAll, isLoading, instance }, first) => {
    const s = instance.strings;
    refineNow = refine;
    if (first) {
      clear(root);
      if (!root.hasAttribute('role')) root.setAttribute('role', 'search');
      root.appendChild(form);
      input.value = query;
      input.addEventListener('input', () => {
        reset.hidden = !input.value;
        if (params.searchAsYouType !== false) later(input.value);
      });
      form.addEventListener('submit', (event) => { event.preventDefault(); later.cancel(); submit(input.value); });
      reset.addEventListener('click', () => { later.cancel(); input.value = ''; reset.hidden = true; clearAll(); input.focus(); });
      if (params.autofocus) input.focus();
    }
    input.placeholder = params.placeholder || instance.config.placeholders[0] || s.placeholder;
    input.setAttribute('aria-label', s.search);
    reset.setAttribute('aria-label', s.clearQuery);
    form.classList.toggle('is-loading', isLoading);
    // The field follows the search (the address, a cleared chip) but never over what is being typed.
    if (document.activeElement !== input && input.value !== query) input.value = query;
    reset.hidden = !input.value;
  }, () => { later.cancel(); clear(root); })(params);
}

export interface AutocompleteParams {
  container: Container;
  placeholder?: string;
  /** Product rows in the dropdown. */
  limit?: number;
  /** The site's results page. Enter and "show all results" go there with the words as a query parameter. */
  searchPageHref?: string;
  searchPageParam?: string;
  /** Takes Enter and "show all results" instead of the default (the results page, or the AI in the dropdown). */
  onSubmit?: (query: string) => void;
  /** Offer the tool's example questions when the field is focused and empty. On by default. */
  showQuestions?: boolean;
  autofocus?: boolean;
}

/**
 * A search field with an instant dropdown: products, the site's own pages,
 * what others searched for, and the AI. For a header, a hero, or anywhere
 * that is not itself the results page.
 */
export function autocomplete(params: AutocompleteParams): Widget {
  const root = resolveContainer(params.container, 'autocomplete');
  const wrap = el('div', 'sfas-autocomplete');
  wrap.setAttribute('role', 'search');
  const { form, input, reset } = field(params.placeholder || '');
  const panel = el('div', 'sfas-panel');
  panel.hidden = true;
  const answerHost = el('div');
  const answer = aiAnswer({ container: answerHost, showHits: true });
  const listId = `sfas-list-${Math.random().toString(36).slice(2, 8)}`;
  panel.id = listId;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', listId);
  let open = false;
  let active = -1;
  let redraw: () => void = () => {};
  let go: (query: string) => void = () => {};
  const options = () => Array.from(panel.querySelectorAll<HTMLElement>('.sfas-option'));
  const setActive = (index: number) => {
    const all = options();
    active = all.length ? (index + all.length) % all.length : -1;
    all.forEach((node, i) => node.classList.toggle('is-active', i === active));
    if (active >= 0) all[active].scrollIntoView({ block: 'nearest' });
  };
  const close = () => { if (!open) return; open = false; active = -1; redraw(); };
  const onDocument = (event: Event) => { if (!wrap.contains(event.target as Node)) close(); };

  return connectAutocomplete<AutocompleteParams>(({ query, hits, found, pages, suggestions, chips, note, status, refine, sendClick, instance }, first) => {
    const { strings: s, config, ai } = instance.context();
    const aiOn = instance.aiEnabled();
    const pageHref = params.searchPageHref ?? config.searchPageHref;
    const pageParam = params.searchPageParam || config.searchPageParam || 'q';
    const resultsUrl = (q: string) => `${pageHref}${pageHref.includes('?') ? '&' : '?'}${encodeURIComponent(pageParam)}=${encodeURIComponent(q)}`;
    go = (q: string) => {
      const words = q.trim();
      if (!words) return;
      if (params.onSubmit) { close(); params.onSubmit(words); return; }
      if (pageHref) { window.location.assign(resultsUrl(words)); return; }
      if (aiOn) { open = true; void instance.ask(words); }
    };
    redraw = () => instance.render();

    if (first) {
      clear(root);
      wrap.appendChild(form);
      wrap.appendChild(panel);
      root.appendChild(wrap);
      answer.init?.(instance.context());
      input.addEventListener('input', () => {
        reset.hidden = !input.value;
        open = true;
        active = -1;
        if (instance.ai.status !== 'idle') instance.resetConversation();
        refine(input.value);
      });
      input.addEventListener('focus', () => { open = true; refine(input.value); });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); open = true; setActive(active + 1); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(active - 1); }
        else if (event.key === 'Escape') { if (open) { event.stopPropagation(); close(); } }
      });
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const chosen = active >= 0 ? options()[active] : null;
        if (chosen) chosen.click();
        else go(input.value);
      });
      reset.addEventListener('click', () => { input.value = ''; reset.hidden = true; instance.resetConversation(); refine(''); input.focus(); });
      document.addEventListener('pointerdown', onDocument);
      if (params.autofocus) input.focus();
    }

    input.placeholder = params.placeholder || config.placeholders[0] || s.placeholder;
    input.setAttribute('aria-label', s.search);
    reset.setAttribute('aria-label', s.clearQuery);
    form.classList.toggle('is-loading', status === 'loading');

    // Two columns, as in the Serviceform search box: everything that is talk
    // or a place to go on the left (the AI, the site's pages, what others
    // searched for), the products on the right. With no products the left
    // column has the whole width; with nothing but products, they do.
    clear(panel);
    const left = el('div', 'sfas-panel-left');
    const right = el('div', 'sfas-panel-right');
    const section = (title: string, column: HTMLElement) => {
      const box = el('div', 'sfas-panel-section');
      box.appendChild(el('div', 'sfas-panel-title', title));
      column.appendChild(box);
      return box;
    };
    const answering = aiOn && ai.status !== 'idle' && ai.status !== 'error';
    if (answering) {
      left.appendChild(answerHost);
      answer.render?.(instance.context());
    }
    if (query) {
      if (aiOn && !answering) {
        const ask = button('sfas-panel-ask sfas-option');
        ask.appendChild(icon('spark'));
        const words = el('span');
        words.appendChild(el('b', '', s.askAi));
        words.appendChild(document.createTextNode(` “${query}”`));
        ask.appendChild(words);
        ask.appendChild(el('kbd', 'sfas-panel-key', '↵', { 'aria-hidden': 'true' }));
        ask.addEventListener('click', () => { open = true; void instance.ask(query); });
        left.appendChild(ask);
      }
      if (pages.length) {
        const box = section(s.pages, left);
        for (const page of pages) {
          const a = el('a', 'sfas-panel-row sfas-option');
          a.href = page.url;
          a.appendChild(icon('page'));
          a.appendChild(el('span', '', page.label));
          box.appendChild(a);
        }
      }
      if (suggestions.length && !answering) {
        const box = section(s.suggestions, left);
        for (const suggestion of suggestions) {
          const b = button('sfas-panel-row sfas-option');
          b.appendChild(icon('trend'));
          const words = el('span');
          const at = Math.max(0, Math.min(suggestion.boldFrom, suggestion.text.length));
          words.appendChild(document.createTextNode(suggestion.text.slice(0, at)));
          words.appendChild(el('b', '', suggestion.text.slice(at)));
          b.appendChild(words);
          b.addEventListener('click', () => { input.value = suggestion.text; reset.hidden = false; refine(suggestion.text); input.focus(); });
          box.appendChild(b);
        }
      }
      // While the AI answers, its own products are under the answer; the
      // right column is for what typing found.
      if (hits.length && !answering) {
        if (chips.length || note) {
          const read = el('div', 'sfas-chips sfas-chips--read');
          for (const chip of chips) read.appendChild(el('span', 'sfas-chip sfas-chip--static', chip.label));
          if (note) read.appendChild(el('span', 'sfas-note', note));
          right.appendChild(read);
        }
        const box = section(s.products, right);
        const list = el('ul', 'sfas-hits sfas-hits--rows');
        hits.forEach((hit, i) => {
          const row = renderCard(hit, i, { compact: true, fallbackImage: config.fallbackImage, onClick: sendClick });
          row.querySelector('a')?.classList.add('sfas-option');
          list.appendChild(row);
        });
        box.appendChild(list);
        if ((pageHref || params.onSubmit) && found > hits.length) {
          const all = el('a', 'sfas-panel-all sfas-option', `${s.showAll} (${found})`);
          if (pageHref && !params.onSubmit) all.href = resultsUrl(query);
          else { all.href = '#'; all.addEventListener('click', (event) => { event.preventDefault(); go(query); }); }
          all.appendChild(icon('arrow'));
          box.appendChild(all);
        }
      }
      if (!left.childNodes.length && !right.childNodes.length && status === 'idle') {
        left.appendChild(el('div', 'sfas-panel-empty', s.emptyFor.replace('{q}', `“${query}”`)));
      }
    } else if (!answering && params.showQuestions !== false && aiOn && config.questions.length) {
      const box = section(s.askAi, left);
      for (const question of config.questions.slice(0, 5)) {
        const b = button('sfas-panel-row sfas-option');
        b.appendChild(icon('spark'));
        b.appendChild(el('span', '', question));
        b.addEventListener('click', () => { input.value = question; reset.hidden = false; open = true; if (params.onSubmit || pageHref) go(question); else void instance.ask(question); });
        box.appendChild(b);
      }
    }
    if (left.childNodes.length || right.childNodes.length) {
      const grid = el('div', `sfas-panel-grid${right.childNodes.length ? '' : ' sfas-panel-grid--single'}${left.childNodes.length ? '' : ' sfas-panel-grid--wide'}`);
      if (left.childNodes.length) grid.appendChild(left);
      if (right.childNodes.length) grid.appendChild(right);
      panel.appendChild(grid);
    }
    const show = open && panel.childNodes.length > 0;
    panel.hidden = !show;
    input.setAttribute('aria-expanded', String(show));
    wrap.classList.toggle('is-open', show);
    if (active >= 0) setActive(Math.min(active, options().length - 1));
  }, () => {
    document.removeEventListener('pointerdown', onDocument);
    clear(root);
  })(params);
}
