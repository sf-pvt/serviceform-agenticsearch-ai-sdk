# Plain HTML and server-rendered sites

You need a search tool ID first: see [account, index and knowledge base](account.md).

Works with anything that outputs HTML: static sites, Django, Rails, Laravel, Astro, Hugo, Eleventy.

## 1. Header box on every page, results on one page

Put this in your base template. Replace `TOOL_ID` and `/search`.

```html
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@serviceform/agenticsearch@0/dist/agenticsearch.min.css">
</head>
<body>
  <header>
    <div data-sf-agenticsearch data-tool-id="TOOL_ID" data-layout="box" data-search-page="/search"></div>
  </header>

  <!-- page content -->

  <script src="https://cdn.jsdelivr.net/npm/@serviceform/agenticsearch@0/dist/agenticsearch.prebuilt.min.js" defer></script>
</body>
```

And this on the `/search` page, where the results go:

```html
<div data-sf-agenticsearch data-tool-id="TOOL_ID" data-layout="page"></div>
```

That is the whole integration. The box sends Enter to `/search?q=...`, and the page reads `q` from the URL.

## 2. A modal instead of a box

Swap the header element. No results page is needed; the modal is one.

```html
<div data-sf-agenticsearch data-tool-id="TOOL_ID" data-layout="modal"></div>
```

## 3. Self-hosting (recommended)

Copy `agenticsearch.prebuilt.min.js` and `agenticsearch.min.css` from the npm package's `dist/` folder into your own assets and point the two tags there. Nothing is then loaded from a third-party host; only search requests go to Serviceform.

```bash
npm pack @serviceform/agenticsearch && tar -xzf serviceform-agenticsearch-*.tgz package/dist
cp package/dist/agenticsearch.prebuilt.min.js public/assets/agenticsearch.js
cp package/dist/agenticsearch.min.css public/assets/agenticsearch.css
```

## 4. No flash while loading

Render the placeholder shell inside the mount element. The stylesheet sizes it, so the layout does not shift when the script takes over.

```html
<div class="sfas sfas-shell sfas-shell--box" data-sf-agenticsearch data-tool-id="TOOL_ID" data-layout="box" data-search-page="/search">
  <div class="sfas-shell-field"><span class="sfas-shell-icon"></span><span class="sfas-shell-text">Search</span></div>
</div>
```

For the page layout add the body shell after the field:

```html
<div class="sfas sfas-shell sfas-shell--page" data-sf-agenticsearch data-tool-id="TOOL_ID" data-layout="page">
  <div class="sfas-shell-field"><span class="sfas-shell-icon"></span><span class="sfas-shell-text">Search</span></div>
  <div class="sfas-shell-body"><div class="sfas-shell-side"></div><div class="sfas-shell-grid"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
</div>
```

## 5. From JavaScript

```html
<div id="search"></div>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    var search = ServiceformAgenticSearch.mount({ toolId: 'TOOL_ID', target: '#search', layout: 'page', perPage: 12 });
    // search.destroy() removes it again
  });
</script>
```

## 6. Landing pages and links

Every search has an address. The results page reads its search from the query string, so a link is a landing page:

| Link | Shows |
|---|---|
| `/search?q=family+suv` | A search for those words (the words are read into filters) |
| `/search?f.brand=Volvo` | All Volvos |
| `/search?f.fuel=ELECTRIC&price_max=30000&sort=price_asc` | Electric cars up to 30 000, cheapest first |
| `/search?f.condition=demo&sort=newest` | Demo cars, latest added first |
| `/search?f.brand=Volvo\|Audi&r.year=2020\|` | Volvo or Audi, from 2020 |

Parameters: `q` (words), `f.<filter>=a|b` (values, `|` between them), `r.<filter>=min|max` (a numeric range, either side may be empty), `price_min`, `price_max`, `sort` (`relevance`, `price_asc`, `price_desc`, `year_desc`, `year_asc`, `mileage_asc`, `newest`, `name_asc`), `in_stock=1`, `page`. Filter names and values are the ones your catalogue has: set the filters by hand on the results page and copy the address.

Use these links in menus, ads, emails and campaign pages.

For a page of its own with a clean address (say `/used-volvo`), give the search its starting point in the markup instead. The address stays as it is, and the visitor can still change the filters:

```html
<h1>Used Volvo cars</h1>
<div data-sf-agenticsearch data-tool-id="TOOL_ID" data-layout="page"
     data-state="f.brand=Volvo&f.condition=used&sort=price_asc"
     data-routing="false"></div>
```

`data-routing="false"` keeps the visitor's filter changes out of the address; leave it off if you want them shareable. A search in the page's own address always wins over `data-state`.

## 7. Theme

```css
.sfas {
  --sfas-accent: #0a58ca;   /* buttons, focus, links */
  --sfas-radius: 8px;       /* corner roundness */
  --sfas-font: inherit;     /* follows your site by default */
  --sfas-card-min: 220px;   /* narrowest result card */
}
```

All options: [AGENTS.md](../../AGENTS.md#3-every-option).
