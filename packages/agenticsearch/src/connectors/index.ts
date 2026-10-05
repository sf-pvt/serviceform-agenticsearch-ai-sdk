import { isFiltered, sameSearch } from '../client/query';
import type { AnswerLink, Chip, Hit, InstantResults, SearchState, SitePage, SortId, Suggestion } from '../client/types';
import type { SearchStatus } from '../core/types';
import { fieldLabel, valueLabel } from '../lib/i18n';
import { matchPages } from '../lib/pages';
import { createConnector } from './createConnector';

export { createConnector } from './createConnector';
export type { RenderOptions, RenderFn, Connector } from './createConnector';

/* ---------------------------------------------------------------- searchBox */

export interface SearchBoxState {
  query: string;
  /** Search for these words, keeping the filters (as you type). */
  refine(query: string): void;
  /** A new search from these words, and a question to the AI when it is on (Enter). */
  submit(query: string): void;
  clear(): void;
  isLoading: boolean;
}
export const connectSearchBox = createConnector<SearchBoxState, object>({
  type: 'sfas.searchBox',
  getState: ({ instance, state, status }) => ({
    query: state.q,
    refine: (query) => instance.setQuery(query),
    submit: (query) => instance.submit(query),
    clear: () => instance.submit(''),
    isLoading: status === 'loading',
  }),
});

/* --------------------------------------------------------------------- hits */

export interface HitsState {
  hits: Hit[];
  found: number;
  status: SearchStatus;
  /** True before the first results have arrived. */
  isFirstLoad: boolean;
  sendClick(hit: Hit, position: number): void;
}
export const connectHits = createConnector<HitsState, object>({
  type: 'sfas.hits',
  getState: ({ instance, results, status }) => ({
    hits: results ? results.hits : [],
    found: results ? results.found : 0,
    status,
    isFirstLoad: !results,
    sendClick: (hit, position) => instance.sendClick(hit, position),
  }),
});

export interface InfiniteHitsState extends HitsState {
  isLastPage: boolean;
  showMore(): void;
}
interface InfiniteLocal { of: SearchState | null; pages: Map<number, Hit[]> }
/** Hits that add up page after page until the search itself changes. */
export const connectInfiniteHits = createConnector<InfiniteHitsState, object, InfiniteLocal>({
  type: 'sfas.infiniteHits',
  local: () => ({ of: null, pages: new Map() }),
  getState: ({ instance, results, state, status }, _params, local) => {
    if (results && status !== 'loading') {
      if (!local.of || !sameSearch(local.of, state) || results.page === 1) local.pages = new Map();
      local.of = state;
      local.pages.set(results.page, results.hits);
    }
    const hits = [...local.pages.keys()].sort((a, b) => a - b).flatMap((page) => local.pages.get(page) || []);
    return {
      hits,
      found: results ? results.found : 0,
      status,
      isFirstLoad: !results,
      isLastPage: !results || !results.hasMore,
      showMore: () => instance.setPage(state.page + 1),
      sendClick: (hit, position) => instance.sendClick(hit, position),
    };
  },
});

/* ----------------------------------------------------------- refinementList */

