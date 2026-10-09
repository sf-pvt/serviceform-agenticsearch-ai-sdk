import { isFiltered } from '../client/query';
import type { AgenticSearch } from '../core/agenticsearch';
import type { Widget } from '../core/types';
import { button, el, icon } from '../lib/dom';
import { aiAnswer, autocomplete, clearRefinements, currentRefinements, dynamicFacets, inStock, infiniteHits, note, searchBox, sortBy, stats } from '../widgets';

export interface LayoutOptions {
  placeholder?: string;
  searchPageHref?: string;
  searchPageParam?: string;
  autofocus?: boolean;
  onSubmit?: (query: string) => void;
}

export interface Layout { widgets: Widget[]; /** Undoes whatever the layout wired up beside its widgets. */ teardown(): void }

/**
 * The full results page, laid out as the Serviceform search page is: the
 * filters down the left as a card, headed by how many were found and the
 * order they are in; the field over the results and no wider than them, the
 * example questions, the AI answer and the chips that are on under it. On a
 * phone the filters are behind a button, and the count and the order come
 * out to the line over the results so they are not put away with them.
 */
export function pageLayout(host: HTMLElement, instance: AgenticSearch, options: LayoutOptions = {}): Layout {
  const page = el('div', 'sfas-page');
  const body = el('div', 'sfas-page-body');
  const side = el('aside', 'sfas-page-side');
  const sideHead = el('div', 'sfas-side-head');
  const sideTitle = el('strong');
  const sideClose = button('sfas-side-close');
  sideClose.appendChild(icon('close'));
  sideHead.appendChild(sideTitle);
  sideHead.appendChild(sideClose);
  const count = el('div', 'sfas-page-count');
  const sortGroup = el('div', 'sfas-page-sortgroup');
  const sortTitle = el('div', 'sfas-facet-title');
  const sort = el('div', 'sfas-page-sort');
  sortGroup.append(sortTitle, sort);
  const stock = el('div', 'sfas-page-stock');
  const facets = el('div');
  const clearHost = el('div', 'sfas-side-clear');
  const sideDone = button('sfas-side-done');
  const main = el('div', 'sfas-page-main');
  const top = el('div', 'sfas-page-top');
  const questions = el('div', 'sfas-questions');
  const answer = el('div');
  const tools = el('div', 'sfas-page-tools');
  const filterButton = button('sfas-filter-button');
  filterButton.appendChild(icon('filter'));
  const filterLabel = el('span');
  const filterCount = el('b', 'sfas-filter-count');
  filterButton.appendChild(filterLabel);
  filterButton.appendChild(filterCount);
  const chips = el('div');
  const said = el('div');
  const results = el('div');

  tools.append(filterButton, chips);
  side.append(sideHead, count, sortGroup, clearHost, stock, facets, sideDone);
  main.append(top, questions, answer, tools, said, results);
  body.append(side, main);
  page.append(body);
  host.appendChild(page);

  const toggleFilters = (on: boolean) => page.classList.toggle('is-filters-open', on);
  filterButton.addEventListener('click', () => toggleFilters(true));
  sideClose.addEventListener('click', () => toggleFilters(false));
  sideDone.addEventListener('click', () => toggleFilters(false));

  // Where the count and the order go: at the head of the filters while
  // those are down the side; on the line over the results on a phone, or
  // when this tool shows no filters at all.
  const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 820px)') : null;
  let aside = true;
  let chipsOn = 0;
  const place = () => {
    const wanted = aside && !(media && media.matches);
    if (wanted) {
      if (count.parentNode !== side) side.insertBefore(count, sortGroup);
      if (sort.parentNode !== sortGroup) sortGroup.appendChild(sort);
    } else {
      if (count.parentNode !== tools) tools.insertBefore(count, chips);
      if (sort.parentNode !== tools) tools.appendChild(sort);
    }
    sortGroup.hidden = !wanted;
    // Nothing on the line (the filters are down the side, none is on): no line.
    tools.classList.toggle('is-bare', wanted && !chipsOn);
  };
  const onMedia = () => place();
  media?.addEventListener?.('change', onMedia);

  // The pieces the widgets do not own: labels in the tool's language, the
  // number on the filter button, whether this catalogue has stock to filter by.
  const off = instance.on('render', ({ strings, results: r, config, state }) => {
    filterLabel.textContent = strings.filters;
    sideTitle.textContent = strings.filters;
    sortTitle.textContent = strings.sortBy;
    sideClose.setAttribute('aria-label', strings.close);
    const on = (r?.chips || []).filter((c) => c.key !== 'sort').length;
    filterCount.textContent = on ? String(on) : '';
    chipsOn = (r?.chips || []).length;
    sideDone.textContent = r ? (r.found === 1 ? strings.result : strings.results.replace('{n}', String(r.found))) : strings.close;
    stock.hidden = !(r?.available || []).includes('availability') && !state.inStock;
    page.classList.toggle('sfas-page--nofilters', !config.showFilters);
    aside = config.showFilters;
    // Example questions are for an empty page; once something is asked they are in the way.
    questions.hidden = !instance.aiEnabled() || !!state.q || isFiltered(state) || instance.ai.status !== 'idle' || !config.questions.length;
    if (!questions.hidden && questions.dataset.key !== config.questions.join('|')) {
      questions.dataset.key = config.questions.join('|');
      questions.textContent = '';
      for (const question of config.questions.slice(0, 6)) {
        const b = button('sfas-question', question);
        b.addEventListener('click', () => instance.submit(question, { ask: true }));
        questions.appendChild(b);
      }
    }
    place();
  });

  return {
    widgets: [
      searchBox({ container: top, placeholder: options.placeholder, autofocus: options.autofocus }),
      aiAnswer({ container: answer }),
      stats({ container: count }),
      sortBy({ container: sort }),
      currentRefinements({ container: chips }),
      inStock({ container: stock }),
      dynamicFacets({ container: facets }),
      clearRefinements({ container: clearHost }),
      note({ container: said }),
      infiniteHits({ container: results }),
    ],
    teardown() { off(); media?.removeEventListener?.('change', onMedia); page.remove(); },
  };
}

