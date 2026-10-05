# Astro

```bash
npm install @serviceform/agenticsearch
```

## 1. One component

Create `src/components/AgenticSearch.astro`. It renders the placeholder shell on the server (so nothing shifts while the page loads), bundles the stylesheet with your site's CSS, and mounts in the browser. It also works with view transitions (`<ClientRouter />`).

```astro
---
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
}
const { toolId, layout = 'box', searchPage, searchParam, language, accent, perPage, placeholder = '' } = Astro.props;
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
>
  <div class="sfas-shell-field"><span class="sfas-shell-icon"></span><span class="sfas-shell-text">{placeholder}</span></div>
  {layout === 'page' && (
    <div class="sfas-shell-body"><div class="sfas-shell-side"></div><div class="sfas-shell-grid"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
  )}
</div>

<script>
  import { mountAll } from '@serviceform/agenticsearch';

  // astro:page-load fires on the first load and after every view transition.
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
- The results page reads and writes the query string itself (`?q=...&f.brand=...`).
- Works next to Tailwind (`@astrojs/tailwind` or Tailwind 4) without extra configuration.

All options: [AGENTS.md](../../AGENTS.md#3-every-option).
