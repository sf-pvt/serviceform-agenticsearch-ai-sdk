import { defaultConfig, normalizeConfig } from '../client/config';
import { emptyState, isFiltered, normalizeState, sameSearch, stateToWire } from '../client/query';
import type { BrowseOptions, BrowseResults, Hit, SearchClient, SearchConfig, SearchState, SortId } from '../client/types';
import { stringsFor, type Strings } from '../lib/i18n';
import { Router, type RoutingOptions } from './routing';
import type { AiState, RenderContext, SearchStatus, Widget } from './types';

export interface AgenticSearchOptions {
  /** From `serviceformSearch('TOOL_ID')`. */
  searchClient: SearchClient;
  /** The search to open with. The address wins over it when routing is on. */
  initialState?: Partial<SearchState>;
  /** Keep the search in the page's address. */
  routing?: boolean | RoutingOptions;
  /** Write searches and clicks down for the dashboard's statistics. On by default. */
  insights?: boolean;
  /** Results per page (1 to 48). */
  perPage?: number;
  /** Which filters to ask for, in order. Empty: the tool's own setting. */
  facets?: string[];
  /** Feed fields to return on every hit under `fields`. */
  fields?: string[];
  /** Overrides the tool's language for labels and formatting. */
  language?: string;
  /** Ask the AI when a search is submitted (Enter). Follows the tool's setting by default. */
  ai?: boolean;
  /** Words to use instead of the built-in ones. */
  strings?: Partial<Strings>;
  /** Search as soon as `start()` is called. On by default. */
  searchOnStart?: boolean;
  /**
   * `false` for a field with a dropdown and no results of its own (a header
   * box): the faceted search is never run, and AI answers are shown without
   * being turned into filters.
   */
  results?: boolean;
}

type EventName = 'render' | 'results' | 'change' | 'error' | 'answer';
type Listener = (context: RenderContext) => void;
type StateInput = Partial<SearchState> | ((state: SearchState) => Partial<SearchState>);

const SETTLED_MS = 1500;
const newAi = (): AiState => ({ status: 'idle', question: '', answer: null, history: [] });

/** Whether one reading of a question has a filter, a range or a kind the other has not. */
function addsTo(theirs: SearchState, ours: SearchState): boolean {
  for (const field of Object.keys(theirs.filters)) if (theirs.filters[field].length && !(ours.filters[field] || []).length) return true;
  for (const field of Object.keys(theirs.ranges)) if (!ours.ranges[field]) return true;
  if ((theirs.priceMin !== null || theirs.priceMax !== null) && ours.priceMin === null && ours.priceMax === null) return true;
  return !!theirs.kind && !ours.kind;
}

/**
 * One search on a page: its state, its results, and the widgets drawn from
 * them. Widgets are added, the search is started, and from then on every
 * change (typing, a ticked filter, the address) searches again and redraws.
 */
export class AgenticSearch {
  readonly client: SearchClient;
  state: SearchState;
  results: BrowseResults | null = null;
  status: SearchStatus = 'idle';
  error: Error | null = null;
  config: SearchConfig;
  strings: Strings;
  ai: AiState = newAi();
  started = false;

  private options: AgenticSearchOptions;
  private widgets: Widget[] = [];
  private router: Router | null = null;
  private listeners: Partial<Record<EventName, Listener[]>> = {};
  private searchSeq = 0;
  private askSeq = 0;
  private pending = false;
  private abort: AbortController | null = null;
  private trackTimer: ReturnType<typeof setTimeout> | null = null;
  private tracked = new Set<string>();
  private askedFor = '';
  private lastRawAdopt: unknown = null;
  private lastFilters: Record<string, unknown> | null = null;
  private offConfig: () => void = () => {};

  constructor(options: AgenticSearchOptions) {
    if (!options || !options.searchClient) throw new Error('agenticsearch: searchClient is required');
    this.options = options;
    this.client = options.searchClient;
    this.state = normalizeState(options.initialState);
    this.config = this.client.peekConfig() || defaultConfig(this.client.toolId);
    this.strings = this.makeStrings();
    if (options.routing && typeof window !== 'undefined') this.router = new Router(options.routing === true ? {} : options.routing);
  }

  /* ------------------------------------------------------------- widgets -- */

