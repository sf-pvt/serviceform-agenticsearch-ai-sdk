# Serviceform AgenticSearch: contracts

The fixed points every part of the SDK, the plugins and the Serviceform API agree on.

## 1. Names

| Thing | Name |
|---|---|
| Product | Serviceform AgenticSearch |
| npm package | `@serviceform/agenticsearch` |
| Composer package | `serviceform/agenticsearch` (PHP namespace `Serviceform\AgenticSearch`) |
| Browser global (prebuilt bundle) | `window.ServiceformAgenticSearch` |
| CSS class prefix | `sfas-` |
| Distributed files | `dist/agenticsearch.prebuilt.min.js`, `dist/agenticsearch.min.css` |
| Default API host | `https://dash.serviceform.com` |

Plugins vendor the two dist files as `agenticsearch.js` and `agenticsearch.css` and serve them from their own origin.

## 2. Declarative mount (what PHP, Liquid and Elementor render)

The prebuilt bundle mounts every element carrying `data-sf-agenticsearch` when the DOM is ready, and exposes `ServiceformAgenticSearch.mount(elementOrOptions)` and `ServiceformAgenticSearch.mountAll()` for late-added markup (Elementor editor, SPA).

```html
<link rel="stylesheet" href="/own/origin/agenticsearch.css">
<div class="sfas sfas-shell sfas-shell--page"
     data-sf-agenticsearch
     data-tool-id="TOOL_ID"
     data-layout="page"            <!-- box | modal | page | section -->
     data-language="fi"            <!-- optional, 2 letters -->
     data-accent="#111111"         <!-- optional -->
     data-ai="true"                <!-- optional, "false" turns AI answers off -->
     data-search-page="/search"    <!-- box/modal: where "show all results" goes -->
     data-search-param="q"         <!-- q by default, "s" on WordPress -->
     data-per-page="24"            <!-- page layout, 1..48 -->
     data-facets="brand,price"     <!-- optional override of the tool's filter list -->
     data-state="f.brand=Volvo&sort=price_asc"  <!-- optional: the search a landing page opens with -->
     data-placeholder="Search"     <!-- optional -->
     data-api-base="https://dash.serviceform.com"> <!-- optional -->
  <!-- optional pre-rendered shell (see 3); replaced on mount -->
</div>
<script type="application/json" data-sf-agenticsearch-config="TOOL_ID">{ ...settings (see 4)... }</script>
<script src="/own/origin/agenticsearch.js" defer></script>
```

- The inline settings `<script type="application/json">` is optional. When present for the tool id, no settings request is made before the first render; the SDK still revalidates in the background.
- Layouts: `box` (compact field with an instant dropdown, for a header), `modal` (a trigger that opens the full search over the page), `page` (full search page: field, filters, results, AI answer, URL state), `section` (the field with example questions under it, for a hero).

## 3. Pre-rendered shell (no layout shift)

Server renderers output this inside the mount element so the space is taken before the script runs. The stylesheet sizes it.

```html
<!-- box, modal, section -->
<div class="sfas-shell-field"><span class="sfas-shell-icon"></span><span class="sfas-shell-text">PLACEHOLDER</span></div>
<!-- page: the field above, then -->
<div class="sfas-shell-body"><div class="sfas-shell-side"></div><div class="sfas-shell-grid"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
```

## 4. Settings

`GET {apiBase}/api/public/omnibox/config/{toolId}` (falls back to `/api/public/tid/{toolId}` on servers that do not have it yet):

```json
{
  "v": 1,
  "toolId": "abc",
  "language": "fi",
  "currency": "EUR",
  "priceCents": false,
  "industry": "automotive",
  "layout": "box",
  "accent": "#d61920",
  "radius": 18,
  "ai": true,
  "aiDisclaimer": "",
  "placeholders": ["..."],
  "questions": ["..."],
  "labels": {},
  "showFilters": true,
  "facets": ["price", "brand"],
  "facetStyles": {"brand": "list"},
  "facetLabels": {"brand": "Merkki"},
  "card": null,
  "searchPageHref": "",
  "searchPageParam": "q",
  "contactHref": "",
  "assistantAvatar": "",
  "fallbackImage": "",
  "productSearch": true,
  "pageSearch": true,
  "popularSearches": false,
  "pagesCount": 120
}
```

`GET .../config/{toolId}?part=pages` returns `{ "v": 1, "pages": [{ "l": "label", "h": "https://...", "k": "keywords" }] }`, fetched lazily on first focus.

Caching: `Cache-Control: public, max-age=300, s-maxage=21600, stale-while-revalidate=86400` plus an `ETag`; `If-None-Match` answers 304. A missing tool answers 404 with `Cache-Control: no-store`.

## 5. Search API (existing, frozen as v1)

- `GET /api/public/omnibox/search/{toolId}?q=&limit=` → `{ products, found, suggestions: [{t,b}], understood? }` (keystroke dropdown)
- `GET /api/public/omnibox/browse/{toolId}?q=&page=&per_page=&sort=&f.FIELD=a|b&r.FIELD=min|max&price_min=&price_max=&in_stock=1&k=&facets=&lang=&fields=`
  → `{ q, page, per_page, found, has_more, sort, products, facets: [{field, values: [{v,c,l?}]}], ranges: [{field,min,max}], price: {min,max}|null, price_cents, available, state, read, chips: [{k,l}], note?, dropped?, mileage_unit }`
- `POST /api/public/omnibox/ask/{toolId}` `{ q, history?, previous?, shown?, userId?, pageUrl?, testMode? }`
  → `{ answer, intent, products, links: [{l,h}], facets, filters, chips, adopt?, note?, dropped?, language, continued }`
- `POST /api/analytics/search` `{ type: 'search'|'click'|'filter_usage', data }` (best effort)

Product row on the wire: `{ t, y, meta, loc, p, mo, h, img, id, brand, pn, oos, f }`. The JS and PHP clients expose it as
`{ title, year, meta, location, price, monthly, url, image, id, brand, priceValue, outOfStock, fields }`.

Sort ids: `relevance, price_asc, price_desc, year_desc, year_asc, mileage_asc, newest, name_asc`.

Every request carries `sdk=agenticsearch-js@VERSION` (or `-php@`) as a query parameter so the API can stay backward compatible with shipped plugin versions.
