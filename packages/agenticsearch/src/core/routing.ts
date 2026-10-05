import { isStateKey, queryToState, stateToQuery } from '../client/query';
import type { SearchState } from '../client/types';

export interface RoutingOptions {
  /** The query parameter the words go in. `q` by default; WordPress uses `s`. */
  queryParam?: string;
  /** Where the address lives. `window` by default; given in tests. */
  window?: Window;
}

/**
 * Keeps the search in the page's address, in the same format the API reads,
 * so a search can be linked to, reloaded and stepped back through. Whatever
 * else the address carries (a campaign tag, a preview flag) is left alone.
 */
export class Router {
  private win: Window;
  private param: string;
  private onPop: (() => void) | null = null;
  private lastQuery = '';

  constructor(options: RoutingOptions = {}) {
    this.win = options.window || window;
    this.param = options.queryParam || 'q';
  }

  read(): SearchState {
    this.lastQuery = stateToQuery(queryToState(this.win.location.search, this.param), this.param);
    return queryToState(this.win.location.search, this.param);
  }

  /** Writes the state. A change of words alone replaces the entry; anything else adds one. */
  write(state: SearchState): void {
    const history = this.win.history;
    if (!history || !history.pushState) return;
    const query = stateToQuery(state, this.param);
    if (query === this.lastQuery) return;
    const keep: string[] = [];
    for (const pair of String(this.win.location.search || '').replace(/^\?/, '').split('&')) {
      if (!pair) continue;
      let key = pair.split('=')[0];
      try { key = decodeURIComponent(key); } catch { /* keep as written */ }
      if (!isStateKey(key, this.param)) keep.push(pair);
    }
    const all = keep.concat(query ? [query] : []).join('&');
    const url = this.win.location.pathname + (all ? `?${all}` : '') + this.win.location.hash;
    const onlyWords = stateToQuery({ ...state, q: '' }, this.param) === stateToQuery({ ...queryToState(`?${this.lastQuery}`, this.param), q: '' }, this.param);
    this.lastQuery = query;
    if (onlyWords) history.replaceState(history.state, '', url);
    else history.pushState(null, '', url);
  }

  listen(onChange: (state: SearchState) => void): void {
    this.onPop = () => onChange(this.read());
    this.win.addEventListener('popstate', this.onPop);
  }

  dispose(): void {
    if (this.onPop) this.win.removeEventListener('popstate', this.onPop);
    this.onPop = null;
  }
}