  addWidgets(widgets: Widget[]): this {
    for (const widget of widgets) {
      this.widgets.push(widget);
      if (this.started) {
        widget.init?.(this.context());
        widget.render?.(this.context());
      }
    }
    return this;
  }

  removeWidgets(widgets: Widget[]): this {
    for (const widget of widgets) {
      const at = this.widgets.indexOf(widget);
      if (at === -1) continue;
      this.widgets.splice(at, 1);
      if (this.started) widget.dispose?.(this.context());
    }
    return this;
  }

  start(): this {
    if (this.started) return this;
    this.started = true;
    if (this.router) {
      const fromUrl = this.router.read();
      if (fromUrl.q || isFiltered(fromUrl) || fromUrl.sort !== 'relevance' || fromUrl.page > 1) this.state = fromUrl;
      this.router.listen((state) => this.setState(state, { route: false, resetPage: false }));
    }
    const context = this.context();
    for (const widget of this.widgets) widget.init?.(context);
    this.offConfig = this.client.onConfig((config) => this.setConfig(config));
    this.client.getConfig().then((config) => this.setConfig(config)).catch(() => {});
    if (this.options.searchOnStart !== false) this.search();
    else this.render();
    return this;
  }

  dispose(): void {
    const context = this.context();
    for (const widget of this.widgets) widget.dispose?.(context);
    this.widgets = [];
    this.router?.dispose();
    this.offConfig();
    this.abort?.abort();
    if (this.trackTimer) clearTimeout(this.trackTimer);
    this.flushSearchEvent();
    this.started = false;
  }

  on(event: EventName, listener: Listener): () => void {
    (this.listeners[event] = this.listeners[event] || []).push(listener);
    return () => { this.listeners[event] = (this.listeners[event] || []).filter((l) => l !== listener); };
  }

  /* --------------------------------------------------------------- state -- */

  /**
   * Changes the search and runs it. Any change but the page number goes
   * back to the first page.
   */
  setState(input: StateInput, how: { search?: boolean; resetPage?: boolean; route?: boolean } = {}): void {
    const patch = typeof input === 'function' ? input(this.state) : input;
    const next = normalizeState({ ...this.state, ...patch });
    if (how.resetPage !== false && !('page' in patch)) next.page = 1;
    this.state = next;
    if (how.route !== false) this.router?.write(next);
    this.emit('change');
    if (how.search === false) this.render();
    else this.search();
  }

  setQuery(query: string): void { this.setState({ q: query }); }

  /** A new search from the words alone, as when Enter is pressed: filters read from older words go. */
  submit(query: string, how: { ask?: boolean } = {}): void {
    const q = String(query || '').trim();
    this.setState({ ...emptyState(), q });
    const wantsAi = how.ask !== undefined ? how.ask : this.aiEnabled();
    if (wantsAi && q) this.ask(q);
    else if (!q) this.resetConversation();
  }

  toggleRefinement(attribute: string, value: string): void {
    const current = this.state.filters[attribute] || [];
    const values = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    this.setRefinements(attribute, values);
  }

  setRefinements(attribute: string, values: string[]): void {
    const filters = { ...this.state.filters };
    if (values.length) filters[attribute] = values;
    else delete filters[attribute];
    this.setState({ filters });
  }

  /** A numeric range. `price` is given in the index's own unit. Both `null` clears it. */
  setRange(attribute: string, min: number | null, max: number | null): void {
    if (attribute === 'price') { this.setState({ priceMin: min, priceMax: max }); return; }
    const ranges = { ...this.state.ranges };
    if (min === null && max === null) delete ranges[attribute];
    else ranges[attribute] = { min, max };
    this.setState({ ranges });
  }

  setSort(sort: SortId): void { this.setState({ sort }); }
  setPage(page: number): void { this.setState({ page }, { resetPage: false }); }
  setInStock(on: boolean): void { this.setState({ inStock: on }); }