export interface RefinementListConnectorParams {
  attribute: string;
  /** How many values to show before "show more". */
  limit?: number;
  showMoreLimit?: number;
}
export interface RefinementItem { value: string; label: string; count: number; isRefined: boolean }
export interface RefinementListState {
  attribute: string;
  label: string;
  items: RefinementItem[];
  refine(value: string): void;
  canRefine: boolean;
  isShowingMore: boolean;
  canToggleShowMore: boolean;
  toggleShowMore(): void;
  /** Narrows the listed values by what is typed. No request is made. */
  searchForItems(query: string): void;
}
export const connectRefinementList = createConnector<RefinementListState, RefinementListConnectorParams, { more: boolean; find: string }>({
  type: 'sfas.refinementList',
  local: () => ({ more: false, find: '' }),
  getState: ({ instance, results, state, strings, config }, params, local, rerender) => {
    const facet = results?.facets.find((f) => f.attribute === params.attribute);
    const refined = state.filters[params.attribute] || [];
    const language = config.language;
    const all: RefinementItem[] = (facet?.values || []).map((v) => ({ value: v.value, label: v.label || valueLabel(v.value, language), count: v.count, isRefined: refined.includes(v.value) }));
    // What is ticked stays listed even when the search no longer counts any.
    for (const value of refined) if (!all.some((i) => i.value === value)) all.unshift({ value, label: valueLabel(value, language), count: 0, isRefined: true });
    const find = local.find.trim().toLowerCase();
    const matching = find ? all.filter((i) => i.label.toLowerCase().includes(find) || i.value.toLowerCase().includes(find)) : all;
    const limit = params.limit ?? 8;
    const moreLimit = params.showMoreLimit ?? 250;
    const shown = local.more || find ? matching.slice(0, moreLimit) : [...matching.filter((i) => i.isRefined), ...matching.filter((i) => !i.isRefined)].slice(0, Math.max(limit, refined.length));
    return {
      attribute: params.attribute,
      label: fieldLabel(params.attribute, strings),
      items: shown,
      refine: (value) => instance.toggleRefinement(params.attribute, value),
      canRefine: all.length > 0,
      isShowingMore: local.more,
      canToggleShowMore: !find && matching.length > limit,
      toggleShowMore: () => { local.more = !local.more; rerender(); },
      searchForItems: (query) => { local.find = String(query || ''); rerender(); },
    };
  },
});

/* -------------------------------------------------------------------- range */

export interface RangeConnectorParams { attribute: string }
export interface RangeState {
  attribute: string;
  label: string;
  /** The lowest and highest value in the results, in display units. */
  range: { min: number; max: number };
  /** What is set, in display units. `null` is open. */
  start: [number | null, number | null];
  /** Sets the range, in display units. `null` on a side leaves it open. */
  refine(range: [number | null, number | null]): void;
  canRefine: boolean;
  format(value: number): string;
}
/**
 * A numeric range: `price`, `year`, `mileage`... Prices are handled in
 * currency units here whatever the index stores (cents or units).
 */
export const connectRange = createConnector<RangeState, RangeConnectorParams>({
  type: 'sfas.range',
  getState: ({ instance, results, state, strings, config }, params) => {
    const isPrice = params.attribute === 'price';
    const unit = isPrice && results?.priceCents ? 100 : 1;
    const stats = results?.ranges.find((r) => r.attribute === params.attribute);
    const set = isPrice ? { min: state.priceMin, max: state.priceMax } : state.ranges[params.attribute] || { min: null, max: null };
    const show = (v: number | null) => (v === null ? null : v / unit);
    const language = config.language;
    return {
      attribute: params.attribute,
      label: fieldLabel(params.attribute, strings),
      range: stats ? { min: Math.floor(stats.min / unit), max: Math.ceil(stats.max / unit) } : { min: 0, max: 0 },
      start: [show(set.min), show(set.max)],
      refine: ([min, max]) => instance.setRange(params.attribute, min === null ? null : Math.round(min * unit), max === null ? null : Math.round(max * unit)),
      canRefine: !!stats && stats.max > stats.min,
      format: (value) => {
        if (params.attribute === 'year') return String(value);
        let text: string;
        try { text = value.toLocaleString(language); } catch { text = String(value); }
        if (isPrice) {
          try { return new Intl.NumberFormat(language, { style: 'currency', currency: config.currency, maximumFractionDigits: 0 }).format(value); } catch { return text; }
        }
        return params.attribute === 'mileage' ? `${text} ${results?.mileageUnit || 'km'}` : text;
      },
    };
  },
});

/* ------------------------------------------------------------------- sortBy */

