# Serviceform AgenticSearch: instructions for AI coding agents

You are adding Serviceform search to a website. Follow this file top to bottom. Everything here is copy-paste complete; do not invent option names.

## 0. What you need from the user

One value: the **search tool id** (20 letters and digits, for example `aB3dE5fG7hJ9kL1mN2pQ`). It is in the Serviceform dashboard under Tools > Search box > Install. If you do not have it, ask for it and stop. Never guess an id.

It is a public identifier, safe to put in HTML. There is no API key or secret.

## 1. Pick the integration

| The site is | Use | Guide |
|---|---|---|
| WordPress or WooCommerce | The [Serviceform plugin](https://wordpress.org/plugins/serviceform-pixel/) (settings, Elementor widgets, block, shortcode) | [docs/quickstart/wordpress.md](docs/quickstart/wordpress.md) |
| Shopify | The [Serviceform app](https://apps.shopify.com/serviceform-app)'s theme blocks | [docs/quickstart/shopify.md](docs/quickstart/shopify.md) |
| Plain HTML, or any server-rendered site (Django, Rails, Laravel, Hugo, Eleventy) | Prebuilt: two tags and two `div`s | [docs/quickstart/html.md](docs/quickstart/html.md) |
| Astro | One `.astro` component | [docs/quickstart/astro.md](docs/quickstart/astro.md) |
| React or Next.js | `<AgenticSearch>` from `@serviceform/agenticsearch/react`, or hooks | [docs/quickstart/react.md](docs/quickstart/react.md) |
| Vue or Nuxt | `<AgenticSearch>` from `@serviceform/agenticsearch/vue`, or composables | [docs/quickstart/vue.md](docs/quickstart/vue.md) |
| PHP without WordPress | The Composer package renders the markup | [php/README.md](php/README.md) |
| A custom design that the prebuilt layouts cannot give | Widgets or connectors | [README.md](README.md#widgets) |

Default to **prebuilt**. Only build from widgets when the user asks for a layout the four prebuilt ones cannot produce.

## 2. The standard setup (works on any site)

Two placements: a box in the header on every page, and a results page at one URL (here `/search`).

```html
<!-- in <head>, on every page -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@serviceform/agenticsearch@0/dist/agenticsearch.min.css">

<!-- in the header, where the search field should be -->
<div data-sf-agenticsearch data-tool-id="TOOL_ID" data-layout="box" data-search-page="/search"></div>

<!-- on the /search page, where results should be -->
<div data-sf-agenticsearch data-tool-id="TOOL_ID" data-layout="page"></div>

<!-- before </body>, on every page -->
<script src="https://cdn.jsdelivr.net/npm/@serviceform/agenticsearch@0/dist/agenticsearch.prebuilt.min.js" defer></script>
```

Replace `TOOL_ID` twice. Replace `/search` with the site's real results URL. Prefer copying the two files into the site's own assets and pointing the tags there (see "Self-hosting" in the HTML guide).

## 3. Every option

Attributes on the mount element (or keys of `ServiceformAgenticSearch.mount({...})`, in camelCase as shown):

| Attribute | `mount()` key | Values | Default |
|---|---|---|---|
| `data-tool-id` | `toolId` | the tool id | required |
| `data-layout` | `layout` | `box`, `modal`, `page`, `section` | the tool's own setting |
| `data-search-page` | `searchPageHref` | URL of the results page (for `box`, `modal`, `section`) | none: Enter asks the AI in the dropdown |
| `data-search-param` | `searchPageParam` | query parameter name | `q` (use `s` on WordPress) |
| `data-language` | `language` | `en`, `fi`, `sv`, `de`, `es` | the tool's language |
| `data-accent` | `accent` | any CSS colour | the tool's colour |
| `data-ai` | `ai` | `true`, `false` | the tool's setting |
| `data-per-page` | `perPage` | 1 to 48 | 24 |
| `data-facets` | `facets` | comma-separated filter ids, in order | the tool's setting |
| `data-placeholder` | `placeholder` | text | the tool's placeholder |
| `data-routing` | `routing` | `false` stops the page layout writing to the URL | `true` |
| `data-api-base` | `apiBase` | API origin | `https://dash.serviceform.com` |

Layouts:
- `box`: compact field with an instant dropdown. For headers.
- `modal`: a button that opens the full search over the page (also Cmd/Ctrl+K). For headers with little room.
- `page`: field, AI answer, filters, results. Keeps the search in the URL. One per page.
- `section`: a large field with example questions under it. For a hero.

## 4. Rules

1. Mount elements must exist in the DOM before the script runs, or call `ServiceformAgenticSearch.mountAll()` after adding them (single-page apps, lazy-rendered headers).
2. In React and Vue, never render the `data-sf-agenticsearch` div and hope: use the `<AgenticSearch>` component from `@serviceform/agenticsearch/react` or `/vue`, which mounts on mount and destroys on unmount. Do not write your own wrapper.
3. Do not wrap the mount element in a `<form>`. The field is its own form.
4. Do not hide the site's existing search until the new one is visible. If the tool id is wrong the search removes itself and fires a `sfas:unavailable` event on the element.
5. The `page` layout owns these URL parameters: `q` (or the one named in `data-search-param`), `sort`, `k`, `page`, `price_min`, `price_max`, `in_stock`, and anything starting with `f.` or `r.`. Do not use them for something else on that page.
6. Theme with CSS custom properties, not by overriding class rules: `.sfas { --sfas-accent: #0a58ca; --sfas-radius: 8px; --sfas-font: inherit; }`.
   The stylesheet is built so that a page's own CSS (Tailwind, Bootstrap, a WordPress theme) cannot restyle the search by accident: every rule carries extra weight. It needs no configuration next to any CSS framework. The flip side: to override one of its rules outright, your selector needs an id (`#site .sfas-hit-title { ... }`) or `!important`. Do not add Tailwind or Bootstrap classes to elements inside the search; they are re-rendered.
7. A Content Security Policy needs `connect-src https://dash.serviceform.com`, `img-src` for the shop's product image host, and `script-src`/`style-src` for wherever the two files are served from.
8. Do not call the HTTP API by hand when the SDK has a method for it. Request and response shapes are in [docs/contract.md](docs/contract.md).

## 5. Verify before you say it is done

Run these in the browser console on the page you changed:

```js
// 1. The runtime loaded
typeof ServiceformAgenticSearch.mount            // "function"
// 2. Every placement mounted (count equals the number of mount elements on the page)
document.querySelectorAll('[data-sfas-mounted]').length
// 3. The tool exists and answers
await ServiceformAgenticSearch.serviceformSearch('TOOL_ID').browse({ q: '' }).then((r) => r.found)   // a number above 0
// 4. Nothing was taken down
document.querySelectorAll('[data-sfas-unavailable]').length   // 0
```

Then type in the box, press Enter, and confirm the results page shows results and the URL carries the query.

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Nothing appears | The script ran before the element existed | Call `ServiceformAgenticSearch.mountAll()` after rendering, or use the framework component |
| The field appears, then disappears | The tool id does not exist | Check the id in the dashboard |
| Field works, no products | The tool has no product index connected | Connect one in the dashboard (Tools > Search box) |
| Unstyled | Stylesheet missing or blocked | Add the `<link>`; without it the script injects the styles itself unless CSP blocks inline styles |
| Enter does nothing in the box | AI is off and no `data-search-page` is set | Set `data-search-page` |
| Results page ignores the header's query | Parameter names differ | Use the same `data-search-param` on both |
| Two searches in one element | Mounted twice by hand | `mount()` returns the existing instance for an element; do not clear the element yourself |

## 7. Working in this repository

```bash
npm install && npm run build && npm test     # JavaScript: packages/agenticsearch
composer install && vendor/bin/phpunit        # PHP: php/
```

- Source of truth for names and wire formats: `docs/contract.md`. Change it first, then the code.
- The JavaScript package has no runtime dependencies. Keep it that way.
- Text from the API or the site goes into the DOM as text (`textContent`), never as HTML. URLs pass through `safeUrl`.
- Every behaviour change needs a test in `packages/agenticsearch/test/`.
