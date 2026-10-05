import { DEFAULT_API_BASE, SDK_TAG } from '../version';
import { configFromToolDoc, defaultConfig, defaultStorage, normalizeConfig, readInlineConfig, readStored, writeStored } from './config';
import { encodePairs, normalizeState, stateToPairs } from './query';
import type { AskOptions, BrowseOptions, ClientOptions, SearchClient, SearchConfig, SearchState, SitePage, TrackType } from './types';
import { answerFromWire, browseFromWire, instantFromWire, pagesFromWire } from './wire';

export * from './types';
export { emptyState, normalizeState, stateToQuery, stateToPairs, queryToState, isStateKey, isFiltered, sameSearch, stateFromWire, stateToWire, SORTS } from './query';
export { normalizeConfig, configFromToolDoc, defaultConfig, readInlineConfig } from './config';
export { hitFromWire, safeUrl } from './wire';

const TOOL_ID = /^[A-Za-z0-9_-]{1,128}$/;

export class AgenticSearchError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = 'AgenticSearchError';
    this.status = status;
  }
}

const newSessionId = () => `sfas_${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36)}`;

/** The pixel's ids when the Serviceform pixel is on the page, so a sale can be traced to its search. Read, never written. */
function pixelIds(): Record<string, string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return {};
  const cookie = (name: string) => {
    try {
      const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
      return m ? decodeURIComponent(m[1]) : '';
    } catch { return ''; }
  };
  const sf = (window as any).sfV3 || {};
  const ids: Record<string, string> = {};
  const session = (typeof sf.sid === 'string' && sf.sid) || cookie('sf-pxs');
  const device = cookie('sf-did');
  const pixel = (typeof sf.pid === 'string' && sf.pid) || (window as any).sf3pid;
  if (session) ids.pixelSession = session;
  if (device) ids.deviceId = device;
  if (pixel) ids.pixelId = String(pixel);
  return ids;
}

/**
 * A client for one Serviceform search tool.
 *
 * ```js
 * const client = serviceformSearch('TOOL_ID');
 * const { hits, facets } = await client.browse({ q: 'red volvo under 30k' });
 * ```
 */
