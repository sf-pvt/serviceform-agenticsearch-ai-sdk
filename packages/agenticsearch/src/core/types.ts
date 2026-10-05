import type { Answer, BrowseResults, ChatTurn, SearchConfig, SearchState } from '../client/types';
import type { Strings } from '../lib/i18n';
import type { AgenticSearch } from './agenticsearch';

export type SearchStatus = 'idle' | 'loading' | 'error';

/** The AI answer that goes with the current search. */
export interface AiState {
  status: 'idle' | 'loading' | 'done' | 'error';
  /** What was asked. */
  question: string;
  answer: Answer | null;
  /** The turns so far, sent along with a follow-up. */
  history: ChatTurn[];
}

/** What every widget is handed when it is asked to draw. */
export interface RenderContext {
  instance: AgenticSearch;
  state: SearchState;
  results: BrowseResults | null;
  status: SearchStatus;
  error: Error | null;
  config: SearchConfig;
  strings: Strings;
  ai: AiState;
}

/**
 * A widget: something that draws from the search and changes it. Made by a
 * connector (`connectHits(render)(params)`) or by a ready-made DOM widget
 * (`hits({ container })`).
 */
export interface Widget {
  $$type: string;
  init?(context: RenderContext): void;
  render?(context: RenderContext): void;
  dispose?(context: RenderContext): void;
}