  /** Takes off what a chip stands for: a filter, a range, the price, the order, a kind or a searched word. */
  clearRefinement(key: string): void {
    const s = this.state;
    const filters: Record<string, string[]> = {};
    for (const f of Object.keys(s.filters)) if (f !== key) filters[f] = s.filters[f];
    const ranges: SearchState['ranges'] = {};
    for (const f of Object.keys(s.ranges)) if (f !== key) ranges[f] = s.ranges[f];
    const patch: Partial<SearchState> = { filters, ranges };
    if (key === 'price') { patch.priceMin = null; patch.priceMax = null; }
    if (key === 'sort') patch.sort = 'relevance';
    if (key === 'kind') patch.kind = '';
    if (key === 'in_stock') patch.inStock = false;
    if (key.startsWith('q:')) {
      const words = ` ${s.q.split(/\s+/).join(' ')} `;
      const at = words.toLowerCase().indexOf(` ${key.slice(2).toLowerCase()} `);
      if (at >= 0) patch.q = (words.slice(0, at) + words.slice(at + key.length - 1)).trim();
    }
    this.setState(patch);
  }

  /** Every filter off. The words stay unless `query` is true. */
  clearRefinements(how: { query?: boolean } = {}): void {
    this.setState({ ...emptyState(), q: how.query ? '' : this.state.q, sort: this.state.sort });
  }

  /** Searches again with what is set. */
  refresh(): void { this.search(); }

  /* -------------------------------------------------------------- search -- */

  private browseOptions(): BrowseOptions {
    const o = this.options;
    return {
      perPage: Math.max(1, Math.min(48, o.perPage || 24)),
      ...(o.facets?.length ? { facets: o.facets } : {}),
      ...(o.fields?.length ? { fields: o.fields } : {}),
      ...(o.language ? { language: o.language } : {}),
    };
  }

  private search(): void {
    if (this.options.results === false) { this.status = 'idle'; this.render(); return; }
    // One search for however many changes were made in the same tick.
    if (this.pending) return;
    this.pending = true;
    this.status = 'loading';
    this.render();
    Promise.resolve().then(() => this.runSearch());
  }

  private runSearch(): void {
    this.pending = false;
    const seq = ++this.searchSeq;
    const asked = this.state;
    this.abort?.abort();
    this.abort = typeof AbortController !== 'undefined' ? new AbortController() : null;
    this.client.browse(asked, { ...this.browseOptions(), signal: this.abort?.signal }).then((results) => {
      if (seq !== this.searchSeq) return;
      this.results = results;
      this.status = 'idle';
      this.error = null;
      // The server folds the words into filters ("red volvo under 30k" is
      // a colour, a price and the word volvo): its state is now the state.
      if (results.state && sameSearch(asked, this.state)) {
        this.state = { ...results.state, page: asked.page };
        this.router?.write(this.state);
      }
      this.emit('results');
      this.render();
      this.noteSearch();
    }).catch((error) => {
      if (seq !== this.searchSeq || error?.name === 'AbortError') return;
      this.status = 'error';
      this.error = error instanceof Error ? error : new Error(String(error));
      this.emit('error');
      this.render();
    });
  }

  /* ------------------------------------------------------------------ AI -- */

  aiEnabled(): boolean {
    return this.options.ai !== undefined ? this.options.ai : this.config.ai;
  }

  /**
   * Asks the AI about the catalogue or the site. The answer arrives in
   * `ai`, and where the AI read more into the question than the search
   * did, the search takes its reading on.
   */
  ask(question: string): Promise<void> {
    const q = String(question || '').trim();
    if (!q) return Promise.resolve();
    const seq = ++this.askSeq;
    const continued = this.ai.history.length > 0;
    this.askedFor = q;
    this.ai = { ...this.ai, status: 'loading', question: q, answer: null };
    this.render();
    return this.client.ask(q, {
      history: this.ai.history,
      ...(continued && this.lastRawAdopt ? { previous: this.lastRawAdopt } : {}),
      ...(continued && this.lastFilters ? { previousFilters: this.lastFilters } : {}),
    }).then((answer) => {
      if (seq !== this.askSeq) return;
      if (!answer.answer) { this.ai = { ...this.ai, status: 'idle', answer: null }; this.render(); return; }
      const history = [...this.ai.history, { role: 'user' as const, content: q }, { role: 'assistant' as const, content: answer.answer }].slice(-8);
      this.ai = { status: 'done', question: q, answer, history };
      this.lastRawAdopt = answer.rawAdopt;
      this.lastFilters = Object.keys(answer.filters).length ? answer.filters : null;
      this.emit('answer');
      this.render();
      if (!answer.adopt || this.options.results === false) return;
      // A follow-up's words are only what changed ("red"), so the AI's
      // reading, which has what was asked before in it, is the search.
      const more = addsTo(answer.adopt, this.state);
      if (continued || more || (!this.results?.read && !isFiltered(this.state))) {
        this.setState({ ...answer.adopt, page: 1 });
      }
    }).catch(() => {
      if (seq !== this.askSeq) return;
      this.ai = { ...this.ai, status: 'error', answer: null };
      this.render();
    });
  }

