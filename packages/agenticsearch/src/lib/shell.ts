import { escapeHtml } from './dom';

/**
 * The placeholder a server (or a framework's first render) puts inside the
 * mount element so the space is taken before the search draws. The same
 * markup the PHP renderer and the plugins output; the stylesheet sizes it.
 */
export function shellHtml(layout: string, placeholder = ''): string {
  const field = `<div class="sfas-shell-field"><span class="sfas-shell-icon"></span><span class="sfas-shell-text">${escapeHtml(placeholder)}</span></div>`;
  const body = '<div class="sfas-shell-body"><div class="sfas-shell-side"></div><div class="sfas-shell-grid"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>';
  return layout === 'page' ? field + body : field;
}

export const shellClass = (layout: string): string => `sfas sfas-shell sfas-shell--${layout}`;
