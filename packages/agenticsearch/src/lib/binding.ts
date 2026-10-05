import type { AgenticSearch } from '../core/agenticsearch';
import type { Widget } from '../core/types';
import type { Connector, RenderOptions } from '../connectors/createConnector';

/**
 * A connector held for a framework: the widget to add to the search, the
 * state it has right now (worked out at once, so a first render and a server
 * render have something to show), and a way to be told when it changes.
 */
export interface Binding<State, Params> {
  widget: Widget;
  current(): RenderOptions<State, Params>;
  subscribe(listener: (state: RenderOptions<State, Params>) => void): () => void;
}

export function bind<State, Params>(instance: AgenticSearch, connector: Connector<State, Params>, params: Params): Binding<State, Params> {
  let state!: RenderOptions<State, Params>;
  const listeners = new Set<(state: RenderOptions<State, Params>) => void>();
  const widget = connector<Params>((next) => {
    state = next;
    listeners.forEach((listener) => listener(next));
  })(params);
  widget.init?.(instance.context());
  return {
    widget,
    current: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/** The search for a provider: made from a client, or from a tool id and client options. */
export interface ProviderOptions {
  /** The search tool id. Or pass `searchClient`. */
  toolId?: string;
  apiBase?: string;
  testMode?: boolean;
}
