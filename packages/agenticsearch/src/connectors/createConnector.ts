import type { AgenticSearch } from '../core/agenticsearch';
import type { RenderContext, Widget } from '../core/types';

/** What a render function receives: the connector's own values plus these. */
export type RenderOptions<State, Params> = State & { widgetParams: Params; instance: AgenticSearch };
export type RenderFn<State, Params> = (options: RenderOptions<State, Params>, isFirstRender: boolean) => void;
export type Connector<State, Params> = <P extends Params>(render: RenderFn<State, P>, unmount?: () => void) => (widgetParams: P) => Widget;

interface Spec<State, Params, Local> {
  type: string;
  /** Anything the widget keeps between renders (what is expanded, a cache of pages). */
  local?: () => Local;
  getState(context: RenderContext, params: Params, local: Local, rerender: () => void): State;
  dispose?(context: RenderContext, params: Params, local: Local): void;
}

/**
 * Builds a connector: the logic of a widget with no markup of its own. Give
 * it a render function and it hands back a widget factory, so the same
 * behaviour can be drawn with plain DOM, React, Vue or anything else.
 */
export function createConnector<State, Params = Record<string, never>, Local = Record<string, never>>(spec: Spec<State, Params, Local>): Connector<State, Params> {
  return (render, unmount = () => {}) => (widgetParams) => {
    const local = spec.local ? spec.local() : ({} as Local);
    let last: RenderContext | null = null;
    const draw = (context: RenderContext, first: boolean) => {
      last = context;
      const rerender = () => { if (last) draw(last.instance.context(), false); };
      render({ ...spec.getState(context, widgetParams, local, rerender), widgetParams, instance: context.instance }, first);
    };
    return {
      $$type: spec.type,
      init(context) { draw(context, true); },
      render(context) { draw(context, false); },
      dispose(context) {
        spec.dispose?.(context, widgetParams, local);
        last = null;
        unmount();
      },
    };
  };
}
