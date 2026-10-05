# Serviceform AgenticSearch

Search for any website, powered by a Serviceform search tool: instant results, faceted results pages, and AI answers that read what the visitor means ("red volvo under 30k" becomes a colour, a price and a make).

Made for car sales, real estate, education, e-commerce and site search in general. It reads cars, properties, courses and products the way each catalogue describes them, and answers questions from the site's own pages.

See it in action and book a demo on your own catalogue: [Serviceform AgenticSearch](https://www.serviceform.com/industries/automotive/ai-search/).

## Set it up in a minute

You need one value: your **search tool id** (Serviceform dashboard: Tools > Search box > Install). It is public; there is no API key.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@serviceform/agenticsearch@0/dist/agenticsearch.min.css">

<!-- header: a search box on every page -->
<div data-sf-agenticsearch data-tool-id="TOOL_ID" data-layout="box" data-search-page="/search"></div>

<!-- /search: the results page -->
<div data-sf-agenticsearch data-tool-id="TOOL_ID" data-layout="page"></div>

<script src="https://cdn.jsdelivr.net/npm/@serviceform/agenticsearch@0/dist/agenticsearch.prebuilt.min.js" defer></script>
```

Guides: [HTML](docs/quickstart/html.md) · [Astro](docs/quickstart/astro.md) · [React / Next.js](docs/quickstart/react.md) · [Vue / Nuxt](docs/quickstart/vue.md) · [WordPress](docs/quickstart/wordpress.md) · [Shopify](docs/quickstart/shopify.md) · [PHP](php/README.md)

### On Shopify or WordPress?

No code needed. The search is built into the Serviceform plugins and loads from your own store's files:

- **Shopify:** install the [Serviceform app](https://apps.shopify.com/serviceform-app), then switch the search on in the theme editor. [Guide](docs/quickstart/shopify.md)
- **WordPress / WooCommerce:** install the [Serviceform plugin](https://wordpress.org/plugins/serviceform-pixel/), then enable AgenticSearch in its settings. Works with Elementor, the block editor and shortcodes. [Guide](docs/quickstart/wordpress.md)

### Using an AI coding assistant?

Paste this into Claude Code, Cursor or Copilot in your project:

```text
Add Serviceform AgenticSearch to this site. My search tool id is TOOL_ID.
Read https://raw.githubusercontent.com/sf-pvt/serviceform-agenticsearch-ai-sdk/main/AGENTS.md and follow it:
put a search box in the header on every page and a results page at /search,
then run the verification steps from that file and tell me the results.
```

[AGENTS.md](AGENTS.md) has every option, the rules, verification steps and troubleshooting. [llms.txt](llms.txt) indexes the docs.

## Three ways to use it

From least to most control:

| | What you get | Use it when |
|---|---|---|
| **Prebuilt** | A header box, a modal, a hero section or a full results page from one script and one stylesheet | You want search on the site today |
| **Widgets** | `searchBox`, `hits`, `refinementList`, `range`, `aiAnswer` and more, placed where you want them | You want your own layout |
| **React and Vue** | `<AgenticSearch>` component, plus a hook or composable per widget (`useHits()`, `useRefinementList()`) | Your site is a React or Vue app |
| **Connectors and client** | The logic with no markup (`connectHits(render)`), or just the typed API client | Another framework, or the server |

A PHP package (`serviceform/agenticsearch`) renders the markup server-side and talks to the same API. See [php/README.md](php/README.md).

## Prebuilt

Serve the two files from your own site (they are in `packages/agenticsearch/dist/` after a build, and in the npm package):

```html
<link rel="stylesheet" href="/assets/agenticsearch.css">

<!-- in the header -->
<div data-sf-agenticsearch data-tool-id="TOOL_ID" data-layout="box" data-search-page="/search"></div>

<!-- on /search -->
<div data-sf-agenticsearch data-tool-id="TOOL_ID" data-layout="page"></div>

<script src="/assets/agenticsearch.js" defer></script>
```

Layouts: `box` (field with an instant dropdown), `modal` (a trigger that opens the full search over the page, also on Cmd/Ctrl+K), `page` (field, AI answer, filters, results, and the search kept in the address), `section` (a field with the tool's example questions under it).

All attributes are listed in [docs/contract.md](docs/contract.md). From code:

```js
ServiceformAgenticSearch.mount({ toolId: 'TOOL_ID', target: '#search', layout: 'page' });
ServiceformAgenticSearch.mountAll(); // after adding markup later
```

### Landing pages

Every search has an address, so a link is a landing page: `/search?f.brand=Volvo&price_max=30000&sort=price_asc`. For a page with a clean address of its own, give the search its starting point with `data-state="f.brand=Volvo&sort=price_asc"`. See [landing pages and links](docs/quickstart/html.md#6-landing-pages-and-links).

### No flash

- Load the stylesheet in the `<head>` and render the placeholder shell inside the mount element (the PHP renderer and the plugins do this), so the space is taken before the script runs.
- Write the tool's settings into the page as `<script type="application/json" data-sf-agenticsearch-config="TOOL_ID">` and the first render makes no settings request.
- Without inline settings they are fetched once, remembered in `localStorage`, used at once on the next visit and refreshed in the background.

## Widgets

```bash
npm install @serviceform/agenticsearch
```

```js
import { serviceformSearch, agenticsearch, searchBox, refinementList, range, hits, aiAnswer, currentRefinements } from '@serviceform/agenticsearch';
import '@serviceform/agenticsearch/css';

const search = agenticsearch({
  searchClient: serviceformSearch('TOOL_ID'),
  routing: true,
});

search.addWidgets([
  searchBox({ container: '#searchbox' }),
  aiAnswer({ container: '#answer' }),
  currentRefinements({ container: '#chips' }),
  refinementList({ container: '#brand', attribute: 'brand' }),
  range({ container: '#price', attribute: 'price' }),
  hits({ container: '#hits' }),
]);

search.start();
```

| Widget | Does |
|---|---|
| `searchBox` | The field of a results page. Searches as you type; Enter starts a new search and asks the AI |
| `autocomplete` | A field with an instant dropdown: products, site pages, popular searches, AI |
| `hits`, `infiniteHits` | Results as cards; `templates.item` for a card of your own |
| `refinementList` | One filter, as checkboxes, pills or a select |
| `range` | A numeric filter (price, year, mileage) with fields and a two-handled slider |
| `dynamicFacets` | Every filter the catalogue has, in the order set on the tool |
| `currentRefinements`, `clearRefinements` | What is applied, as removable chips |
| `sortBy`, `stats`, `pagination`, `inStock`, `note` | Order, count, page numbers, stock toggle, and what the search loosened to find anything |
| `aiAnswer`, `suggestedQuestions` | The AI's answer with its sources; the tool's example questions |

**Works next to any CSS framework.** The stylesheet is scoped to `.sfas`, uses only `sfas-` class names, and is built with extra selector weight so Tailwind, Bootstrap or a WordPress theme cannot restyle it by accident. `examples/frameworks.html` shows the same search under each. To override one of its rules outright, use an id in your selector or `!important`.

Theme with CSS custom properties on `.sfas`: `--sfas-accent`, `--sfas-radius`, `--sfas-font`, `--sfas-text`, `--sfas-muted`, `--sfas-border`, `--sfas-surface`, `--sfas-soft`, `--sfas-card-min`.

## React and Vue

```jsx
import { AgenticSearch } from '@serviceform/agenticsearch/react';   // or '/vue'

<AgenticSearch toolId="TOOL_ID" layout="page" />
```

Or your own markup from hooks, under a provider:

```jsx
import { AgenticSearchProvider, useSearchBox, useHits } from '@serviceform/agenticsearch/react';

function Results() {
  const { refine } = useSearchBox();
  const { hits } = useHits();
  return (<>
    <input onChange={(e) => refine(e.target.value)} />
    {hits.map((hit) => <a key={hit.id} href={hit.url}>{hit.title} {hit.price}</a>)}
  </>);
}

<AgenticSearchProvider toolId="TOOL_ID" routing><Results /></AgenticSearchProvider>
```

Both render on the server and work under React StrictMode. Full guides: [React / Next.js](docs/quickstart/react.md), [Vue / Nuxt](docs/quickstart/vue.md).

## Connectors

Every widget is a connector plus markup. Use the connector to draw it yourself:

```js
import { connectHits } from '@serviceform/agenticsearch/connectors';

const myHits = connectHits(({ hits, sendClick }, isFirstRender) => {
  // draw `hits` any way you like; call sendClick(hit, position) when one is opened
});

search.addWidgets([myHits({})]);
```

## Client only

```js
import { serviceformSearch } from '@serviceform/agenticsearch/client';

const client = serviceformSearch('TOOL_ID');
const { hits, facets, chips, state } = await client.browse({ q: 'red volvo under 30k' });
const { answer, hits: about } = await client.ask('Do you offer financing?');
```

Works in the browser and in Node 18+.

## How the search reads a query

The words are read on Serviceform's servers, not in the SDK. A browse response carries the `state` it settled on (words left to search, filters, ranges, order) and `chips` naming each part. The SDK adopts that state, so the field, the filters and the address always agree, and improvements to the reading reach every site without an SDK update.

## Develop

```bash
npm install
npm run build      # packages/agenticsearch/dist
npm test
npm run serve      # then open http://localhost:5173/examples/?tool=TOOL_ID
composer install && vendor/bin/phpunit
```

## License

Serviceform AgenticSearch is owned by Serviceform Oy. You may use it, free of charge, on websites and applications you own, operate or build for clients, to connect them to Serviceform. You may not use it with another search service or resell it. The full terms are in [LICENSE](LICENSE).
