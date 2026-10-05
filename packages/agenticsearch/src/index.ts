export { VERSION } from './version';
export * from './client';
export { agenticsearch, AgenticSearch, type AgenticSearchOptions } from './core/agenticsearch';
export type { Widget, RenderContext, AiState, SearchStatus } from './core/types';
export type { RoutingOptions } from './core/routing';
export * from './connectors';
export * from './widgets';
export { mount, mountAll, get, ensureStyles, optionsFromElement, type MountOptions, type Mounted, type LayoutName } from './prebuilt';
export { stringsFor, valueLabel, fieldLabel, type Strings } from './lib/i18n';