export interface SortByConnectorParams { items?: Array<{ value: SortId; label?: string }> }
export interface SortByState {
  options: Array<{ value: SortId; label: string }>;
  currentRefinement: SortId;
  refine(value: SortId): void;
  canRefine: boolean;
}
export const connectSortBy = createConnector<SortByState, SortByConnectorParams>({
  type: 'sfas.sortBy',
  getState: ({ instance, results, state, strings }, params) => {
    const available = results?.available || [];
    // Only orders the index can make: no "newest first" on a catalogue with no years.
    const ids: SortId[] = params.items?.map((i) => i.value) || [
      'relevance',
      ...(available.includes('price') || !results ? (['price_asc', 'price_desc'] as SortId[]) : []),
      ...(available.includes('year') ? (['year_desc', 'year_asc'] as SortId[]) : []),
      ...(available.includes('mileage') ? (['mileage_asc'] as SortId[]) : []),
    ];
    const named = new Map((params.items || []).map((i) => [i.value, i.label]));
    return {
      options: ids.map((value) => ({ value, label: named.get(value) || strings.sort[value] || value })),
      currentRefinement: state.sort,
      refine: (value) => instance.setSort(value),
      canRefine: !!results && results.found > 1,
    };
  },
});

/* ------------------------------------------------------- currentRefinements */

export interface CurrentRefinementsConnectorParams { /** Leave the sort order out of the list. */ excludeSort?: boolean }
export interface CurrentRefinementsState {
  /** What is applied, named for the visitor, each with its own remove. */
  items: Array<Chip & { refine(): void }>;
  canRefine: boolean;
  /** How many filters are on, not counting the order. */
  count: number;
}
export const connectCurrentRefinements = createConnector<CurrentRefinementsState, CurrentRefinementsConnectorParams>({
  type: 'sfas.currentRefinements',
  getState: ({ instance, results }, params) => {
    const chips = (results?.chips || []).filter((c) => !(params.excludeSort && c.key === 'sort'));
    return {
      items: chips.map((c) => ({ ...c, refine: () => instance.clearRefinement(c.key) })),
      canRefine: chips.length > 0,
      count: chips.filter((c) => c.key !== 'sort').length,
    };
  },
});

export interface ClearRefinementsState { canRefine: boolean; refine(): void }
export const connectClearRefinements = createConnector<ClearRefinementsState, { includeQuery?: boolean }>({
  type: 'sfas.clearRefinements',
  getState: ({ instance, state }, params) => ({
    canRefine: isFiltered(state) || (!!params.includeQuery && !!state.q),
    refine: () => instance.clearRefinements({ query: !!params.includeQuery }),
  }),
});

/* ------------------------------------------------------------ small widgets */

export interface StatsState { found: number; page: number; perPage: number; query: string; status: SearchStatus; text: string }
export const connectStats = createConnector<StatsState, object>({
  type: 'sfas.stats',
  getState: ({ results, state, status, strings, config }) => {
    const found = results?.found || 0;
    let n = String(found);
    try { n = found.toLocaleString(config.language); } catch { /* keep plain */ }
    return { found, page: state.page, perPage: results?.perPage || 0, query: state.q, status, text: !results ? '' : found === 1 ? strings.result : strings.results.replace('{n}', n) };
  },
});

export interface PaginationConnectorParams { /** How many page numbers to show around the current one. */ padding?: number }
export interface PaginationState { currentPage: number; nbPages: number; pages: number[]; isFirstPage: boolean; isLastPage: boolean; refine(page: number): void; canRefine: boolean }
export const connectPagination = createConnector<PaginationState, PaginationConnectorParams>({
  type: 'sfas.pagination',
  getState: ({ instance, results, state }, params) => {
    // The API serves the first fifty pages of a search.
    const nbPages = results && results.perPage ? Math.min(50, Math.ceil(results.found / results.perPage)) : 0;
    const padding = params.padding ?? 2;
    const first = Math.max(1, Math.min(state.page - padding, nbPages - padding * 2));
    const pages: number[] = [];
    for (let p = first; p <= Math.min(nbPages, first + padding * 2); p++) pages.push(p);
    return { currentPage: state.page, nbPages, pages, isFirstPage: state.page <= 1, isLastPage: state.page >= nbPages, refine: (page) => instance.setPage(Math.max(1, Math.min(nbPages || 1, page))), canRefine: nbPages > 1 };
  },
});

