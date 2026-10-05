/**
 * Vue 3 bindings for Serviceform AgenticSearch.
 *
 *   <AgenticSearch tool-id="..." layout="page" />         a ready-made search
 *
 *   <AgenticSearchProvider tool-id="..." routing>         your own markup:
 *     const hits = useHits();   // a ref: hits.value.hits   one composable per widget
 *   </AgenticSearchProvider>
 */
import { defineComponent, h, inject, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch, type InjectionKey, type PropType, type ShallowRef } from 'vue';
import { serviceformSearch } from '../client';
import type { SearchClient, SearchState } from '../client/types';
import {
  connectAiAnswer, connectAutocomplete, connectClearRefinements, connectCurrentRefinements, connectDynamicFacets, connectHits, connectInStock,
  connectInfiniteHits, connectNote, connectPagination, connectRange, connectRefinementList, connectSearchBox, connectSortBy, connectStats, connectSuggestedQuestions,
  type AutocompleteConnectorParams, type CurrentRefinementsConnectorParams, type DynamicFacetsConnectorParams, type PaginationConnectorParams,
  type RangeConnectorParams, type RefinementListConnectorParams, type SortByConnectorParams, type SuggestedQuestionsConnectorParams,
} from '../connectors';
import type { Connector, RenderOptions } from '../connectors/createConnector';
import { AgenticSearch as SearchInstance, type AgenticSearchOptions } from '../core/agenticsearch';
import { bind } from '../lib/binding';
import { shellClass, shellHtml } from '../lib/shell';
import type { LayoutName, MountOptions, Mounted } from '../prebuilt';

const KEY: InjectionKey<SearchInstance> = Symbol('serviceform-agenticsearch');

/** Starts a search for this component and everything under it. Call in `setup()`; or use `<AgenticSearchProvider>`. */
export function provideAgenticSearch(options: Omit<AgenticSearchOptions, 'searchClient'> & { searchClient?: SearchClient; toolId?: string; apiBase?: string; testMode?: boolean }): SearchInstance {
  const { toolId, apiBase, testMode, searchClient, ...rest } = options;
  const instance = new SearchInstance({ ...rest, searchClient: searchClient || serviceformSearch(String(toolId || ''), { apiBase, testMode }) });
  provide(KEY, instance);
  onMounted(() => instance.start());
  onBeforeUnmount(() => instance.dispose());
  return instance;
}

export const AgenticSearchProvider = defineComponent({
  name: 'AgenticSearchProvider',
  props: {
    toolId: String,
    apiBase: String,
    testMode: Boolean,
    searchClient: Object as PropType<SearchClient>,
    routing: { type: [Boolean, Object] as PropType<AgenticSearchOptions['routing']>, default: false },
    initialState: Object as PropType<Partial<SearchState>>,
    perPage: Number,
    facets: Array as PropType<string[]>,
    fields: Array as PropType<string[]>,
    language: String,
    ai: { type: Boolean as PropType<boolean | undefined>, default: undefined },
    insights: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    provideAgenticSearch({ ...props });
    return () => slots.default?.();
  },
});

/** The search itself: `state`, `results`, `setQuery()`, `submit()`, `ask()` and the rest. */
export function useAgenticSearch(): SearchInstance {
  const instance = inject(KEY, null);
  if (!instance) throw new Error('AgenticSearch composables must be used under <AgenticSearchProvider> or provideAgenticSearch()');
  return instance;
}

/** Any connector as a composable. Returns a ref that holds the connector's current state. */
export function useConnector<State, Params>(connector: Connector<State, Params>, params: Params): ShallowRef<RenderOptions<State, Params>> {
  const instance = useAgenticSearch();
  const binding = bind(instance, connector, params);
  const state = shallowRef(binding.current()) as ShallowRef<RenderOptions<State, Params>>;
  const off = binding.subscribe((next) => { state.value = next; });
  onMounted(() => instance.addWidgets([binding.widget]));
  onBeforeUnmount(() => { off(); instance.removeWidgets([binding.widget]); });
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

/**
 * A ready-made search: `box`, `modal`, `page` or `section`. Renders the
 * placeholder shell first (on the server too), then the search takes its
 * place in the browser.
 */
export const AgenticSearch = defineComponent({
  name: 'AgenticSearch',
  props: {
    toolId: { type: String, required: true },
    layout: { type: String as PropType<LayoutName>, default: 'box' },
    apiBase: String,
    language: String,
    accent: String,
    ai: { type: Boolean as PropType<boolean | undefined>, default: undefined },
    searchPageHref: String,
    searchPageParam: String,
    perPage: Number,
    facets: Array as PropType<string[]>,
    placeholder: String,
    routing: { type: Boolean as PropType<boolean | undefined>, default: undefined },
    testMode: Boolean,
  },
  emits: { mount: (_mounted: Mounted) => true },
  setup(props, { emit, expose }) {
    const el = ref<HTMLElement | null>(null);
    let mounted: Mounted | null = null;
    let gone = false;
    const options = (): MountOptions => {
      const o: Record<string, unknown> = { target: el.value! };
      for (const [key, value] of Object.entries(props)) if (value !== undefined && value !== false || key === 'ai' && value === false || key === 'routing' && value === false) o[key] = value;
      return o as unknown as MountOptions;
    };
    const start = async () => {
      const { mount } = await import('../prebuilt');
      if (gone || !el.value) return;
      mounted?.destroy();
      mounted = mount(options());
      emit('mount', mounted);
    };
    onMounted(start);
    watch(() => JSON.stringify(props), start);
    onBeforeUnmount(() => { gone = true; mounted?.destroy(); });
    expose({ open: (query?: string) => mounted?.open(query), close: () => mounted?.close() });
    // The shell is written once; from then on the element's inside belongs to the search.
    const html = shellHtml(props.layout, props.placeholder);
    return () => h('div', { ref: el, class: shellClass(props.layout), innerHTML: html });
  },
});

export type { Hit, SearchState, SearchClient, BrowseResults, SearchConfig } from '../client/types';
export { serviceformSearch } from '../client';
