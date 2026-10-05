# Plain HTML and server-rendered sites

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

## 6. Theme

```css
.sfas {
  --sfas-accent: #0a58ca;   /* buttons, focus, links */
  --sfas-radius: 8px;       /* corner roundness */
  --sfas-font: inherit;     /* follows your site by default */
  --sfas-card-min: 220px;   /* narrowest result card */
}
```

All options: [AGENTS.md](../../AGENTS.md#3-every-option).