export interface ToggleInStockState { isRefined: boolean; refine(): void; label: string }
export const connectInStock = createConnector<ToggleInStockState, object>({
  type: 'sfas.inStock',
  getState: ({ instance, state, strings }) => ({ isRefined: state.inStock, refine: () => instance.setInStock(!state.inStock), label: strings.inStock }),
});

export interface NoteState { note: string; dropped: string }
/** What the search says when it had to give something up to find anything. */
export const connectNote = createConnector<NoteState, object>({
  type: 'sfas.note',
  getState: ({ results }) => ({ note: results?.note || '', dropped: results?.dropped || '' }),
});

/* ------------------------------------------------------------ dynamicFacets */

export interface DynamicFacetsConnectorParams { /** Filters to show, in order. Defaults to the tool's own list, then the index's. */ facets?: string[] }
export interface DynamicFacet { attribute: string; type: 'list' | 'range'; label: string; style: string }
export interface DynamicFacetsState { facets: DynamicFacet[]; show: boolean }
/** Which filters this catalogue has, in the order the tool's settings ask for. */
export const connectDynamicFacets = createConnector<DynamicFacetsState, DynamicFacetsConnectorParams>({
  type: 'sfas.dynamicFacets',
  getState: ({ results, strings, config }, params) => {
    const lists = new Set((results?.facets || []).map((f) => f.attribute));
    const ranges = new Set((results?.ranges || []).map((r) => r.attribute));
    const wanted = params.facets?.length ? params.facets : config.facets;
    const natural = [...(ranges.has('price') ? ['price'] : []), ...(results?.facets || []).map((f) => f.attribute), ...(results?.ranges || []).map((r) => r.attribute).filter((a) => a !== 'price')];
    const order = wanted.length ? wanted.filter((a) => lists.has(a) || ranges.has(a)) : natural;
    return {
      show: config.showFilters,
      facets: [...new Set(order)].map((attribute) => ({
        attribute,
        type: ranges.has(attribute) && !lists.has(attribute) ? 'range' : 'list',
        label: fieldLabel(attribute, strings),
        style: config.facetStyles[attribute] || 'list',
      })),
    };
  },
});

/* ------------------------------------------------------------- autocomplete */

export interface AutocompleteConnectorParams { /** Product hits to ask for (4 by default, 24 at most). */ limit?: number; /** Page hits to show. */ pageLimit?: number; /** Milliseconds to wait after a keystroke. */ debounce?: number }
export interface AutocompleteState {
  query: string;
  hits: Hit[];
  found: number;
  pages: SitePage[];
  suggestions: Suggestion[];
  chips: Chip[];
  note: string;
  status: 'idle' | 'loading';
  /** Looks up what was typed. Nothing else on the page is searched. */
  refine(query: string): void;
  sendClick(hit: Hit, position: number): void;
}
interface AutocompleteLocal { query: string; data: InstantResults | null; pages: SitePage[] | null; loading: boolean; seq: number; timer: ReturnType<typeof setTimeout> | null; cache: Map<string, InstantResults>; abort: AbortController | null }
/**
 * The instant dropdown under a search field: products from the keystroke
 * endpoint, the site's own pages matched in the browser, and what other
 * visitors searched for. Independent of the main results.
 */
