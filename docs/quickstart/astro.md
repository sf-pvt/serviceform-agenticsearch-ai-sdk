# Astro

```bash
npm install @serviceform/agenticsearch
```

## 1. One component

Create `src/components/AgenticSearch.astro`. It fetches the tool's settings while the page is built and writes them into the HTML, renders the placeholder shell, bundles the stylesheet with your site's CSS, and mounts in the browser. The visitor's first paint already has the right language, placeholder and colour, and no settings request is made.

```astro
---
import { serviceformSearch } from '@serviceform/agenticsearch/client';
import '@serviceform/agenticsearch/css';

interface Props {
  toolId: string;
  layout?: 'box' | 'modal' | 'page' | 'section';
  searchPage?: string;
  searchParam?: string;
  language?: string;
  accent?: string;
  perPage?: number;
  placeholder?: string;
  state?: string;
  apiBase?: string;
}
const { toolId, layout = 'box', searchPage, searchParam, language, accent, perPage, placeholder = '', state, apiBase } = Astro.props;

// The tool's settings, fetched while the page is built (or rendered on the
// server) and written into the page, so the browser draws the search in the
// right language and colour at once, with no settings request. The SDK still
// checks for newer settings in the background.
let settings = null;
try { settings = await serviceformSearch(toolId, { apiBase, storage: false }).getConfig(); } catch { settings = null; }
const settingsJson = settings ? JSON.stringify(settings).replace(/</g, '\\u003c') : '';
const shellText = placeholder || settings?.placeholders?.[0] || '';
---
<div
  class={`sfas sfas-shell sfas-shell--${layout}`}
  data-sf-agenticsearch
  data-tool-id={toolId}
  data-layout={layout}
  data-search-page={searchPage}
  data-search-param={searchParam}
  data-language={language}
  data-accent={accent}
  data-per-page={perPage}
  data-placeholder={placeholder || undefined}
  data-state={state}
  data-api-base={apiBase}
  style={settings ? `--sfas-accent:${accent || settings.accent};--sfas-radius:${settings.radius}px` : undefined}
>
  <div class="sfas-shell-field"><span class="sfas-shell-icon"></span><span class="sfas-shell-text">{shellText}</span></div>
  {layout === 'page' && (
    <div class="sfas-shell-body"><div class="sfas-shell-side"></div><div class="sfas-shell-grid"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
  )}
</div>
{settingsJson && <script type="application/json" data-sf-agenticsearch-config={toolId} set:html={settingsJson} />}

<script>
  import { mountAll } from '@serviceform/agenticsearch';

  document.addEventListener('astro:page-load', () => mountAll());
  if (document.readyState !== 'loading') mountAll();
  else document.addEventListener('DOMContentLoaded', () => mountAll());
</script>
```

## 2. Use it

In your layout's header:

```astro
---
import AgenticSearch from '../components/AgenticSearch.astro';
---
<header>
  <AgenticSearch toolId="TOOL_ID" layout="box" searchPage="/search" />
</header>
```

In `src/pages/search.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import AgenticSearch from '../components/AgenticSearch.astro';
---
<Base>
  <AgenticSearch toolId="TOOL_ID" layout="page" />
</Base>
```

That is all. No integration, no adapter, no `client:` directive: the component is plain Astro and works in static and server output.

## 3. Good to know

- The script in the component is bundled once by Astro however many times the component is used.
- Settings are fetched at build time (static output) or at request time (server output). The SDK checks for newer settings in the background, so a static site picks up dashboard changes without a rebuild.
- `state="f.brand=Volvo&sort=price_asc"` opens the search pre-filtered, for landing pages.
- The results page reads and writes the query string itself (`?q=...&f.brand=...`).
- Works next to Tailwind without extra configuration.

All options: [AGENTS.md](../../AGENTS.md#3-every-option).
