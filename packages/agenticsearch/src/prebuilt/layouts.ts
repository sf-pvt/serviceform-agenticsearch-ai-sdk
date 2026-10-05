import { isFiltered } from '../client/query';
import type { AgenticSearch } from '../core/agenticsearch';
import type { Widget } from '../core/types';
import { button, el, icon } from '../lib/dom';
import { aiAnswer, autocomplete, currentRefinements, dynamicFacets, inStock, infiniteHits, note, searchBox, sortBy, stats } from '../widgets';

export interface LayoutOptions {
  placeholder?: string;
  searchPageHref?: string;
  searchPageParam?: string;
  autofocus?: boolean;
  onSubmit?: (query: string) => void;
}

export interface Layout { widgets: Widget[]; /** Undoes whatever the layout wired up beside its widgets. */ teardown(): void }

/** The full results page: field, AI answer, chips, order, filters, results. */
export function pageLayout(host: HTMLElement, instance: AgenticSearch, options: LayoutOptions = {}): Layout {
  const page = el('div', 'sfas-page');
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
  const count = el('div');
  const chips = el('div');
  const sort = el('div', 'sfas-page-sort');
  const said = el('div');
  const body = el('div', 'sfas-page-body');
  const side = el('aside', 'sfas-page-side');
  const sideHead = el('div', 'sfas-side-head');
  const sideTitle = el('strong');
  const sideClose = button('sfas-side-close');
  sideClose.appendChild(icon('close'));
  sideHead.appendChild(sideTitle);
  sideHead.appendChild(sideClose);
  const stock = el('div', 'sfas-page-stock');
  const facets = el('div');
  const sideDone = button('sfas-side-done');
  const main = el('div', 'sfas-page-main');
  const results = el('div');

  tools.append(filterButton, count, chips, sort);
  side.append(sideHead, stock, facets, sideDone);
  main.append(said, results);
  body.append(side, main);
  page.append(top, questions, answer, tools, body);
  host.appendChild(page);

  const toggleFilters = (on: boolean) => page.classList.toggle('is-filters-open', on);
  filterButton.addEventListener('click', () => toggleFilters(true));
  sideClose.addEventListener('click', () => toggleFilters(false));
  sideDone.addEventListener('click', () => toggleFilters(false));

  // The pieces the widgets do not own: labels in the tool's language, the
  // number on the filter button, whether this catalogue has stock to filter by.
  const off = instance.on('render', ({ strings, results: r, config, state }) => {
    filterLabel.textContent = strings.filters;
    sideTitle.textContent = strings.filters;
    sideClose.setAttribute('aria-label', strings.close);
    const on = (r?.chips || []).filter((c) => c.key !== 'sort').length;
    filterCount.textContent = on ? String(on) : '';
    sideDone.textContent = r ? (r.found === 1 ? strings.result : strings.results.replace('{n}', String(r.found))) : strings.close;
    stock.hidden = !(r?.available || []).includes('availability') && !state.inStock;
    page.classList.toggle('sfas-page--nofilters', !config.showFilters);
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
  });

  return {
    widgets: [
      searchBox({ container: top, placeholder: options.placeholder, autofocus: options.autofocus }),
      aiAnswer({ container: answer }),
      stats({ container: count }),
      currentRefinements({ container: chips }),
      sortBy({ container: sort }),
      inStock({ container: stock }),
      dynamicFacets({ container: facets }),
      note({ container: said }),
      infiniteHits({ container: results }),
    ],
    teardown() { off(); page.remove(); },
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
