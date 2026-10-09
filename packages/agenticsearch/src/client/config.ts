import type { SearchConfig } from './types';

const LAYOUTS = ['section', 'box', 'page', 'modal'];
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v ? v : fallback);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : []);
const record = (v: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, val] of Object.entries(v as object)) if (typeof val === 'string' && val) out[k] = val;
  }
  return out;
};

export function defaultConfig(toolId: string): SearchConfig {
  return {
    v: 1, toolId, language: 'en', currency: 'EUR', priceCents: false, industry: '', layout: 'section', accent: '#d61920', radius: 18,
    ai: true, aiDisclaimer: '', placeholders: [], questions: [], labels: {}, showFilters: true, facets: [], facetStyles: {}, facetLabels: {},
    card: null, searchPageHref: '', searchPageParam: 'q', contactHref: '', assistantAvatar: '', fallbackImage: '',
    productSearch: true, pageSearch: true, popularSearches: false, pagesCount: 0,
    openInNewTab: true, emptyButton: null,
  };
}

/** The site's own element the "nothing found" button clicks unless the tool names another: the Mira chat bubble. */
export const DEFAULT_EMPTY_TARGET = '.sf-bubble-wrapper';

/** The extra button, from the settings' object or from the flat keys of a tool document. */
function emptyButton(c: Record<string, any>): SearchConfig['emptyButton'] {
  const v = c.emptyButton;
  if (v && typeof v === 'object') return { label: str(v.label), selector: str(v.selector, DEFAULT_EMPTY_TARGET) };
  if (v === true) return { label: str(c.emptyButtonLabel), selector: str(c.emptyButtonSelector, DEFAULT_EMPTY_TARGET) };
  return null;
}

/** Settings from wherever they came (the API, a plugin's inline JSON, code), made whole and typed. */
export function normalizeConfig(toolId: string, input: unknown): SearchConfig {
  const base = defaultConfig(toolId);
  const c = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  const radius = Number(c.radius);
  return {
    ...base,
    language: str(c.language, base.language).slice(0, 2).toLowerCase(),
    currency: str(c.currency, base.currency),
    priceCents: !!c.priceCents,
    industry: str(c.industry),
    layout: (LAYOUTS.includes(c.layout) ? c.layout : base.layout) as SearchConfig['layout'],
    accent: str(c.accent, base.accent),
    radius: Number.isFinite(radius) && c.radius != null ? Math.max(0, Math.min(28, radius)) : base.radius,
    ai: c.ai !== false,
    aiDisclaimer: str(c.aiDisclaimer),
    placeholders: strings(c.placeholders),
    questions: strings(c.questions),
    labels: record(c.labels),
    showFilters: c.showFilters !== false,
    facets: strings(c.facets),
    facetStyles: record(c.facetStyles),
    facetLabels: record(c.facetLabels),
    card: c.card ?? null,
    searchPageHref: str(c.searchPageHref),
    searchPageParam: str(c.searchPageParam, 'q'),
    contactHref: str(c.contactHref),
    assistantAvatar: str(c.assistantAvatar),
    fallbackImage: str(c.fallbackImage),
    productSearch: c.productSearch !== false,
    pageSearch: c.pageSearch !== false,
    popularSearches: c.popularSearches === true,
    pagesCount: Math.max(0, Number(c.pagesCount) || 0),
    openInNewTab: c.openInNewTab !== false,
    emptyButton: emptyButton(c),
  };
}

const without = (items: unknown, hidden: unknown): string[] => {
  const off = new Set(strings(hidden));
  return strings(items).filter((x) => !off.has(x));
};

/**
 * Settings read out of a whole tool document (`/api/public/tid/<id>`), for
 * servers that do not have the settings endpoint yet.
 */
export function configFromToolDoc(toolId: string, doc: unknown): SearchConfig | null {
  const d = (doc && typeof doc === 'object' ? doc : null) as Record<string, any> | null;
  if (!d || (d.type && d.type !== 'searchbox') || !d.searchbox) return null;
  const sb = d.searchbox || {};
  const design = d.design || {};
  const questions = Array.isArray(sb.questionsHidden) ? without(sb.questions, sb.questionsHidden) : strings(sb.questions).slice(0, Number(sb.chipCount) || 3);
  return normalizeConfig(toolId, {
    ...sb,
    language: sb.language || design.language,
    accent: sb.accent || design.primaryColor || design.buttonColor,
    ai: sb.aiEnabled !== false,
    aiDisclaimer: sb.aiDisclaimer === true ? str(sb.aiDisclaimerText) : '',
    placeholders: without(sb.placeholders, sb.placeholdersHidden),
    questions,
    assistantAvatar: sb.assistantAvatar || (Array.isArray(sb.avatars) ? sb.avatars[0] : ''),
    pagesCount: Array.isArray(sb.pages) ? sb.pages.length : 0,
  });
}

/* ----------------------------------------------------- remembered settings */

export interface StoredConfig { config: SearchConfig; at: number }
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const key = (toolId: string, apiBase: string) => `sfas:config:v1:${apiBase}:${toolId}`;

/** localStorage when there is one that works; private windows and blocked site data have none. */
export function defaultStorage(): Store | null {
  try {
    const s = (globalThis as any).localStorage as Storage | undefined;
    if (!s) return null;
    s.getItem('sfas:probe');
    return s;
  } catch { return null; }
}

export function readStored(store: Store | null, toolId: string, apiBase: string): StoredConfig | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key(toolId, apiBase));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.config) return null;
    return { config: normalizeConfig(toolId, parsed.config), at: Number(parsed.at) || 0 };
  } catch { return null; }
}

export function writeStored(store: Store | null, toolId: string, apiBase: string, entry: StoredConfig): void {
  if (!store) return;
  try { store.setItem(key(toolId, apiBase), JSON.stringify(entry)); } catch { /* full or blocked: the next visit fetches */ }
}

/** Settings a plugin wrote into the page: `<script type="application/json" data-sf-agenticsearch-config="ID">`. */
export function readInlineConfig(toolId: string, doc?: Document): SearchConfig | null {
  const d = doc || (typeof document !== 'undefined' ? document : null);
  if (!d) return null;
  for (const node of Array.from(d.querySelectorAll('script[data-sf-agenticsearch-config]'))) {
    if (node.getAttribute('data-sf-agenticsearch-config') !== toolId) continue;
    try { return normalizeConfig(toolId, JSON.parse(node.textContent || '{}')); } catch { return null; }
  }
  return null;
}