  /** Forgets the conversation. The search itself is left as it is. */
  resetConversation(): void {
    this.askSeq += 1;
    this.ai = newAi();
    this.askedFor = '';
    this.lastRawAdopt = null;
    this.lastFilters = null;
    this.render();
  }

  /** The current state as the API spells it, for anyone calling the API beside the widgets. */
  wireState(): Record<string, unknown> { return stateToWire(this.state); }

  /* ------------------------------------------------------------ insights -- */

  private noteSearch(): void {
    if (this.options.insights === false) return;
    if (this.trackTimer) clearTimeout(this.trackTimer);
    this.trackTimer = setTimeout(() => this.flushSearchEvent(), SETTLED_MS);
  }

  private flushSearchEvent(): void {
    if (this.trackTimer) clearTimeout(this.trackTimer);
    this.trackTimer = null;
    const s = this.state;
    if (this.options.insights === false || !this.results) return;
    // Not the page as it opens with nothing asked; not the words the AI's own record already has.
    if ((!s.q && !isFiltered(s)) || (s.q && s.q === this.askedFor)) return;
    const filters: Record<string, unknown> = { ...s.filters };
    for (const [field, r] of Object.entries(s.ranges)) filters[field] = [r.min, r.max];
    const event = {
      query: s.q,
      searchType: 'instant',
      filters,
      priceRange: { min: s.priceMin, max: s.priceMax },
      sortBy: s.sort === 'relevance' ? 'default' : s.sort,
      resultsCount: this.results.found,
      searchDuration: 0,
    };
    const key = JSON.stringify([event.query.toLowerCase(), event.filters, event.priceRange, event.sortBy]);
    if (this.tracked.has(key)) return;
    this.tracked.add(key);
    this.client.track('search', event);
    for (const [field, values] of Object.entries(s.filters)) {
      if (values.length) this.client.track('filter_usage', { searchQuery: s.q, filterField: field, filterValues: values });
    }
  }

  /** Call when a visitor opens a result, so the dashboard can say which searches sell. */
  sendClick(hit: Hit, position: number, query?: string): void {
    if (this.options.insights === false) return;
    this.flushSearchEvent();
    this.client.track('click', {
      searchQuery: String(query ?? this.state.q).trim(),
      resultId: String(hit.id || hit.url || hit.title || ''),
      resultPosition: Math.max(0, Number(position) || 0),
      resultTitle: hit.title,
      resultPrice: Math.round(Number(hit.priceValue) || 0),
    });
  }

  /* -------------------------------------------------------------- drawing -- */

  private makeStrings(): Strings {
    const language = this.options.language || this.config.language;
    return stringsFor(language, { ...(this.config.labels as Partial<Strings>), ...(this.options.strings || {}) }, this.config.facetLabels);
  }

  /** Settings arrived or changed: labels, language and anything drawn from them follow. */
  setConfig(config: Partial<SearchConfig>): void {
    const next = normalizeConfig(this.client.toolId, { ...this.config, ...config });
    if (JSON.stringify(next) === JSON.stringify(this.config)) return;
    this.config = next;
    this.strings = this.makeStrings();
    this.render();
  }

  context(): RenderContext {
    return { instance: this, state: this.state, results: this.results, status: this.status, error: this.error, config: this.config, strings: this.strings, ai: this.ai };
  }

  private emit(event: EventName): void {
    const listeners = this.listeners[event];
    if (!listeners?.length) return;
    const context = this.context();
    for (const listener of listeners.slice()) listener(context);
  }

  render(): void {
    if (!this.started) return;
    const context = this.context();
    for (const widget of this.widgets.slice()) widget.render?.(context);
    this.emit('render');
  }
}

/**
 * ```js
 * const search = agenticsearch({ searchClient: serviceformSearch('TOOL_ID'), routing: true });
 * search.addWidgets([searchBox({ container: '#q' }), hits({ container: '#hits' })]);
 * search.start();
 * ```
 */
export function agenticsearch(options: AgenticSearchOptions): AgenticSearch {
  return new AgenticSearch(options);
}
