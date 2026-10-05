/**
 * React bindings for Serviceform AgenticSearch.
 *
 *   <AgenticSearch toolId="..." layout="page" />          a ready-made search
 *
 *   <AgenticSearchProvider toolId="..." routing>          your own markup:
 *     const { hits } = useHits();                         one hook per widget
 *   </AgenticSearchProvider>
 */
import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { serviceformSearch } from '../client';
import type { SearchClient } from '../client/types';
import {
  connectAiAnswer, connectAutocomplete, connectClearRefinements, connectCurrentRefinements, connectDynamicFacets, connectHits, connectInStock,
  connectInfiniteHits, connectNote, connectPagination, connectRange, connectRefinementList, connectSearchBox, connectSortBy, connectStats, connectSuggestedQuestions,
  type AutocompleteConnectorParams, type CurrentRefinementsConnectorParams, type DynamicFacetsConnectorParams, type PaginationConnectorParams,
  type RangeConnectorParams, type RefinementListConnectorParams, type SortByConnectorParams, type SuggestedQuestionsConnectorParams,
} from '../connectors';
import type { Connector, RenderOptions } from '../connectors/createConnector';
import { AgenticSearch as SearchInstance, type AgenticSearchOptions } from '../core/agenticsearch';
import { bind, type ProviderOptions } from '../lib/binding';
import { shellClass, shellHtml } from '../lib/shell';
import type { MountOptions, Mounted } from '../prebuilt';

const Context = createContext<SearchInstance | null>(null);

export interface AgenticSearchProviderProps extends ProviderOptions, Omit<AgenticSearchOptions, 'searchClient'> {
  searchClient?: SearchClient;
  children?: ReactNode;
}

/** Holds one search for the hooks under it. Give it a `toolId`, or a `searchClient` of your own. */
export function AgenticSearchProvider(props: AgenticSearchProviderProps): ReactElement {
  const { children, toolId, apiBase, testMode, searchClient, ...options } = props;
  // One search for the life of the provider; a new tool is a new search.
  const instance = useMemo(() => {
    const client = searchClient || serviceformSearch(String(toolId || ''), { apiBase, testMode });
    return new SearchInstance({ ...options, searchClient: client });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchClient, toolId, apiBase, testMode]);
  useEffect(() => {
    instance.start();
    return () => instance.dispose();
  }, [instance]);
  return createElement(Context.Provider, { value: instance }, children);
}

/** The search itself: `state`, `results`, `setQuery()`, `submit()`, `ask()` and the rest. */
export function useAgenticSearch(): SearchInstance {
  const instance = useContext(Context);
  if (!instance) throw new Error('AgenticSearch hooks must be used inside <AgenticSearchProvider>');
  return instance;
}

/** Any connector as a hook. The named hooks below are this with a connector filled in. */
export function useConnector<State, Params>(connector: Connector<State, Params>, params: Params): RenderOptions<State, Params> {
  const instance = useAgenticSearch();
  const key = JSON.stringify(params ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const binding = useMemo(() => bind(instance, connector, params), [instance, connector, key]);
  const [state, setState] = useState(binding.current);
  const shown = useRef(binding);
  if (shown.current !== binding) { shown.current = binding; setState(binding.current()); }
  useEffect(() => {
    const off = binding.subscribe(setState);
    instance.addWidgets([binding.widget]);
    return () => { off(); instance.removeWidgets([binding.widget]); };
  }, [instance, binding]);
  return state;
}

const EMPTY = {};
export const useSearchBox = () => useConnector(connectSearchBox, EMPTY);
export const useHits = () => useConnector(connectHits, EMPTY);
export const useInfiniteHits = () => useConnector(connectInfiniteHits, EMPTY);
export const useRefinementList = (params: RefinementListConnectorParams) => useConnector(connectRefinementList, params);
export const useRange = (params: RangeConnectorParams) => useConnector(connectRange, params);
export const useSortBy = (params: SortByConnectorParams = EMPTY) => useConnector(connectSortBy, params);
export const useCurrentRefinements = (params: CurrentRefinementsConnectorParams = EMPTY) => useConnector(connectCurrentRefinements, params);
export const useClearRefinements = (params: { includeQuery?: boolean } = EMPTY) => useConnector(connectClearRefinements, params);
export const useStats = () => useConnector(connectStats, EMPTY);
export const usePagination = (params: PaginationConnectorParams = EMPTY) => useConnector(connectPagination, params);
export const useInStock = () => useConnector(connectInStock, EMPTY);
export const useNote = () => useConnector(connectNote, EMPTY);
export const useDynamicFacets = (params: DynamicFacetsConnectorParams = EMPTY) => useConnector(connectDynamicFacets, params);
export const useAutocomplete = (params: AutocompleteConnectorParams = EMPTY) => useConnector(connectAutocomplete, params);
export const useAiAnswer = () => useConnector(connectAiAnswer, EMPTY);
export const useSuggestedQuestions = (params: SuggestedQuestionsConnectorParams = EMPTY) => useConnector(connectSuggestedQuestions, params);

export interface AgenticSearchProps extends Omit<MountOptions, 'target'> {
  className?: string;
  style?: CSSProperties;
  /** Called once the search is on the page, with its handle (`open()`, `close()`, `instance`). */
  onMount?: (mounted: Mounted) => void;
}

/**
 * A ready-made search: `box`, `modal`, `page` or `section`. Renders the
 * placeholder shell on the server and in the first paint, then the search
 * takes its place in the browser.
 */
export function AgenticSearch(props: AgenticSearchProps): ReactElement {
  const { className, style, onMount, ...options } = props;
  const ref = useRef<HTMLDivElement>(null);
  const layout = options.layout || 'box';
  const key = JSON.stringify(options);
  const html = useMemo(() => ({ __html: shellHtml(layout, options.placeholder) }), [layout, options.placeholder]);
  useEffect(() => {
    let mounted: Mounted | null = null;
    let gone = false;
    // In the browser only: there is nothing for the search to draw on a server.
    import('../prebuilt').then(({ mount }) => {
      if (gone || !ref.current) return;
      mounted = mount({ ...(JSON.parse(key) as Omit<MountOptions, 'target'>), target: ref.current });
      onMount?.(mounted);
    });
    return () => { gone = true; mounted?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return createElement('div', { ref, className: `${shellClass(layout)}${className ? ` ${className}` : ''}`, style, dangerouslySetInnerHTML: html, suppressHydrationWarning: true });
}

export type { Hit, SearchState, SearchClient, BrowseResults, SearchConfig } from '../client/types';
export { serviceformSearch } from '../client';
