/** A numeric range. `null` on either side means open. */
export interface Range { min: number | null; max: number | null }

/**
 * Everything that decides what a search returns. The same shape the
 * Serviceform API hands back as the state it settled on.
 */
export interface SearchState {
  /** The words searched for. */
  q: string;
  /** Ticked facet values, by attribute. `not_<attribute>` holds what is left out. */
  filters: Record<string, string[]>;
  /** Numeric ranges by attribute (year, mileage, seats...). Price has its own two fields. */
  ranges: Record<string, Range>;
  /** Price bounds in the index's own unit (cents when `priceCents` is true). */
  priceMin: number | null;
  priceMax: number | null;
  sort: SortId;
  inStock: boolean;
  /** A kind of product the catalogue was sorted into ("small", "family"). */
  kind: string;
  page: number;
}

export type SortId = 'relevance' | 'price_asc' | 'price_desc' | 'year_desc' | 'year_asc' | 'mileage_asc' | 'newest' | 'name_asc';

/** One product, listing or car. */
export interface Hit {
  id?: string;
  title: string;
  year?: number;
  /** A short line of details ("Volvo · SUV · 42 000 km"). */
  meta?: string;
  location?: string;
  /** The price as text, formatted for the tool's language and currency. */
  price: string;
  /** A monthly price as text, when the feed has one. */
  monthly: string;
  url: string;
  image: string;
  brand?: string;
  /** The price as a number in the index's own unit. */
  priceValue?: number;
  outOfStock: boolean;
  /** The feed's own fields, when asked for by name with `fields`. */
  fields?: Record<string, unknown>;
}

export interface FacetValue { value: string; count: number; label?: string }
export interface Facet { attribute: string; values: FacetValue[] }
export interface RangeStats { attribute: string; min: number; max: number }

/** One applied part of the search, named for the visitor. */
export interface Chip { key: string; label: string }

export interface BrowseResults {
  query: string;
  page: number;
  perPage: number;
  found: number;
  hasMore: boolean;
  sort: SortId;
  hits: Hit[];
  facets: Facet[];
  /** Min and max of each numeric attribute in the result set, `price` included. */
  ranges: RangeStats[];
  /** Every filter the index can offer, in its default order. */
  available: string[];
  priceCents: boolean;
  mileageUnit: string;
  /** The state the server settled on after reading the words. Adopt it. */
  state: SearchState | null;
  /** Whether the words were read into filters. */
  read: boolean;
  chips: Chip[];
  /** Said when the search gave something up to find anything. */
  note: string;
  dropped: string;
}

export interface Suggestion { text: string; /** Where the completion starts. */ boldFrom: number }

export interface InstantResults {
  query: string;
  hits: Hit[];
  found: number;
  suggestions: Suggestion[];
  chips: Chip[];
  note: string;
}

export interface AnswerLink { label: string; url: string }

export interface Answer {
  answer: string;
  intent: 'catalogue' | 'general' | 'unconfigured' | 'error' | string;
  hits: Hit[];
  links: AnswerLink[];
  chips: Chip[];
  /** The helper's reading as search state, for a results page to take on. */
  adopt: SearchState | null;
  /** The raw filters, to send back as `previousFilters` with a follow-up. */
  filters: Record<string, unknown>;
  rawAdopt: unknown;
  note: string;
  language: string;
  continued: boolean;
  error?: string;
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export interface AskOptions {
  history?: ChatTurn[];
  previous?: unknown;
  previousFilters?: Record<string, unknown>;
  shown?: { pages?: unknown[]; products?: unknown[] };
  pageUrl?: string;
  signal?: AbortSignal;
}

export interface BrowseOptions {
  perPage?: number;
  /** Which filters to return, in order. Empty means the tool's own setting. */
  facets?: string[];
  language?: string;
  /** Feed fields to return on each hit under `fields`. */
  fields?: string[];
  signal?: AbortSignal;
}

export interface SitePage { label: string; url: string; keywords: string }

/** The tool's settings, as saved in the Serviceform dashboard. */
export interface SearchConfig {
  v: number;
  toolId: string;
  language: string;
  currency: string;
  priceCents: boolean;
  industry: string;
  layout: 'section' | 'box' | 'page' | 'modal';
  accent: string;
  radius: number;
  ai: boolean;
  aiDisclaimer: string;
  placeholders: string[];
  questions: string[];
  labels: Record<string, string>;
  showFilters: boolean;
  facets: string[];
  facetStyles: Record<string, string>;
  facetLabels: Record<string, string>;
  card: unknown;
  searchPageHref: string;
  searchPageParam: string;
  contactHref: string;
  assistantAvatar: string;
  fallbackImage: string;
  productSearch: boolean;
  pageSearch: boolean;
  popularSearches: boolean;
  pagesCount: number;
}

export type TrackType = 'search' | 'click' | 'filter_usage';

export interface ClientOptions {
  /** Where the Serviceform API lives. */
  apiBase?: string;
  /** A fetch to use instead of the global one (tests, Node before 18, a proxy). */
  fetch?: typeof fetch;
  /** Settings to start from, so nothing is fetched before the first render. */
  config?: Partial<SearchConfig>;
  /** Where settings are remembered between visits. `false` turns it off. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | false;
  /** How long remembered settings count as fresh, in seconds. */
  configMaxAge?: number;
  /** Marks requests as a test: nothing is logged or counted. */
  testMode?: boolean;
  /** A stable id for this visitor's session. Made up when left out. */
  sessionId?: string;
}

export interface SearchClient {
  readonly toolId: string;
  readonly apiBase: string;
  readonly sessionId: string;
  /** Keystroke search: a handful of hits and suggestions, no facets. */
  search(query: string, options?: { limit?: number; signal?: AbortSignal }): Promise<InstantResults>;
  /** Faceted search: hits, facets, ranges, chips and the state settled on. */
  browse(state?: Partial<SearchState>, options?: BrowseOptions): Promise<BrowseResults>;
  /** One short AI answer with the products it is about. */
  ask(question: string, options?: AskOptions): Promise<Answer>;
  /** The tool's settings: remembered ones at once, refreshed behind. */
  getConfig(options?: { fresh?: boolean }): Promise<SearchConfig>;
  /** Settings already at hand without a request, if any. */
  peekConfig(): SearchConfig | null;
  /** Called when fresher settings arrive behind remembered ones. Returns an unsubscribe. */
  onConfig(listener: (config: SearchConfig) => void): () => void;
  /** The site's own pages, for page hits that need no round trip. */
  getPages(): Promise<SitePage[]>;
  /** Writes down a search, a click or a filter. Best effort, never throws. */
  track(type: TrackType, data: Record<string, unknown>): void;
}