/** A field with an instant dropdown. `section` adds the tool's example questions under it. */
export function boxLayout(host: HTMLElement, instance: AgenticSearch, options: LayoutOptions & { questions?: boolean } = {}): Layout {
  const wrap = el('div', 'sfas-box');
  const fieldHost = el('div');
  const pills = el('div', 'sfas-questions');
  wrap.append(fieldHost, pills);
  host.appendChild(wrap);
  pills.hidden = true;
  let off = () => {};
  if (options.questions) {
    off = instance.on('render', ({ config }) => {
      pills.hidden = !instance.aiEnabled() || !config.questions.length;
      if (pills.hidden || pills.dataset.key === config.questions.join('|')) return;
      pills.dataset.key = config.questions.join('|');
      pills.textContent = '';
      for (const question of config.questions.slice(0, 4)) {
        const b = button('sfas-question', question);
        b.addEventListener('click', () => {
          // Asked the way typing it and pressing Enter would ask it.
          const input = fieldHost.querySelector<HTMLInputElement>('.sfas-input');
          const form = fieldHost.querySelector<HTMLFormElement>('form');
          if (!input || !form) return;
          input.value = question;
          input.focus();
          form.dispatchEvent(new Event('submit', { cancelable: true }));
        });
        pills.appendChild(b);
      }
    });
  }
  return {
    widgets: [autocomplete({
      container: fieldHost,
      placeholder: options.placeholder,
      searchPageHref: options.searchPageHref,
      searchPageParam: options.searchPageParam,
      onSubmit: options.onSubmit,
      autofocus: options.autofocus,
      showQuestions: !options.questions,
    })],
    teardown() { off(); wrap.remove(); },
  };
}
