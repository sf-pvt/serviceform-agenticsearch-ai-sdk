/**
 * The one-file build for a <script> tag and for the Shopify and WordPress
 * plugins: everything in the library on `window.ServiceformAgenticSearch`,
 * and every `[data-sf-agenticsearch]` element mounted when the page is ready.
 */
import * as library from '../index';
import { mount, mountAll, optionsFromElement } from './index';

// A page can end up with this file twice (two plugins, a theme and a tag
// manager). The first copy owns the page: a second one keeps its own list of
// what is mounted and would mount everything again.
const existing = (window as any).ServiceformAgenticSearch;
const first = !existing || typeof existing.mountAll !== 'function';
if (first) (window as any).ServiceformAgenticSearch = { ...library };

// <script src=".../agenticsearch.js" data-tool-id="..." data-target=".header-search" data-layout="box">
const script = document.currentScript as HTMLScriptElement | null;
const fromScript = () => {
  if (!script || !script.dataset.toolId) return;
  const options = optionsFromElement(script);
  if (!options) return;
  let target = script.dataset.target ? document.querySelector<HTMLElement>(script.dataset.target) : null;
  if (!target) {
    if (script.dataset.target) return;
    target = document.createElement('div');
    script.parentNode?.insertBefore(target, script.nextSibling);
  }
  try { mount({ ...options, target }); } catch (error) { console.error('[ServiceformAgenticSearch]', error); }
};

const ready = () => {
  if (!first) { try { existing.mountAll(); } catch (error) { console.error('[ServiceformAgenticSearch]', error); } return; }
  fromScript();
  mountAll();
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
else ready();