export const connectAutocomplete = createConnector<AutocompleteState, AutocompleteConnectorParams, AutocompleteLocal>({
  type: 'sfas.autocomplete',
  local: () => ({ query: '', data: null, pages: null, loading: false, seq: 0, timer: null, cache: new Map(), abort: null }),
  getState: ({ instance, config }, params, local, rerender) => {
    const client = instance.client;
    const run = (q: string) => {
      const seq = ++local.seq;
      const key = q.toLowerCase();
      const cached = local.cache.get(key);
      if (cached) { local.data = cached; local.loading = false; rerender(); return; }
      local.loading = true;
      rerender();
      // A lookup nobody is waiting for any more is called off, so a slow
      // connection is not left answering every letter that was typed.
      local.abort?.abort();
      local.abort = typeof AbortController !== 'undefined' ? new AbortController() : null;
      client.search(q, { limit: params.limit, signal: local.abort?.signal }).then((data) => {
        local.cache.set(key, data);
        if (seq !== local.seq) return;
        local.data = data;
        local.loading = false;
        rerender();
      }).catch(() => { if (seq === local.seq) { local.loading = false; rerender(); } });
    };
    const refine = (query: string) => {
      const q = String(query || '').trim();
      local.query = q;
      if (local.timer) clearTimeout(local.timer);
      if (config.pageSearch && !local.pages) {
        local.pages = [];
        client.getPages().then((pages) => { local.pages = pages; rerender(); }).catch(() => {});
      }
      if (!q) { local.seq += 1; local.data = null; local.loading = false; rerender(); return; }
      if (config.productSearch === false) { rerender(); return; }
      local.timer = setTimeout(() => run(q), params.debounce ?? 120);
      rerender();
    };
    const fresh = local.data && local.data.query.toLowerCase() === local.query.toLowerCase() ? local.data : null;
    // The last answer stays up while the next one is on its way: no flicker between keystrokes.
    const shown = fresh || (local.loading ? local.data : null);
    return {
      query: local.query,
      hits: shown?.hits || [],
      found: shown?.found || 0,
      pages: config.pageSearch && local.query ? matchPages(local.query, local.pages || [], params.pageLimit ?? 4) : [],
      suggestions: shown?.suggestions || [],
      chips: fresh?.chips || [],
      note: fresh?.note || '',
      status: local.loading ? 'loading' : 'idle',
      refine,
      sendClick: (hit, position) => instance.sendClick(hit, position, local.query),
    };
  },
  dispose: (_context, _params, local) => { if (local.timer) clearTimeout(local.timer); local.abort?.abort(); local.seq += 1; },
});

/* ----------------------------------------------------------------------- AI */

export interface AiAnswerState {
  status: 'idle' | 'loading' | 'done' | 'error';
  question: string;
  answer: string;
  hits: Hit[];
  links: AnswerLink[];
  chips: Chip[];
  note: string;
  /** The EU AI Act notice, when the tool has it switched on. */
  disclaimer: string;
  /** Whether a conversation is under way (a follow-up will be read with what came before). */
  isContinuing: boolean;
  enabled: boolean;
  ask(question: string): void;
  reset(): void;
}
/** The AI's short answer to what was asked, with where it comes from. */
export const connectAiAnswer = createConnector<AiAnswerState, object>({
  type: 'sfas.aiAnswer',
  getState: ({ instance, ai, config }) => ({
    status: ai.status,
    question: ai.question,
    answer: ai.answer?.answer || '',
    hits: ai.answer?.hits || [],
    links: ai.answer?.links || [],
    chips: ai.answer?.chips || [],
    note: ai.answer?.note || '',
    disclaimer: config.aiDisclaimer,
    isContinuing: ai.history.length > 0,
    enabled: instance.aiEnabled(),
    ask: (question) => { void instance.ask(question); },
    reset: () => instance.resetConversation(),
  }),
});

export interface SuggestedQuestionsConnectorParams { /** Questions to offer instead of the tool's own. */ questions?: string[]; limit?: number }
export interface SuggestedQuestionsState { items: string[]; ask(question: string): void; enabled: boolean }
/** The example questions set on the tool, each asked with a click. */
export const connectSuggestedQuestions = createConnector<SuggestedQuestionsState, SuggestedQuestionsConnectorParams>({
  type: 'sfas.suggestedQuestions',
  getState: ({ instance, config }, params) => ({
    items: (params.questions?.length ? params.questions : config.questions).slice(0, params.limit ?? 6),
    ask: (question) => instance.submit(question, { ask: true }),
    enabled: instance.aiEnabled(),
  }),
});