export function serviceformSearch(toolId: string, options: ClientOptions = {}): SearchClient {
  if (!TOOL_ID.test(String(toolId || ''))) throw new AgenticSearchError('serviceformSearch: a valid tool id is required');
  const apiBase = String(options.apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
  const doFetch: typeof fetch = options.fetch || ((...args) => fetch(...args));
  const store = options.storage === false ? null : options.storage || defaultStorage();
  const maxAge = (options.configMaxAge ?? 300) * 1000;
  const sessionId = options.sessionId || newSessionId();
  const id = encodeURIComponent(toolId);

  let config: SearchConfig | null = options.config ? normalizeConfig(toolId, options.config) : readInlineConfig(toolId);
  // Settings given in code or written into the page by a plugin are as fresh
  // as the page itself: the server that rendered them decides when to renew.
  let configAt = config ? Date.now() : 0;
  let configRequest: Promise<SearchConfig> | null = null;
  let pagesRequest: Promise<SitePage[]> | null = null;
  const configListeners: Array<(config: SearchConfig) => void> = [];
  // Set once a server answers 404 for the settings endpoint: older servers only have the whole tool document.
  let legacy = false;
  let legacyDoc: any = null;

  const getJson = async (url: string, init?: RequestInit) => {
    const res = await doFetch(url, { credentials: 'omit', ...init });
    if (!res.ok) throw new AgenticSearchError(`Request failed: ${res.status}`, res.status);
    return res.json();
  };
  const withSdk = (qs: string) => `${qs ? `${qs}&` : ''}sdk=${encodeURIComponent(SDK_TAG)}`;

  const fetchLegacyDoc = async () => {
    legacyDoc = legacyDoc || (await getJson(`${apiBase}/api/public/tid/${id}`));
    return legacyDoc;
  };

  // A plain GET on purpose: the browser's own cache revalidates with the
  // server's ETag by itself, and a hand-set If-None-Match would cost a
  // cross-origin preflight on every visit.
  const fetchConfig = async (): Promise<SearchConfig> => {
    let next: SearchConfig | null = null;
    if (!legacy) {
      // A server without this endpoint answers 404, and from another origin
      // the browser may not even show that: a "not found" page carries no
      // CORS headers, so the request simply fails. Either way the settings
      // are then read from the whole tool document instead.
      let res: Response | null = null;
      try {
        res = await doFetch(`${apiBase}/api/public/omnibox/config/${id}?${withSdk('')}`, { credentials: 'omit' });
      } catch { legacy = true; }
      if (res) {
        if (res.ok) next = normalizeConfig(toolId, await res.json());
        else if (res.status === 404) legacy = true;
        else throw new AgenticSearchError(`Settings request failed: ${res.status}`, res.status);
      }
    }
    if (!next) {
      next = configFromToolDoc(toolId, await fetchLegacyDoc());
      if (!next) throw new AgenticSearchError('Not a search tool', 404);
    }
    const changed = !config || JSON.stringify(config) !== JSON.stringify(next);
    config = next;
    configAt = Date.now();
    writeStored(store, toolId, apiBase, { config: next, at: configAt });
    if (changed) for (const listener of configListeners.slice()) listener(next);
    return next;
  };

  const refreshConfig = () => {
    if (!configRequest) {
      configRequest = fetchConfig().finally(() => { configRequest = null; });
    }
    return configRequest;
  };

  const client: SearchClient = {
    toolId,
    apiBase,
    sessionId,

    async search(query, opts = {}) {
      const q = String(query || '').trim().slice(0, 120);
      if (!q) return instantFromWire({}, '');
      const qs = withSdk(encodePairs([['q', q], ...(opts.limit ? ([['limit', String(opts.limit)]] as Array<[string, string]>) : [])]));
      return instantFromWire(await getJson(`${apiBase}/api/public/omnibox/search/${id}?${qs}`, { signal: opts.signal }), q);
    },

    async browse(state: Partial<SearchState> = {}, opts: BrowseOptions = {}) {
      const s = normalizeState(state);
      const pairs = stateToPairs(s);
      if (opts.perPage) pairs.push(['per_page', String(opts.perPage)]);
      if (opts.facets?.length) pairs.push(['facets', opts.facets.join(',')]);
      if (opts.language) pairs.push(['lang', opts.language]);
      if (opts.fields?.length) pairs.push(['fields', opts.fields.join(',')]);
      return browseFromWire(await getJson(`${apiBase}/api/public/omnibox/browse/${id}?${withSdk(encodePairs(pairs))}`, { signal: opts.signal }), s.page);
    },

    async ask(question, opts: AskOptions = {}) {
      const q = String(question || '').trim();
      if (!q) throw new AgenticSearchError('ask: a question is required');
      const body: Record<string, unknown> = { q, userId: sessionId, sdk: SDK_TAG, ...pixelIds() };
      if (opts.history?.length) body.history = opts.history.slice(-8);
      if (opts.previous) body.previous = opts.previous;
      if (opts.previousFilters) body.previousFilters = opts.previousFilters;
      if (opts.shown) body.shown = opts.shown;
      if (options.testMode) body.testMode = true;
      body.pageUrl = opts.pageUrl || (typeof window !== 'undefined' && window.location ? window.location.origin + window.location.pathname : '');
      return answerFromWire(await getJson(`${apiBase}/api/public/omnibox/ask/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: opts.signal,
      }));
    },

    peekConfig() {
      if (config) return config;
      const stored = readStored(store, toolId, apiBase);
      return stored ? stored.config : null;
    },

    async getConfig(opts = {}) {
      if (opts.fresh) return refreshConfig();
      // Given in code or written into the page: use it now, check for changes behind.
      if (config) {
        if (Date.now() - configAt >= maxAge) { configAt = Date.now(); refreshConfig().catch(() => {}); }
        return config;
      }
      const stored = readStored(store, toolId, apiBase);
      if (stored) {
        config = stored.config;
        configAt = stored.at;
        if (Date.now() - stored.at >= maxAge) refreshConfig().catch(() => {});
        return stored.config;
      }
      try { return await refreshConfig(); } catch (error) {
        // A site's search must not die with its settings: the defaults still search.
        if (error instanceof AgenticSearchError && error.status === 404) throw error;
        return defaultConfig(toolId);
      }
    },

    onConfig(listener) {
      configListeners.push(listener);
      return () => { const at = configListeners.indexOf(listener); if (at >= 0) configListeners.splice(at, 1); };
    },

    getPages() {
      if (!pagesRequest) {
        pagesRequest = (async () => {
          if (!legacy) {
            try {
              const body = await getJson(`${apiBase}/api/public/omnibox/config/${id}?${withSdk('part=pages')}`);
              return pagesFromWire(body?.pages);
            } catch (error) {
              // 404, or a request the browser would not let through (see fetchConfig): try the tool document.
              if (error instanceof AgenticSearchError && error.status !== 404) return [];
              legacy = true;
            }
          }
          try { return pagesFromWire((await fetchLegacyDoc())?.searchbox?.pages); } catch { return []; }
        })();
      }
      return pagesRequest;
    },

    track(type: TrackType, data) {
      if (options.testMode) return;
      const payload: Record<string, unknown> = { ...data, toolId, sessionId, ...pixelIds() };
      try { payload.pageUrl = String(window.location.href).slice(0, 500); } catch { /* not in a browser */ }
      try {
        // keepalive: a click that leaves the page is still written down.
        doFetch(`${apiBase}/api/analytics/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'omit',
          keepalive: true,
          body: JSON.stringify({ type, data: payload }),
        }).catch(() => {});
      } catch { /* best effort */ }
    },
  };
  return client;
}
